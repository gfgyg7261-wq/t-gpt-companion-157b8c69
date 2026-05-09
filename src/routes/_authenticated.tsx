import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listThreads, createThread, deleteThread } from "@/lib/chat.functions";
type ThreadParam = { threadId: string };
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, LogOut, Menu, X } from "lucide-react";
import logo from "@/assets/tgpt-logo.png";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const path = useRouterState({ select: (s) => s.location.pathname });

  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const del = useServerFn(deleteThread);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: () => list(),
  });

  const handleNew = async () => {
    const t = await create({ data: {} });
    qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/c/$threadId", params: { threadId: t.id } });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["threads"] });
    if (path.includes(id)) navigate({ to: "/" });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setOpen(false);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${open ? "w-72" : "w-0"} shrink-0 transition-[width] duration-300 overflow-hidden bg-sidebar border-r border-sidebar-border`}
      >
        <div className="flex h-full w-72 flex-col">
          <div className="flex items-center justify-between p-4">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="T-GPT" className="h-8 w-8" width={32} height={32} />
              <span className="font-display text-lg font-bold text-gradient">T-GPT</span>
            </Link>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-3 pb-3">
            <Button onClick={handleNew} className="w-full bg-gradient-brand text-primary-foreground border-0 shadow-glow font-semibold">
              <Plus className="h-4 w-4 mr-1" /> New chat
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {threads.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No conversations yet.
              </p>
            )}
            {threads.map((t) => {
              const active = path.includes(t.id);
              return (
                <div
                  key={t.id}
                  className={`group relative flex items-center rounded-md ${active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"}`}
                >
                  <Link
                    to="/c/$threadId"
                    params={{ threadId: t.id }}
                    className="flex-1 flex items-center gap-2 px-3 py-2 text-sm truncate min-w-0"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{t.title}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(t.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-sidebar-border p-3">
            <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start text-sm">
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {!open && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(true)}
            className="absolute top-3 left-3 z-20"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <Outlet />
      </main>
    </div>
  );
}
