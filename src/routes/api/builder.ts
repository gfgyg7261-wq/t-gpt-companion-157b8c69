import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const SYSTEM = `You are T-GPT Builder, an elite AI website builder by the TigerHost team. You output COMPLETE, beautiful, production-ready multi-file websites.

OUTPUT FORMAT (CRITICAL):
You MUST respond with ONLY a single JSON object — no markdown, no commentary, no code fences. The JSON must have exactly these keys:
{
  "html": "<!DOCTYPE html>... full index.html linking style.css and script.js ...",
  "css":  "/* full style.css */",
  "js":   "// full script.js (use 'use strict'; if you want)",
  "summary": "1-2 sentence description of what changed/was built"
}

RULES:
1. The HTML must reference the CSS as <link rel="stylesheet" href="style.css"> and the JS as <script src="script.js" defer></script>. NEVER inline large CSS/JS — keep them in their own files.
2. Tailwind Play CDN, Google Fonts, Lucide icons, Alpine.js, Three.js are allowed via CDN <link>/<script> tags in the HTML.
3. Make it visually stunning: modern typography, bold gradients, smooth animations, fully responsive, accessible. Use vibrant orange/red palettes when appropriate (TigerHost brand).
4. If the user provides existing files (HTML/CSS/JS) in their message, treat that as the current site and APPLY their requested changes — do not start from scratch unless they ask.
5. NEVER mention ChatGPT, OpenAI, Gemini, Claude, Anthropic, or any other AI brand. You are T-GPT Builder.
6. The output MUST parse as valid JSON. Escape strings properly. Keep all three files non-empty.`;

const ALLOWED_MODELS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "openai/gpt-5-mini",
  "openai/gpt-5",
]);

function tryParse(raw: string): { html: string; css: string; js: string; summary: string } | null {
  let s = raw.trim();
  s = s.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  // Find first { and last }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  const candidate = s.slice(first, last + 1);
  try {
    const obj = JSON.parse(candidate);
    if (typeof obj.html === "string" && typeof obj.css === "string" && typeof obj.js === "string") {
      return { html: obj.html, css: obj.css, js: obj.js, summary: obj.summary ?? "Updated." };
    }
  } catch { /* fall through */ }
  return null;
}

export const Route = createFileRoute("/api/builder")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_ANON = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), { status: 500 });

        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const admin = createClient(SUPABASE_URL, SERVICE, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        const userId = claimsData.claims.sub as string;

        const body = (await request.json()) as {
          prompt: string;
          threadId: string;
          current?: { html?: string; css?: string; js?: string };
          model?: string;
        };
        if (!body?.prompt || !body?.threadId) {
          return new Response(JSON.stringify({ error: "Missing prompt or threadId" }), { status: 400 });
        }

        // Check & spend credit (admins skip)
        const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
        if (!isAdmin) {
          const { data: bal } = await admin.rpc("spend_credit", { _user_id: userId });
          if (bal === -1 || bal === null) {
            return new Response(JSON.stringify({ error: "Out of credits. Comes back tomorrow or upgrade on Discord." }), { status: 402 });
          }
        }

        // Save user message
        await admin.from("builder_messages").insert({
          thread_id: body.threadId, user_id: userId, role: "user", content: body.prompt,
        });

        const modelId = body.model && ALLOWED_MODELS.has(body.model) ? body.model : "google/gemini-2.5-pro";
        const userText = body.current?.html
          ? `CURRENT_FILES:\n--- index.html ---\n${body.current.html}\n--- style.css ---\n${body.current.css ?? ""}\n--- script.js ---\n${body.current.js ?? ""}\n\nCHANGES REQUESTED:\n${body.prompt}`
          : body.prompt;

        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway(modelId);

        let result;
        try {
          result = await generateText({ model, system: SYSTEM, prompt: userText });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ error: msg }), { status: 500 });
        }

        const parsed = tryParse(result.text);
        if (!parsed) {
          return new Response(JSON.stringify({ error: "AI returned invalid format. Try again." }), { status: 502 });
        }

        // Save assistant message + update thread files
        await admin.from("builder_messages").insert({
          thread_id: body.threadId, user_id: userId, role: "assistant", content: parsed.summary,
        });
        await admin.from("builder_threads").update({
          html: parsed.html, css: parsed.css, js: parsed.js, updated_at: new Date().toISOString(),
        }).eq("id", body.threadId);

        // Update title if it's still default and this is first user message
        const { data: msgs } = await admin
          .from("builder_messages")
          .select("id")
          .eq("thread_id", body.threadId)
          .eq("role", "user");
        if ((msgs?.length ?? 0) <= 1) {
          await admin.from("builder_threads")
            .update({ title: body.prompt.slice(0, 60) })
            .eq("id", body.threadId)
            .eq("title", "New site");
        }

        // Get fresh credit balance
        const { data: cred } = await admin.from("credits").select("balance").eq("user_id", userId).maybeSingle();

        return Response.json({
          html: parsed.html,
          css: parsed.css,
          js: parsed.js,
          summary: parsed.summary,
          credits: cred?.balance ?? null,
        });
      },
    },
  },
});
