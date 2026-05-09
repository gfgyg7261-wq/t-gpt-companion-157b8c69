import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { createThread } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import logo from "@/assets/tgpt-logo.png";
import { Sparkles, Code, Lightbulb, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  component: HomePage,
});

const SUGGESTIONS = [
  { icon: Sparkles, text: "Brainstorm a wild startup idea for me" },
  { icon: Code, text: "Explain async/await in JavaScript with examples" },
  { icon: Lightbulb, text: "Give me 5 productivity tips for remote work" },
  { icon: BookOpen, text: "Summarize the plot of Dune in 3 paragraphs" },
];

function HomePage() {
  const create = useServerFn(createThread);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const start = async (seed?: string) => {
    const t = await create({ data: { title: seed?.slice(0, 60) } });
    qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/c/$threadId", params: { threadId: t.id }, search: seed ? { q: seed } : undefined });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <img src={logo} alt="T-GPT" className="h-20 w-20 mb-6 drop-shadow-[0_0_30px_rgba(217,70,239,0.5)]" width={80} height={80} />
      <h1 className="font-display text-4xl md:text-5xl font-bold text-center mb-2">
        Hello, I'm <span className="text-gradient">T-GPT</span>
      </h1>
      <p className="text-muted-foreground text-center max-w-md mb-10">
        Your bold, colorful AI companion. Ask anything — brainstorm, code, learn, create.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.text}
            onClick={() => start(s.text)}
            className="group flex items-start gap-3 text-left p-4 rounded-xl border border-border bg-card/50 backdrop-blur hover:border-primary/50 hover:bg-card transition"
          >
            <s.icon className="h-5 w-5 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition" />
            <span className="text-sm">{s.text}</span>
          </button>
        ))}
      </div>

      <Button
        onClick={() => start()}
        className="mt-8 bg-gradient-brand text-primary-foreground border-0 shadow-glow font-semibold px-8"
        size="lg"
      >
        Start a blank chat
      </Button>
    </div>
  );
}
