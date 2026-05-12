import { createFileRoute, Outlet, useRouterState, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Wand2, Globe, Trash2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/tgpt-logo.png";

export const Route = createFileRoute("/_authenticated/builder")({
  component: BuilderShell,
});

function BuilderShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/builder") return <BuilderHome />;
  return <Outlet />;
}

function BuilderHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: threads = [] } = useQuery({
    queryKey: ["builder-threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_threads")
        .select("id,title,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const newSite = async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("builder_threads")
        .insert({ user_id: u.user.id, title: "New site" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["builder-threads"] });
      navigate({ to: "/builder/$threadId", params: { threadId: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const deleteBuild = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this build? This cannot be undone.")) return;
    const { error } = await supabase.from("builder_threads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Build deleted");
    qc.invalidateQueries({ queryKey: ["builder-threads"] });
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-12 max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="text-center mb-10">
        <img src={logo} alt="T-GPT" className="h-16 w-16 mx-auto mb-4 drop-shadow-[0_0_30px_rgba(255,140,60,0.5)] animate-in zoom-in duration-700" />
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-2">
          <span className="text-gradient">T-GPT</span> Website Builder
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Describe your site and T-GPT writes the HTML, CSS, and JS for you. Each build uses 1 credit (5 free per day).
        </p>
        <Button onClick={newSite} size="lg" className="mt-6 bg-gradient-brand text-primary-foreground border-0 shadow-glow font-semibold px-8">
          <Plus className="h-4 w-4 mr-2" /> New website chat
        </Button>
      </div>

      <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
        <Wand2 className="h-5 w-5 text-primary" /> Your saved builds
      </h2>
      {threads.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
          No builds yet. Click <strong>New website chat</strong> to start.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {threads.map((t) => (
            <div key={t.id} className="relative group">
              <Link to="/builder/$threadId" params={{ threadId: t.id }}
                className="block rounded-xl border border-border bg-card/60 p-4 hover:border-primary/40 hover:bg-card transition">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-sm truncate pr-8">{t.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(t.updated_at).toLocaleDateString()}
                </p>
              </Link>
              <button
                onClick={(e) => deleteBuild(t.id, e)}
                className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition"
                aria-label="Delete build"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
