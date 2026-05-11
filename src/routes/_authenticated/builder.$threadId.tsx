import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import {
  Sparkles, Eye, Code2, Globe, Crown, Download, Copy, Send, Loader2, Wand2, ArrowLeft, Coins,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/builder/$threadId")({
  component: BuilderEditor,
});

const STARTER_HTML = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>T-GPT Builder</title>
<link rel="stylesheet" href="style.css"/>
</head><body>
<div class="hero"><h1>✨ Your site appears here</h1><p>Tell T-GPT what to build.</p></div>
<script src="script.js" defer></script>
</body></html>`;
const STARTER_CSS = `body{margin:0;font-family:system-ui;background:linear-gradient(135deg,#1a0d05,#2d1206);color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}.hero{text-align:center;padding:2rem}.hero h1{font-size:3rem;background:linear-gradient(90deg,#ff8c3c,#ff3c3c);-webkit-background-clip:text;color:transparent}.hero p{opacity:.7}`;
const STARTER_JS = `// script.js — T-GPT Builder\nconsole.log("T-GPT Builder ready");`;

const SUGGESTIONS = [
  "A bold orange SaaS landing page for an AI photo editor",
  "A retro arcade portfolio for a game developer",
  "A pricing page with 3 tiers and animated cards",
  "A simple Snake game playable on the page",
];

type FileKey = "html" | "css" | "js";

function buildPreview(html: string, css: string, js: string) {
  // Inject inline overrides for style.css and script.js so iframe works without server
  const injected = html
    .replace(/<link[^>]+href=["']style\.css["'][^>]*>/i, `<style>${css}</style>`)
    .replace(/<script[^>]+src=["']script\.js["'][^>]*><\/script>/i, `<script>${js}</script>`);
  // Fallback: if not present, inject before </body>
  if (!injected.includes(css.slice(0, 20)) && css) {
    return injected.replace("</head>", `<style>${css}</style></head>`).replace("</body>", `<script>${js}</script></body>`);
  }
  return injected;
}

function BuilderEditor() {
  const { threadId } = Route.useParams();
  const qc = useQueryClient();

  const { data: thread, isLoading } = useQuery({
    queryKey: ["builder-thread", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_threads")
        .select("id,title,html,css,js")
        .eq("id", threadId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["builder-messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_messages")
        .select("id,role,content,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: credits, refetch: refetchCredits } = useQuery({
    queryKey: ["credits"],
    queryFn: async () => {
      const { data } = await supabase.from("credits").select("balance").maybeSingle();
      return data?.balance ?? 0;
    },
  });

  const [html, setHtml] = useState(STARTER_HTML);
  const [css, setCss] = useState(STARTER_CSS);
  const [js, setJs] = useState(STARTER_JS);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [activeFile, setActiveFile] = useState<FileKey>("html");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thread) {
      setHtml(thread.html || STARTER_HTML);
      setCss(thread.css || STARTER_CSS);
      setJs(thread.js || STARTER_JS);
    }
  }, [thread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const previewSrc = useMemo(() => buildPreview(html, css, js), [html, css, js]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? prompt).trim();
    if (!text || loading) return;
    setPrompt("");
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          prompt: text, threadId,
          current: messages.length === 0 ? undefined : { html, css, js },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Build failed");
      setHtml(data.html); setCss(data.css); setJs(data.js);
      setView("preview");
      qc.invalidateQueries({ queryKey: ["builder-messages", threadId] });
      qc.invalidateQueries({ queryKey: ["builder-threads"] });
      refetchCredits();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Build failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadZip = async () => {
    // Simple download: create individual files via blob URLs
    const files: [string, string][] = [["index.html", html], ["style.css", css], ["script.js", js]];
    for (const [name, content] of files) {
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  const copyActive = async () => {
    const txt = activeFile === "html" ? html : activeFile === "css" ? css : js;
    await navigator.clipboard.writeText(txt);
    toast.success("Copied");
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-card/30 backdrop-blur">
        <div className="flex items-center gap-2 pl-10">
          <Link to="/builder"><Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <Wand2 className="h-4 w-4 text-primary" />
          <span className="font-display font-bold truncate max-w-[200px]">{thread?.title ?? "Builder"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-primary" /> {credits ?? 0} credits left today
          </span>
          <div className="bg-muted/50 rounded-lg p-0.5 flex">
            <button onClick={() => setView("preview")} className={`px-3 py-1 text-xs rounded-md flex items-center gap-1.5 ${view === "preview" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
            <button onClick={() => setView("code")} className={`px-3 py-1 text-xs rounded-md flex items-center gap-1.5 ${view === "code" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              <Code2 className="h-3.5 w-3.5" /> Code
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setUpgradeOpen(true)}><Crown className="h-3.5 w-3.5 mr-1 text-primary" /> Upgrade</Button>
          <Button size="sm" onClick={() => setPublishOpen(true)} className="bg-gradient-brand text-primary-foreground border-0 shadow-glow"><Globe className="h-3.5 w-3.5 mr-1" /> Publish</Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[360px_1fr] min-h-0">
        {/* Chat */}
        <div className="flex flex-col border-r border-border min-h-0 bg-sidebar/40">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Build with T-GPT</div>
                <p className="text-xs text-muted-foreground">Describe your site. Each build uses 1 credit (5 per day, resets daily).</p>
                <div className="space-y-2 pt-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="w-full text-left text-xs p-2.5 rounded-lg border border-border bg-card/60 hover:border-primary/50 hover:bg-card transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`text-sm rounded-lg px-3 py-2 ${m.role === "user" ? "bg-gradient-brand text-primary-foreground ml-6" : "bg-card border border-border mr-6"}`}>
                  {m.content}
                </div>
              ))
            )}
            {loading && <div className="text-sm rounded-lg px-3 py-2 bg-card border border-border mr-6 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> T-GPT is building…</div>}
          </div>
          <div className="border-t border-border p-2 bg-background/60">
            <div className="flex gap-2 items-end">
              <Textarea
                value={prompt} onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={messages.length ? "Ask for changes…" : "Describe your site…"}
                rows={2} className="resize-none text-sm min-h-[60px]" disabled={loading}
              />
              <Button onClick={() => send()} disabled={loading || !prompt.trim()} className="bg-gradient-brand text-primary-foreground border-0 shadow-glow shrink-0" size="icon">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Preview / Code */}
        <div className="flex flex-col min-h-0 relative bg-muted/20">
          {view === "preview" ? (
            <iframe title="Preview" srcDoc={previewSrc} sandbox="allow-scripts allow-forms" className="flex-1 w-full bg-white" />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/40 text-xs">
                <div className="flex gap-1">
                  {(["html", "css", "js"] as FileKey[]).map((f) => (
                    <button key={f} onClick={() => setActiveFile(f)} className={`px-3 py-1 rounded-md font-mono text-xs ${activeFile === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                      {f === "html" ? "index.html" : f === "css" ? "style.css" : "script.js"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={copyActive} className="h-7"><Copy className="h-3 w-3 mr-1" /> Copy</Button>
                  <Button size="sm" variant="ghost" onClick={downloadZip} className="h-7"><Download className="h-3 w-3 mr-1" /> Download all</Button>
                </div>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono bg-background/60 whitespace-pre-wrap break-words">
                {activeFile === "html" ? html : activeFile === "css" ? css : js}
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
              Hosted publishing is coming soon. Download your files and host them on TigerHost or anywhere static hosting works.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <Button onClick={downloadZip} className="w-full bg-gradient-brand text-primary-foreground border-0 shadow-glow"><Download className="h-4 w-4 mr-2" /> Download all files</Button>
            <a href="https://www.tigerhost.space/" target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="outline" className="w-full"><Globe className="h-4 w-4 mr-2" /> Host on TigerHost</Button>
            </a>
            <Button onClick={() => { setPublishOpen(false); setUpgradeOpen(true); }} variant="ghost" className="w-full text-primary"><Crown className="h-4 w-4 mr-2" /> Upgrade for one-click hosting</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
