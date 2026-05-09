import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getThreadMessages } from "@/lib/chat.functions";
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
import logo from "@/assets/tgpt-logo.png";

const search = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  validateSearch: search,
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const { q } = Route.useSearch();
  const fetchMsgs = useServerFn(getThreadMessages);
  const autoSentRef = useRef<string | null>(null);

  const { data: initialMessages, isLoading } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => fetchMsgs({ data: { threadId } }),
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
            body: { messages, threadId, ...(body ?? {}) },
          };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initial,
    transport,
  });

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const showShimmer = status === "submitted";

  return (
    <div className="flex flex-col h-full">
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
            return (
              <Message key={m.id} from={m.role}>
                {m.role === "assistant" ? (
                  <MessageResponse>{text}</MessageResponse>
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
