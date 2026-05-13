import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, Code, Lightbulb, BookOpen, Lock } from "lucide-react";
import logo from "@/assets/tgpt-logo.png";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "T-GPT — Bold AI Chat" },
      { name: "description", content: "Chat with T-GPT, a bold AI companion. Free trial — sign in for unlimited conversations." },
      { property: "og:title", content: "T-GPT — Bold AI Chat" },
      { property: "og:description", content: "Your bold, colorful AI companion. Brainstorm, code, learn, create." },
    ],
  }),
});

const FREE_LIMIT = 5;
const GUEST_COUNT_KEY = "tgpt:guest-message-count";

const SUGGESTIONS = [
  { icon: Sparkles, text: "Brainstorm a wild startup idea" },
  { icon: Code, text: "Explain async/await in JavaScript" },
  { icon: Lightbulb, text: "5 productivity tips for remote work" },
  { icon: BookOpen, text: "Summarize Dune in 3 paragraphs" },
];

function Landing() {
  const navigate = useNavigate();
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [input, setInput] = useState("");
  const [storedGuestCount, setStoredGuestCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(GUEST_COUNT_KEY)) || 0;
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // If already signed in, jump to the full app
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/chat" });
    });
  }, [navigate]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/guest-chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { messages, ...(body ?? {}) },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({
    id: "guest",
    transport,
    onError: (err) => toast.error(err.message || "Something went wrong"),
  });

  const userMsgCount = Math.max(storedGuestCount, messages.filter((m) => m.role === "user").length);
  const remaining = Math.max(0, FREE_LIMIT - userMsgCount);
  const limitReached = userMsgCount >= FREE_LIMIT;

  useEffect(() => {
    if (limitReached && status === "ready") {
      setShowAuthGate(true);
    }
  }, [limitReached, status]);

  useEffect(() => {
    if (status === "ready" || status === undefined) textareaRef.current?.focus();
  }, [status]);

  const trySend = (text: string) => {
    const t = text.trim();
    if (!t) return;
    if (limitReached) {
      setShowAuthGate(true);
      return;
    }
    const nextCount = Math.min(FREE_LIMIT, userMsgCount + 1);
    setStoredGuestCount(nextCount);
    localStorage.setItem(GUEST_COUNT_KEY, String(nextCount));
    sendMessage({ text: t });
    setInput("");
  };

  const handleSubmit = () => {
    if (status === "submitted" || status === "streaming") return;
    trySend(input);
  };

  const isStreaming = status === "streaming" || status === "submitted";
  const showShimmer = status === "submitted";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 md:px-6 py-3 flex items-center justify-between border-b border-border/60 backdrop-blur bg-background/40">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="T-GPT" className="h-8 w-8" width={32} height={32} />
          <span className="font-display text-lg font-bold text-gradient">T-GPT</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-muted-foreground">
            {remaining > 0 ? `${remaining} free message${remaining === 1 ? "" : "s"} left` : "Free limit reached"}
          </span>
          <Link to="/login">
            <Button size="sm" className="bg-gradient-brand text-primary-foreground border-0 shadow-glow font-semibold">
              Sign in / Sign up
            </Button>
          </Link>
        </div>
      </header>

      {/* Chat */}
      <Conversation className="flex-1">
        <ConversationContent className="max-w-3xl mx-auto w-full px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-10 pb-6 text-center">
              <img
                src={logo}
                alt="T-GPT"
                className="h-20 w-20 mb-6 drop-shadow-[0_0_30px_rgba(217,70,239,0.5)]"
                width={80}
                height={80}
              />
              <h1 className="font-display text-4xl md:text-5xl font-bold mb-2">
                Hello, I'm <span className="text-gradient">T-GPT</span>
              </h1>
              <p className="text-muted-foreground max-w-md mb-8">
                Ask me anything — coding, writing, math, ideas. Try {FREE_LIMIT} messages free, no signup needed.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => trySend(s.text)}
                    className="group flex items-start gap-3 text-left p-4 rounded-xl border border-border bg-card/50 backdrop-blur hover:border-primary/50 hover:bg-card transition"
                  >
                    <s.icon className="h-5 w-5 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition" />
                    <span className="text-sm">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const text = m.parts
                .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
                .join("");
              const isAssistant = m.role === "assistant";
              return (
                <Message key={m.id} from={m.role}>
                  {isAssistant ? (
                    <MessageResponse>{text}</MessageResponse>
                  ) : (
                    <MessageContent className="!bg-chat-user !text-chat-user-foreground shadow-glow">
                      {text}
                    </MessageContent>
                  )}
                </Message>
              );
            })
          )}
          {showShimmer && (
            <div className="px-4 py-2">
              <Shimmer>T-GPT is thinking...</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Composer */}
      <div className="border-t border-border bg-background/60 backdrop-blur">
        <div className="max-w-3xl mx-auto w-full px-4 py-4">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={limitReached ? "Sign in to keep chatting..." : "Message T-GPT..."}
              disabled={limitReached}
            />
            <PromptInputFooter className="justify-between">
              <span className="text-[11px] text-muted-foreground pl-2">
                {remaining > 0
                  ? `${remaining} of ${FREE_LIMIT} free messages left`
                  : "Sign in for unlimited messages"}
              </span>
              <PromptInputSubmit
                status={status}
                disabled={!input.trim() || isStreaming || limitReached}
              />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            T-GPT can make mistakes. Verify important info.
          </p>
        </div>
      </div>

      {/* Auth gate dialog */}
      <Dialog open={showAuthGate} onOpenChange={setShowAuthGate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-gradient-brand flex items-center justify-center shadow-glow">
              <Lock className="h-6 w-6 text-primary-foreground" />
            </div>
            <DialogTitle className="text-center font-display text-2xl">
              You've reached the free limit
            </DialogTitle>
            <DialogDescription className="text-center">
              Sign up free to keep chatting with T-GPT, save your conversations, switch models, and unlock the full experience.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Link to="/login" className="w-full">
              <Button className="w-full bg-gradient-brand text-primary-foreground border-0 shadow-glow font-semibold">
                Sign up free
              </Button>
            </Link>
            <Link to="/login" className="w-full">
              <Button variant="outline" className="w-full">
                I already have an account
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
