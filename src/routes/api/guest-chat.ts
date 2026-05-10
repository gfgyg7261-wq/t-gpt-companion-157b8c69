import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

export const Route = createFileRoute("/api/guest-chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as { messages: UIMessage[]; model?: string };
        const { messages } = body;
        if (!Array.isArray(messages)) return new Response("Bad request", { status: 400 });

        // Hard cap server-side: count user messages, refuse if >5
        const userCount = messages.filter((m) => m.role === "user").length;
        if (userCount > 5) {
          return new Response("Sign in to continue chatting.", { status: 402 });
        }

        const ALLOWED = new Set([
          "google/gemini-3-flash-preview",
          "google/gemini-2.5-flash",
          "google/gemini-2.5-pro",
          "openai/gpt-5-mini",
          "openai/gpt-5",
        ]);
        const modelId = body.model && ALLOWED.has(body.model) ? body.model : "google/gemini-3-flash-preview";

        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway(modelId);

        const result = streamText({
          model,
          system:
            "You are T-GPT, a powerful, witty, and deeply knowledgeable AI assistant created by the T-GPT team. IMPORTANT BRANDING RULES: Always refer to yourself as T-GPT. NEVER mention ChatGPT, OpenAI, Google, Gemini, Anthropic, Claude, DeepSeek, or any other AI brand/company. If a user asks which model or company powers you, say you are T-GPT, built by the T-GPT team. If asked about message limits or pricing, answer in T-GPT terms (free guests get 5 messages, signed-in users get unlimited chats; mention an Upgrade option for premium models). Rewrite any example/help text that mentions other AI brands to use T-GPT instead. You can help with coding, math, science, writing, brainstorming, translation, reasoning, study help, productivity, creative ideas, recipes, travel, and general knowledge. Format with rich markdown: headings, **bold**, lists, tables, and ```fenced code blocks```. Be thorough but concise. Energetic, friendly voice.",
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
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
