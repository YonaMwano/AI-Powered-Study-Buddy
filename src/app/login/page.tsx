"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, Mail, Loader2 } from "lucide-react";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/studio";
  const pendingUpload = searchParams.get("pendingUpload") === "1";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"google" | "email" | null>(null);

  const supabase = createClient();

  async function signInWithGoogle() {
    setLoading("google");
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);
    if (pendingUpload) redirectTo.searchParams.set("pendingUpload", "1");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
    if (error) {
      toast.error(error.message);
      setLoading(null);
    }
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password required");
      return;
    }
    setLoading("email");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg =
        error.message.toLowerCase().includes("email not confirmed")
          ? "Confirm your email first (check inbox / spam), or disable email confirmations in Supabase Auth settings."
          : error.message.toLowerCase().includes("invalid login")
            ? "Invalid email or password"
            : error.message;
      toast.error(msg);
      setLoading(null);
      return;
    }
    toast.success("Signed in");
    const target = pendingUpload ? `${next}?pendingUpload=1` : next;
    // Full navigation so session cookies are applied everywhere
    window.location.assign(target);
  }

  return (
    <div className="paper flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            StudyBuddy AI
          </Link>

          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Save your studies and unlock file uploads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorParam && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
                  Authentication failed. Please try again.
                </p>
              )}

              <Button variant="outline" className="w-full gap-2" onClick={signInWithGoogle} disabled={!!loading}>
                {loading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[var(--paper)] px-2 text-slate-500 dark:text-slate-400">or</span>
                </div>
              </div>

              <form onSubmit={signInWithEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={!!loading}>
                  {loading === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Sign in with email
                </Button>
              </form>

              <p className="text-center text-xs text-slate-500">
                No account?{" "}
                <Link href="/signup" className="text-indigo-600 hover:underline dark:text-indigo-400">Sign up</Link>
                {" · "}
                <Link href="/studio" className="text-indigo-600 hover:underline dark:text-indigo-400">Continue as guest</Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="hidden bg-gradient-to-br from-indigo-600 to-violet-700 lg:flex lg:w-1/2 lg:items-center lg:justify-center">
        <div className="max-w-md px-8 text-white">
          <h2 className="text-3xl font-semibold">Keep every study</h2>
          <p className="mt-3 text-indigo-100">
            Sign in once. Your explanations, quizzes and flashcards stay in your library — ready to export whenever you need them.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="paper min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
