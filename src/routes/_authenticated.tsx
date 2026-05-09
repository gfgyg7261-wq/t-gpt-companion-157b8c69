import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MessageSquare, Trash2, LogOut, Menu, X, Search, Pencil, MoreHorizontal, User } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/tgpt-logo.png";

type ThreadRow = { id: string; title: string; updated_at: string };

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [email, setEmail] = useState<string>("");
  const path = useRouterState({ select: (s) => s.location.pathname });

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: async (): Promise<ThreadRow[]> => {
      const { data, error } = await supabase
        .from("threads")
        .select("id,title,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const filtered = useMemo(
    () =>
      query.trim()
        ? (Array.isArray(threads) ? threads : []).filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
        : Array.isArray(threads) ? threads : [],
    [threads, query],
  );

  const handleNew = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Please sign in again.");
      const { data: t, error } = await supabase
        .from("threads")
        .insert({ user_id: userData.user.id, title: "New chat" })
        .select("id,title,updated_at")
        .single();
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start a new chat");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("threads").delete().eq("id", id);
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["threads"] });
      if (path.includes(id)) navigate({ to: "/chat" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const startRename = (id: string, current: string) => {
    setRenamingId(id);
    setRenameValue(current);
  };

  const commitRename = async () => {
    if (!renamingId) return;
    const title = renameValue.trim();
    if (!title) {
      setRenamingId(null);
      return;
    }
    try {
      const { error } = await supabase.from("threads").update({ title }).eq("id", renamingId);
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["threads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setRenamingId(null);
    }
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

          <div className="px-3 pb-2">
            <Button onClick={handleNew} className="w-full bg-gradient-brand text-primary-foreground border-0 shadow-glow font-semibold">
              <Plus className="h-4 w-4 mr-1" /> New chat
            </Button>
          </div>

          <div className="px-3 pb-2 relative">
            <Search className="h-3.5 w-3.5 absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats..."
              className="h-8 pl-8 text-sm bg-sidebar-accent/40 border-sidebar-border"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {query ? "No matches." : "No conversations yet."}
              </p>
            )}
            {filtered.map((t) => {
              const active = path.includes(t.id);
              const isRenaming = renamingId === t.id;
              return (
                <div
                  key={t.id}
                  className={`group relative flex items-center rounded-md ${active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"}`}
                >
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="flex-1 bg-transparent border border-primary/40 rounded px-2 py-1.5 text-sm mx-1 outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <Link
                      to="/chat/$threadId"
                      params={{ threadId: t.id }}
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-sm truncate min-w-0"
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{t.title}</span>
                    </Link>
                  )}
                  {!isRenaming && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-foreground transition"
                          aria-label="Chat options"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => startRename(t.id, t.title)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-sidebar-border p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-sidebar-accent/60 text-left">
                  <div className="h-8 w-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {(email || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{email || "Account"}</p>
                    <p className="text-[10px] text-muted-foreground">Free plan</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled>
                  <User className="h-3.5 w-3.5 mr-2" /> {email || "Signed in"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
