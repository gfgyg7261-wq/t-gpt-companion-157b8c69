import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Server, Wand2, Shield, Globe, MessageSquare } from "lucide-react";
import logo from "@/assets/tgpt-logo.png";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About — T-GPT by TigerHost" },
      { name: "description", content: "T-GPT is a bold, all-in-one AI by TigerHost — chat, build websites, and ship faster." },
    ],
  }),
});

function AboutPage() {
  return (
    <div className="min-h-screen">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/60 backdrop-blur bg-background/40">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="T-GPT" className="h-8 w-8" />
          <span className="font-display text-lg font-bold text-gradient">T-GPT</span>
        </Link>
        <div className="flex gap-2">
          <Link to="/about"><Button variant="ghost" size="sm">About</Button></Link>
          <Link to="/login"><Button size="sm" className="bg-gradient-brand text-primary-foreground border-0 shadow-glow">Sign in</Button></Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <img src={logo} alt="T-GPT" className="h-24 w-24 mx-auto mb-6 drop-shadow-[0_0_40px_rgba(255,140,60,0.5)]" />
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-4">
            Meet <span className="text-gradient">T-GPT</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A bold, all-in-one AI built by the TigerHost team. Chat without limits, build production-ready websites with a prompt, and ship faster than ever.
          </p>
        </div>

        <section className="grid md:grid-cols-2 gap-6 mb-16">
          {[
            { icon: MessageSquare, title: "Unlimited Chat", body: "Talk with T-GPT about anything — code, math, writing, ideas. Signed-in users get unlimited normal chats." },
            { icon: Wand2, title: "Website Builder", body: "Describe a site and T-GPT generates clean HTML, CSS, and JS files you can preview, edit, and download — like Lovable, but yours." },
            { icon: Sparkles, title: "Tiger Models", body: "Powered by our Tiger-5 and Tiger Pro models, tuned for speed and quality. Premium tiers unlock the strongest reasoning." },
            { icon: Shield, title: "Safe & Private", body: "Every conversation is scoped to you with strict access rules. Admins manage the platform; your data stays yours." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card/60 p-6 hover:border-primary/40 transition">
              <f.icon className="h-8 w-8 text-primary mb-3" />
              <h2 className="font-display font-bold text-xl mb-2">{f.title}</h2>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-8 md:p-12 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-3 mb-4">
            <Server className="h-7 w-7 text-primary" />
            <h2 className="font-display text-3xl font-bold">About TigerHost</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            <strong className="text-foreground">TigerHost</strong> is a modern hosting provider focused on giving creators, gamers, and businesses fast, reliable infrastructure at honest prices. From game servers to web hosting and VPS, TigerHost gives you raw performance with a friendly community behind it.
          </p>
          <p className="text-muted-foreground mb-6">
            T-GPT is built and operated by the same TigerHost team — it's our bet that AI should be open, fun, and a real productivity multiplier, not a paywall maze.
          </p>
          <a href="https://www.tigerhost.space/" target="_blank" rel="noopener noreferrer">
            <Button className="bg-gradient-brand text-primary-foreground border-0 shadow-glow">
              <Globe className="h-4 w-4 mr-2" /> Visit TigerHost
            </Button>
          </a>
        </section>

        <section className="rounded-3xl border border-primary/40 bg-card/60 p-8 md:p-12 mb-16 text-center animate-in fade-in zoom-in-95 duration-700">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-brand text-primary-foreground text-3xl font-display font-bold shadow-glow mb-4">
            AJ
          </div>
          <h2 className="font-display text-3xl font-bold mb-2">
            Created by <span className="text-gradient">Al-Jabir</span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            T-GPT was designed and built by <strong className="text-foreground">Al-Jabir</strong>, founder & owner of TigerHost. Every line, every model, every pixel — engineered to give you a free, powerful AI you can actually own.
          </p>
        </section>

        <section className="text-center">
          <h2 className="font-display text-3xl font-bold mb-3">Ready to try T-GPT?</h2>
          <p className="text-muted-foreground mb-6">Free to start. 5 Website Builder credits every day. Unlimited normal chat once you sign in.</p>
          <Link to="/login">
            <Button size="lg" className="bg-gradient-brand text-primary-foreground border-0 shadow-glow font-semibold px-8">
              Get started free
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} T-GPT by <a href="https://www.tigerhost.space/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">TigerHost</a>
      </footer>
    </div>
  );
}
