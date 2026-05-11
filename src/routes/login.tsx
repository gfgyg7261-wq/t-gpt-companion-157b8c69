import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/tgpt-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — T-GPT" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [adminMode, setAdminMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const getAuthMessage = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes("weak_password") || lower.includes("weak") || lower.includes("pwned")) {
      return "That password is too common or leaked. Use a stronger unique password with letters, numbers, and symbols.";
    }
    if (lower.includes("invalid login credentials")) {
      return "Email or password is wrong. If you registered with Google, use Continue with Google.";
    }
    if (lower.includes("already registered") || lower.includes("already exists")) {
      return "This email already has an account. Sign in instead, or continue with Google.";
    }
    return message;
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setAuthError("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        // Auto-confirm is enabled, so a session should exist immediately
        if (data.session) {
          toast.success("Welcome to T-GPT!");
          navigate({ to: "/" });
        } else {
          toast.success("Account created! Check your email to confirm, then sign in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (adminMode) {
          // Verify admin role
          const { data: u } = await supabase.auth.getUser();
          const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", u.user!.id).eq("role", "admin").maybeSingle();
          if (!role) {
            setAuthError("This account is not an admin.");
            await supabase.auth.signOut();
            return;
          }
          toast.success("Welcome, admin");
          navigate({ to: "/admin" });
        } else {
          toast.success("Welcome back!");
          navigate({ to: "/" });
        }
      }
    } catch (err: unknown) {
      const msg = getAuthMessage(err instanceof Error ? err.message : "Something went wrong");
      setAuthError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };


  const handleGoogle = async () => {
    setLoading(true);
    setAuthError("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      setAuthError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-3 mb-8">
          <img src={logo} alt="T-GPT" className="h-12 w-12" width={48} height={48} />
          <span className="font-display text-3xl font-bold text-gradient">T-GPT</span>
        </Link>

        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-glow">
          <h1 className="font-display text-2xl font-bold mb-1">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" ? "Sign in to chat with T-GPT" : "Start chatting with T-GPT in seconds"}
          </p>

          <Button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            variant="outline"
            className="w-full h-11 font-medium gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
              {mode === "signup" && (
                <p className="mt-1 text-xs text-muted-foreground">Use a strong unique password, not a common or leaked one.</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-brand text-primary-foreground border-0 shadow-glow font-semibold"
            >
              {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {authError && (
            <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {authError}
            </p>
          )}

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "No account?" : "Already have one?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary hover:underline font-medium"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>

          {mode === "signin" && (
            <div className="mt-3 pt-3 border-t border-border text-center">
              <button
                type="button"
                onClick={() => setAdminMode((v) => !v)}
                className={`text-xs font-medium ${adminMode ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                {adminMode ? "✓ Admin mode — sign in to open Admin Panel" : "Admin login →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
