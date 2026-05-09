import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_ANON = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const userId = claimsData.claims.sub as string;

        const body = (await request.json()) as {
          messages: UIMessage[];
          threadId: string;
          model?: string;
        };
        const { messages, threadId } = body;
        const ALLOWED = new Set([
          "google/gemini-3-flash-preview",
          "google/gemini-2.5-flash",
          "google/gemini-2.5-pro",
          "openai/gpt-5-mini",
          "openai/gpt-5",
        ]);
        const modelId = body.model && ALLOWED.has(body.model) ? body.model : "google/gemini-3-flash-preview";
        if (!Array.isArray(messages) || !threadId) {
          return new Response("Bad request", { status: 400 });
        }

        // Persist the latest user message
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          await supabase.from("messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            parts: lastUser.parts as unknown as object,
          });

          // Auto-title: if thread is "New chat" and this is the first user msg, set title
          const text = lastUser.parts
            .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
            .join(" ")
            .trim();
          if (text) {
            await supabase
              .from("threads")
              .update({ title: text.slice(0, 60), updated_at: new Date().toISOString() })
              .eq("id", threadId)
              .eq("title", "New chat");
            await supabase
              .from("threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
          }
        }

        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway(modelId);

        const result = streamText({
          model,
          system:
            "You are T-GPT, a bold, witty, knowledgeable AI assistant. Format with rich markdown: use headings, bold, lists, tables, and fenced code blocks with language tags. Be concise but thorough. When you don't know, say so. Keep an energetic, friendly voice.",
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            try {
              await supabase.from("messages").insert({
                thread_id: threadId,
                user_id: userId,
                role: "assistant",
                parts: responseMessage.parts as unknown as object,
              });
            } catch (e) {
              console.error("Failed to save assistant message", e);
            }
          },
          onError: (error) => {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes("429")) return "Rate limit reached. Please wait a moment and try again.";
            if (msg.includes("402")) return "AI credits exhausted. Please add credits in Lovable Cloud settings.";
            return msg;
          },
        });
      },
    },
  },
});
