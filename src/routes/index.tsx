import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "@/assets/tgpt-logo.png";
import { Sparkles, Zap, Lock, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "T-GPT — Bold AI Chat" },
      { name: "description", content: "T-GPT is a vibrant AI chat companion. Brainstorm, code, learn and create — all in one bold, colorful interface." },
      { property: "og:title", content: "T-GPT — Bold AI Chat" },
      { property: "og:description", content: "Your bold, colorful AI companion. Brainstorm, code, learn, create." },
    ],
  }),
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" as never });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="T-GPT" className="h-9 w-9" width={36} height={36} />
          <span className="font-display text-xl font-bold text-gradient">T-GPT</span>
        </Link>
        <Link to="/login">
          <Button variant="ghost">Sign in</Button>
        </Link>
      </header>

      <main className="px-6 pt-20 pb-32 max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/50 backdrop-blur text-xs text-muted-foreground mb-8">
            <Sparkles className="h-3 w-3 text-primary" /> Powered by next-gen AI
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Chat with <span className="text-gradient">T-GPT</span>
            <br />the bold AI companion
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Brainstorm, code, write and learn — with an AI that's vibrant, fast, and remembers every conversation.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/login">
              <Button size="lg" className="h-12 px-8 bg-gradient-brand text-primary-foreground border-0 shadow-glow font-semibold text-base">
                Start chatting free
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                Sign in
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-24">
          {[
            { icon: Zap, title: "Lightning fast", desc: "Streaming responses powered by Lovable AI." },
            { icon: MessageCircle, title: "Threaded chats", desc: "Organize every conversation, never lose context." },
            { icon: Lock, title: "Private & secure", desc: "Your chats are yours alone, end-to-end protected." },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-2xl border border-border bg-card/50 backdrop-blur">
              <f.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-display text-lg font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
