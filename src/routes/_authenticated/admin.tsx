import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, ShieldAlert, Trash2, Plus, Minus, UserCog, MessageSquare, Wand2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/tgpt-logo.png";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!roles) throw redirect({ to: "/chat" });
  },
  component: AdminPanel,
});

type ProfileRow = { id: string; display_name: string | null; created_at: string };
type CreditRow = { user_id: string; balance: number };

function AdminPanel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase.from("profiles").select("id,display_name,created_at").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: credits = [] } = useQuery({
    queryKey: ["admin-credits"],
    queryFn: async (): Promise<CreditRow[]> => {
      const { data, error } = await supabase.from("credits").select("user_id,balance");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: threads = [] } = useQuery({
    queryKey: ["admin-threads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("threads").select("id,title,user_id,updated_at").order("updated_at", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const { data: builds = [] } = useQuery({
    queryKey: ["admin-builds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("builder_threads").select("id,title,user_id,updated_at").order("updated_at", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const adjustCredits = async (userId: string, delta: number) => {
    const cur = credits.find((c) => c.user_id === userId)?.balance ?? 0;
    const next = Math.max(0, cur + delta);
    const { error } = await supabase.from("credits").update({ balance: next, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success(`Set to ${next} credits`);
    qc.invalidateQueries({ queryKey: ["admin-credits"] });
  };

  const setCreditsTo = async (userId: string, value: number) => {
    const { error } = await supabase.from("credits").upsert({ user_id: userId, balance: value, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success(`Credits set to ${value}`);
    qc.invalidateQueries({ queryKey: ["admin-credits"] });
  };

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    if (isAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("Admin removed");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("Made admin");
    }
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
  };

  const deleteThread = async (id: string) => {
    if (!confirm("Delete this chat thread?")) return;
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-threads"] });
  };
  const deleteBuild = async (id: string) => {
    if (!confirm("Delete this builder project?")) return;
    const { error } = await supabase.from("builder_threads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-builds"] });
  };

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return !q || (p.display_name ?? "").toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
  });

  const adminIds = new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id));
  const balanceOf = (uid: string) => credits.find((c) => c.user_id === uid)?.balance ?? 0;
  const nameOf = (uid: string) => profiles.find((p) => p.id === uid)?.display_name ?? uid.slice(0, 8);

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate({ to: "/chat" })}><ArrowLeft className="h-4 w-4" /></Button>
          <img src={logo} alt="" className="h-8 w-8" />
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-primary" /> Admin Panel
            </h1>
            <p className="text-xs text-muted-foreground">Full control over T-GPT users, credits, and chats.</p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users"><UserCog className="h-3.5 w-3.5 mr-1" /> Users & Credits</TabsTrigger>
          <TabsTrigger value="chats"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Chat threads</TabsTrigger>
          <TabsTrigger value="builds"><Wand2 className="h-3.5 w-3.5 mr-1" /> Builder projects</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-3">
          <Input placeholder="Search by name or user id…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Role</th>
                  <th className="text-left p-2">Credits</th>
                  <th className="text-right p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isAdmin = adminIds.has(p.id);
                  const bal = balanceOf(p.id);
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                      <td className="p-2">
                        <p className="font-medium">{p.display_name ?? "—"}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{p.id}</p>
                      </td>
                      <td className="p-2">
                        {isAdmin ? <span className="text-primary font-bold">Admin</span> : "User"}
                      </td>
                      <td className="p-2 font-mono">{bal}</td>
                      <td className="p-2 text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => adjustCredits(p.id, -1)}><Minus className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => adjustCredits(p.id, 1)}><Plus className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const v = prompt("Set credits to:", String(bal));
                          if (v !== null) setCreditsTo(p.id, Math.max(0, parseInt(v) || 0));
                        }}>Set</Button>
                        <Button size="sm" variant={isAdmin ? "destructive" : "default"} onClick={() => toggleAdmin(p.id, isAdmin)}>
                          {isAdmin ? "Demote" : "Make admin"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="chats" className="mt-4">
          <div className="border border-border rounded-xl divide-y divide-border">
            {threads.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 hover:bg-muted/20">
                <div>
                  <p className="font-medium text-sm">{t.title}</p>
                  <p className="text-[10px] text-muted-foreground">{nameOf(t.user_id)} · {new Date(t.updated_at).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteThread(t.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            {threads.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No chat threads.</p>}
          </div>
        </TabsContent>

        <TabsContent value="builds" className="mt-4">
          <div className="border border-border rounded-xl divide-y divide-border">
            {builds.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 hover:bg-muted/20">
                <div>
                  <p className="font-medium text-sm">{b.title}</p>
                  <p className="text-[10px] text-muted-foreground">{nameOf(b.user_id)} · {new Date(b.updated_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-1">
                  <Link to="/builder/$threadId" params={{ threadId: b.id }}>
                    <Button size="sm" variant="outline">Open</Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => deleteBuild(b.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
            {builds.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No builder projects.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
