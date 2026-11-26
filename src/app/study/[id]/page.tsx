"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  HelpCircle,
  Layers,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExplainerView } from "@/components/study/explainer-view";
import { QuizView } from "@/components/study/quiz-view";
import { FlashcardsView } from "@/components/study/flashcards-view";
import { ExportMenu } from "@/components/study/export-menu";
import { toast } from "sonner";
import type { Study } from "@/types";
import { cn } from "@/lib/utils";

type Tab = "explainer" | "quiz" | "flashcards";

export default function StudyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("explainer");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/studies/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load study");
        if (!cancelled) setStudy(data.study);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function copyPlainText() {
    if (!study) return;
    const lines: string[] = [];
    lines.push(study.title);
    lines.push("");
    lines.push("EXPLAINER");
    for (const sec of study.explainer?.sections ?? []) {
      lines.push("");
      lines.push(sec.heading);
      for (const p of sec.body || []) lines.push(p);
      if (sec.keyPoints?.length) {
        lines.push("Key points:");
        for (const k of sec.keyPoints) lines.push(`• ${k}`);
      }
    }
    lines.push("");
    lines.push("QUIZ");
    (study.quiz?.questions ?? []).forEach((q, i) => {
      lines.push("");
      lines.push(`${i + 1}. ${q.prompt}`);
      (q.options || []).forEach((o, j) =>
        lines.push(`   ${String.fromCharCode(65 + j)}. ${o}`)
      );
      lines.push(`Answer: ${q.answer}`);
    });
    lines.push("");
    lines.push("FLASHCARDS");
    for (const c of study.flashcards?.cards ?? []) {
      lines.push(`${c.front} — ${c.back}`);
    }
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        toast.success("Copied as plain text");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Copy failed")
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen paper">
        <Header />
        <div className="flex items-center justify-center py-32 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading study…
        </div>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="min-h-screen paper">
        <Header />
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <p className="text-lg font-medium text-slate-900 dark:text-slate-100">
            {error || "Study not found"}
          </p>
          <Button className="mt-6" onClick={() => router.push("/studio")}>
            Back to Studio
          </Button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "explainer", label: "Explainer", icon: <BookOpen className="h-4 w-4" /> },
    { id: "quiz", label: "Quiz", icon: <HelpCircle className="h-4 w-4" /> },
    { id: "flashcards", label: "Flashcards", icon: <Layers className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen paper">
      <Header />
      <div className="sticky top-14 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-[#0B0E14]/90">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link
            href="/library"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Library
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">
              {study.title}
            </h1>
          </div>
          <Badge variant="secondary" className="capitalize">
            {study.difficulty}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={copyPlainText}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy text
          </Button>
          <ExportMenu studyId={id} title={study.title} />
        </div>
        <div className="mx-auto flex max-w-5xl gap-1 px-4 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {tab === "explainer" && <ExplainerView explainer={study.explainer} />}
        {tab === "quiz" && <QuizView quiz={study.quiz} />}
        {tab === "flashcards" && <FlashcardsView flashcards={study.flashcards} />}
      </main>
    </div>
  );
}
