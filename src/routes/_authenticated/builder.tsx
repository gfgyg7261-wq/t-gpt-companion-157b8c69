import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import {
  Sparkles,
  Eye,
  Code2,
  Globe,
  Crown,
  Download,
  Copy,
  Send,
  Loader2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/builder")({
  component: BuilderPage,
});

type ChatMsg = { role: "user" | "assistant"; text: string };

const STARTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>T-GPT Builder — Start chatting to create</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-fuchsia-950 via-slate-950 to-indigo-950 text-white min-h-screen flex items-center justify-center font-sans">
  <div class="text-center px-6">
    <div class="text-6xl mb-4">✨</div>
    <h1 class="text-4xl font-bold mb-3 bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">Your site will appear here</h1>
    <p class="text-white/70 max-w-md mx-auto">Tell T-GPT what to build — a landing page, portfolio, dashboard, game, anything.</p>
  </div>
</body>
</html>`;

const SUGGESTIONS = [
  "A bold neon SaaS landing page for an AI photo editor",
  "A retro arcade portfolio for a game developer",
  "A pricing page with 3 tiers, animated cards, dark mode",
  "A simple Snake game playable on the page",
];

function BuilderPage() {
  const [prompt, setPrompt] = useState("");
  const [html, setHtml] = useState(STARTER_HTML);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? prompt).trim();
    if (!text || loading) return;
    setPrompt("");
    setMessages((m) => [...m, { role: "user", text }, { role: "assistant", text: "" }]);
    setLoading(true);
    try {
      const res = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          currentHtml: messages.length === 0 ? undefined : html,
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        // Show progress dots in chat
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            text: `Generating… ${Math.floor(acc.length / 100)}%`,
          };
          return copy;
        });
      }
      // Strip any accidental fences
      const cleaned = acc
        .replace(/^```html\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      setHtml(cleaned);
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", text: "Done! Preview updated. ✨" };
        return copy;
      });
      setView("preview");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Build failed";
      toast.error(msg);
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", text: `Error: ${msg}` };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadHtml = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "t-gpt-site.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(html);
    toast.success("Code copied to clipboard");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-card/30 backdrop-blur">
        <div className="flex items-center gap-2 pl-10">
          <Wand2 className="h-4 w-4 text-primary" />
          <span className="font-display font-bold">Builder</span>
          <span className="text-[10px] uppercase tracking-wider bg-gradient-brand text-primary-foreground px-2 py-0.5 rounded-full font-bold ml-1">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-muted/50 rounded-lg p-0.5 flex">
            <button
              onClick={() => setView("preview")}
              className={`px-3 py-1 text-xs rounded-md flex items-center gap-1.5 ${view === "preview" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
            <button
              onClick={() => setView("code")}
              className={`px-3 py-1 text-xs rounded-md flex items-center gap-1.5 ${view === "code" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              <Code2 className="h-3.5 w-3.5" /> Code
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setUpgradeOpen(true)}>
            <Crown className="h-3.5 w-3.5 mr-1 text-primary" /> Upgrade
          </Button>
          <Button
            size="sm"
            onClick={() => setPublishOpen(true)}
            className="bg-gradient-brand text-primary-foreground border-0 shadow-glow"
          >
            <Globe className="h-3.5 w-3.5 mr-1" /> Publish
          </Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[360px_1fr] min-h-0">
        {/* Chat panel */}
        <div className="flex flex-col border-r border-border min-h-0 bg-sidebar/40">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Build a website with T-GPT
                </div>
                <p className="text-xs text-muted-foreground">
                  Describe what you want. T-GPT will generate a complete site you can preview, tweak, and publish.
                </p>
                <div className="space-y-2 pt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs p-2.5 rounded-lg border border-border bg-card/60 hover:border-primary/50 hover:bg-card transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm rounded-lg px-3 py-2 ${
                    m.role === "user"
                      ? "bg-gradient-brand text-primary-foreground ml-6"
                      : "bg-card border border-border mr-6"
                  }`}
                >
                  {m.text || (loading && i === messages.length - 1 ? "Thinking…" : "")}
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border p-2 bg-background/60">
            <div className="flex gap-2 items-end">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={messages.length ? "Ask for changes…" : "Describe your site…"}
                rows={2}
                className="resize-none text-sm min-h-[60px]"
                disabled={loading}
              />
              <Button
                onClick={() => send()}
                disabled={loading || !prompt.trim()}
                className="bg-gradient-brand text-primary-foreground border-0 shadow-glow shrink-0"
                size="icon"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Preview / Code */}
        <div className="flex flex-col min-h-0 relative bg-muted/20">
          {view === "preview" ? (
            <iframe
              title="Preview"
              srcDoc={html}
              sandbox="allow-scripts allow-forms"
              className="flex-1 w-full bg-white"
            />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/40 text-xs">
                <span className="font-mono text-muted-foreground">index.html</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={copyCode} className="h-7">
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                  <Button size="sm" variant="ghost" onClick={downloadHtml} className="h-7">
                    <Download className="h-3 w-3 mr-1" /> Download
                  </Button>
                </div>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono bg-background/60 whitespace-pre-wrap break-words">
                {html}
              </pre>
            </div>
          )}
        </div>
      </div>

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish your site</DialogTitle>
            <DialogDescription>
              Hosted publishing is coming soon. For now, download the HTML and host it anywhere — Netlify, Vercel, GitHub Pages, or your own server.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <Button onClick={downloadHtml} className="w-full bg-gradient-brand text-primary-foreground border-0 shadow-glow">
              <Download className="h-4 w-4 mr-2" /> Download index.html
            </Button>
            <Button onClick={copyCode} variant="outline" className="w-full">
              <Copy className="h-4 w-4 mr-2" /> Copy full code
            </Button>
            <Button onClick={() => { setPublishOpen(false); setUpgradeOpen(true); }} variant="ghost" className="w-full text-primary">
              <Crown className="h-4 w-4 mr-2" /> Upgrade for one-click hosting
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
