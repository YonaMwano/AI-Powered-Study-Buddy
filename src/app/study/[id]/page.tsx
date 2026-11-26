"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  HelpCircle,
  Layers,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExplainerView } from "@/components/study/explainer-view";
import { QuizView } from "@/components/study/quiz-view";
import { FlashcardsView } from "@/components/study/flashcards-view";
import { ExportMenu } from "@/components/study/export-menu";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Study } from "@/types";

type Tab = "explainer" | "quiz" | "flashcards";

export default function StudyViewerPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useUser();

  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("explainer");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/studies/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setStudy(data.study);
      })
      .catch(() => {
        toast.error("Could not load study");
        router.push("/studio");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  function copyPlainText() {
    if (!study) return;
    const lines: string[] = [];
    lines.push(study.title);
    lines.push("");
    lines.push("EXPLAINER");
    lines.push("─────────");
    for (const s of study.explainer.sections) {
      lines.push(s.heading);
      for (const p of s.body) lines.push(p);
      if (s.keyPoints?.length) {
        lines.push("Key points:");
        for (const k of s.keyPoints) lines.push("• " + k);
      }
      lines.push("");
    }
    lines.push("QUIZ");
    lines.push("────");
    study.quiz.questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.prompt}`);
      if (q.options) q.options.forEach((o, j) => lines.push(`   ${String.fromCharCode(65 + j)}. ${o}`));
      lines.push(`   Answer: ${q.answer}`);
      if (q.explanation) lines.push(`   ${q.explanation}`);
      lines.push("");
    });
    lines.push("FLASHCARDS");
    lines.push("──────────");
    for (const c of study.flashcards.cards) {
      lines.push(`${c.front} — ${c.back}`);
    }
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Copied as plain text");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen paper">
        <Header user={user} />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  if (!study) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "explainer", label: "Explainer", icon: <BookOpen className="h-4 w-4" /> },
    { id: "quiz", label: "Quiz", icon: <HelpCircle className="h-4 w-4" /> },
    { id: "flashcards", label: "Flashcards", icon: <Layers className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen paper pb-24">
      <Header user={user} />

      <div className="border-b border-slate-200/80 bg-white/50 dark:border-slate-800/80 dark:bg-slate-950/30">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <div className="mb-4 flex items-center gap-2">
            <Link href="/library">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Library
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                {study.title}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="default">{study.difficulty}</Badge>
                {study.has_diagrams && <Badge variant="secondary">Diagrams</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyPlainText} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy text
              </Button>
              {/* Export buttons wired in Group 4 */}
              <ExportMenu studyId={study.id} title={study.title} />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1 border-b border-transparent">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {tab === "explainer" && <ExplainerView explainer={study.explainer} />}
        {tab === "quiz" && <QuizView quiz={study.quiz} />}
        {tab === "flashcards" && (
          <FlashcardsView flashcards={study.flashcards} />
        )}
      </main>
    </div>
  );
}
