import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, RefreshCw, Check } from "lucide-react";
import logo from "@/assets/tgpt-logo.png";

const search = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  validateSearch: search,
  component: ChatPage,
});

const MODELS = [
  { id: "google/gemini-3-flash-preview", label: "TigerGPT v3 Flash · Fast" },
  { id: "google/gemini-2.5-flash", label: "TigerGPT v2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "TigerGPT v2.5 Pro · Smart" },
  { id: "openai/gpt-5-mini", label: "Tiger-5 Mini" },
  { id: "openai/gpt-5", label: "Tiger-5 · Powerful" },
];

function ChatPage() {
  const { threadId } = Route.useParams();
  const { q } = Route.useSearch();
  const qc = useQueryClient();
  const autoSentRef = useRef<string | null>(null);

  const [model, setModel] = useState<string>(() => {
    if (typeof window === "undefined") return MODELS[0].id;
    return localStorage.getItem("tgpt:model") ?? MODELS[0].id;
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("tgpt:model", model);
  }, [model]);

  const { data: initialMessages, isLoading } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,role,parts,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: Array.isArray(m.parts) ? m.parts : [{ type: "text", text: "" }],
      }));
    },
  });

  const initial = useMemo<UIMessage[]>(
    () =>
      (initialMessages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
      })) as UIMessage[],
    [initialMessages],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, body }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          return {
            headers,
            body: { messages, threadId, model, ...(body ?? {}) },
          };
        },
      }),
    [threadId, model],
  );

  const { messages, sendMessage, status, setMessages, regenerate } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (err) => toast.error(err.message || "Something went wrong"),
    onFinish: () => qc.invalidateQueries({ queryKey: ["threads"] }),
  });

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "ready" || status === undefined) textareaRef.current?.focus();
  }, [status, threadId]);

  useEffect(() => {
    if (!q || autoSentRef.current === threadId) return;
    if (isLoading) return;
    if (initial.length > 0) {
      autoSentRef.current = threadId;
      return;
    }
    autoSentRef.current = threadId;
    sendMessage({ text: q });
  }, [q, threadId, isLoading, initial.length, sendMessage]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    sendMessage({ text });
    setInput("");
  };

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const handleRegenerate = async () => {
    if (status === "submitted" || status === "streaming") return;
    // Drop the last assistant message from local state and DB, then re-ask
    const lastIdx = [...messages].reverse().findIndex((m) => m.role === "assistant");
    if (lastIdx === -1) return;
    const idx = messages.length - 1 - lastIdx;
    setMessages(messages.slice(0, idx));
    try {
      const { data: rows } = await supabase
        .from("messages")
        .select("id")
        .eq("thread_id", threadId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1);
      const id = rows?.[0]?.id;
      if (id) await supabase.from("messages").delete().eq("id", id);
    } catch {
      /* non-fatal */
    }
    regenerate();
  };

  const showShimmer = status === "submitted";
  const isStreaming = status === "streaming" || status === "submitted";
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar with model picker */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border/60 backdrop-blur bg-background/40">
        <div className="pl-10 md:pl-0 text-xs text-muted-foreground truncate">T-GPT</div>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="h-8 w-[220px] text-xs bg-card/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="max-w-3xl mx-auto w-full px-4 py-6">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <img
                src={logo}
                alt="T-GPT"
                className="h-16 w-16 mb-4 opacity-90"
                width={64}
                height={64}
              />
              <p className="text-muted-foreground">Ask me anything to get started.</p>
            </div>
          )}
          {messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
              .join("");
            const isAssistant = m.role === "assistant";
            const isLast = m.id === lastAssistantId;
            return (
              <Message key={m.id} from={m.role}>
                {isAssistant ? (
                  <div className="space-y-2">
                    <MessageResponse>{text}</MessageResponse>
                    {!isStreaming && text && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => copyMessage(m.id, text)}
                        >
                          {copiedId === m.id ? (
                            <Check className="h-3 w-3 mr-1" />
                          ) : (
                            <Copy className="h-3 w-3 mr-1" />
                          )}
                          {copiedId === m.id ? "Copied" : "Copy"}
                        </Button>
                        {isLast && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={handleRegenerate}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Regenerate
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <MessageContent className="!bg-chat-user !text-chat-user-foreground shadow-glow">
                    {text}
                  </MessageContent>
                )}
              </Message>
            );
          })}
          {showShimmer && (
            <div className="px-4 py-2">
              <Shimmer>T-GPT is thinking...</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background/60 backdrop-blur">
        <div className="max-w-3xl mx-auto w-full px-4 py-4">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message T-GPT..."
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                status={status}
                disabled={!input.trim() || status === "submitted" || status === "streaming"}
              />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            T-GPT can make mistakes. Verify important info.
          </p>
        </div>
      </div>
    </div>
  );
}
