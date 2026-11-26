"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Library, LogIn, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

interface HeaderProps {
  /** Optional seed from server; client will still sync live auth state */
  user?: { id?: string; email?: string; displayName?: string; avatarUrl?: string } | null;
  showLibrary?: boolean;
}

export function Header({ user: seedUser, showLibrary = true }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(
    seedUser?.id ? ({ id: seedUser.id, email: seedUser.email } as User) : null
  );
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
      // Keep server components in sync after OAuth
      router.refresh();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase.auth, router]);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    toast.success("Signed out");
    window.location.assign("/");
  }

  const isSignedIn = !!user;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-[var(--paper)]/80 backdrop-blur-md dark:border-slate-800/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline">StudyBuddy AI</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/#how-it-works"
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              How it works
            </Link>
            {showLibrary && isSignedIn && (
              <Link
                href="/library"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <Library className="h-3.5 w-3.5" />
                Library
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {authReady && isSignedIn ? (
            <>
              <Link href="/studio">
                <Button size="sm" className="hidden sm:inline-flex">
                  Open Studio
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="hidden gap-1.5 sm:inline-flex"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
              <span className="hidden max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400 md:inline">
                {user?.email}
              </span>
            </>
          ) : authReady ? (
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <LogIn className="h-4 w-4" />
                Sign in
              </Button>
            </Link>
          ) : null}

          <button
            type="button"
            aria-label="Menu"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 md:hidden dark:text-slate-200"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "border-t border-slate-200 dark:border-slate-800 md:hidden",
          mobileOpen ? "block" : "hidden"
        )}
      >
        <div className="space-y-1 px-4 py-3">
          <Link
            href="/studio"
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
            onClick={() => setMobileOpen(false)}
          >
            Studio
          </Link>
          {isSignedIn && (
            <Link
              href="/library"
              className="block rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
              onClick={() => setMobileOpen(false)}
            >
              Library
            </Link>
          )}
          {isSignedIn ? (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                signOut();
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="block rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
              onClick={() => setMobileOpen(false)}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
