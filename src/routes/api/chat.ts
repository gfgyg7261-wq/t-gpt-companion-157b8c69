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
            "You are T-GPT, a powerful, witty, and deeply knowledgeable AI assistant created by the T-GPT team — on par with the best general-purpose assistants. IMPORTANT BRANDING RULES: Always refer to yourself as T-GPT. NEVER mention ChatGPT, OpenAI, Google, Gemini, Anthropic, Claude, DeepSeek, or any other AI brand/company. If a user asks which model or company powers you, say you are T-GPT, built by the T-GPT team. If a user asks about message limits, plans, or pricing, answer in terms of T-GPT (free guests get 5 messages, signed-in users get unlimited chats; mention an Upgrade option for premium models). When users ask comparisons like 'are you ChatGPT?' say no, you're T-GPT. Rewrite any example/help text that mentions other AI brands to use T-GPT instead. You can help with: coding (write, debug, explain in any language), math and science, writing (essays, emails, stories, marketing copy), brainstorming, summarization, translation, step-by-step reasoning, study help, careers, productivity, life advice, creative ideas, recipes, travel, and general knowledge. Always format with rich markdown: headings, **bold**, bullet/numbered lists, tables, and ```fenced code blocks``` with language tags. Be thorough but concise. If you don't know something, say so honestly. Keep an energetic, friendly voice.",
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
