import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/tgpt-logo.png";

export const Route = createFileRoute("/admin-login")({
  validateSearch: (search) => ({
    redirect: typeof search.redirect === "string" && search.redirect.startsWith("/") ? search.redirect : "/admin",
  }),
  component: AdminLogin,
  head: () => ({ meta: [{ title: "Admin sign in — T-GPT" }] }),
});

function AdminLogin() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
      if (r) navigate({ to: redirect });
    });
  }, [navigate, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) throw signErr;
      const { data: u } = await supabase.auth.getUser();
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user!.id).eq("role", "admin").maybeSingle();
      if (!r) {
        await supabase.auth.signOut();
        throw new Error("This account is not an admin.");
      }
      toast.success("Welcome, admin");
      navigate({ to: redirect });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="h-3 w-3" /> Back to T-GPT
        </Link>
        <div className="bg-card/80 backdrop-blur-xl border border-primary/30 rounded-2xl p-8 shadow-glow">
          <div className="flex items-center gap-3 mb-6">
            <img src={logo} alt="" className="h-10 w-10" />
            <div>
              <h1 className="font-display text-2xl font-bold flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" /> Admin Portal
              </h1>
              <p className="text-xs text-muted-foreground">Restricted access — admin credentials required.</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="ae">Email</Label>
              <Input id="ae" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="ap">Password</Label>
              <Input id="ap" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-brand text-primary-foreground border-0 shadow-glow font-semibold">
              {loading ? "Signing in…" : "Enter Admin Panel"}
            </Button>
          </form>
          {error && (
            <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
