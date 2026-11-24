import Link from "next/link";
import {
  BookOpen,
  FileText,
  Sparkles,
  Layers,
  Download,
  ArrowRight,
  CheckCircle2,
  Upload,
  Brain,
  Zap,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-screen paper">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent dark:from-indigo-950/30" />
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
              AI study companion for 2026
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl lg:text-6xl">
              Turn any notes into{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
                clear explanations
              </span>
              , quizzes & flashcards
            </h1>
            <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">
              Paste text or upload PDFs, scans, slides and Word docs. Get
              structured learning materials you can export to PDF, PPTX or DOCX
              — no markdown mess.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/studio">
                <Button size="lg" className="gap-2">
                  Start studying free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="outline" size="lg">
                  How it works
                </Button>
              </a>
            </div>
          </div>

          {/* Demo paste box teaser */}
          <div className="mx-auto mt-14 max-w-2xl">
            <Card className="overflow-hidden border-slate-200/80 shadow-lg dark:border-slate-800">
              <CardContent className="p-0">
                <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <FileText className="h-3.5 w-3.5" />
                    Paste or drop any material
                  </div>
                </div>
                <div className="p-4">
                  <div className="min-h-[100px] rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-950">
                    Paste lecture notes, textbook excerpts, or upload a PDF…
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Upload className="h-3.5 w-3.5" />
                      PDF · DOCX · PPTX · Images
                    </div>
                    <Link href="/studio">
                      <Button size="sm">Generate</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Bento features */}
      <section id="how-it-works" className="border-t border-slate-200/80 py-20 dark:border-slate-800/80">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              From messy input to polished study set
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Three clean artifacts, one click. Server-side rendering keeps every
              export pixel-perfect.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Brain className="h-5 w-5" />}
              title="Simple explanations"
              description="Structured sections with key points. No markdown leakage. Optional diagrams when you want them."
            />
            <FeatureCard
              icon={<Layers className="h-5 w-5" />}
              title="Smart quizzes"
              description="MCQ, true/false and short-answer. Instant feedback with clear explanations."
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Flashcards"
              description="Front/back cards ready for review. Optional AI illustrations for visual memory."
            />
            <FeatureCard
              icon={<FileText className="h-5 w-5" />}
              title="Any source"
              description="Typed PDF, scanned pages, photos, Word, PowerPoint or plain text. We extract and normalize."
            />
            <FeatureCard
              icon={<Download className="h-5 w-5" />}
              title="Export cleanly"
              description="PDF, PPTX and DOCX generated on the server with consistent typography and page breaks."
            />
            <FeatureCard
              icon={<BookOpen className="h-5 w-5" />}
              title="Your library"
              description="Sign in once. Every study is saved, searchable and ready to re-export anytime."
            />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="border-t border-slate-200/80 bg-white/50 py-20 dark:border-slate-800/80 dark:bg-slate-950/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Three steps to better notes
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <Step
              number="01"
              title="Paste or upload"
              description="Drop a PDF, photo of notes, slides or just type. Guests can try text once; sign in for uploads and history."
            />
            <Step
              number="02"
              title="Generate"
              description="Choose difficulty. Optionally enable diagrams. The AI returns strict JSON — we never render raw markdown."
            />
            <Step
              number="03"
              title="Study & export"
              description="Read the explainer, take the quiz, flip flashcards. Download PDF, PPTX or DOCX with one click."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200/80 py-20 dark:border-slate-800/80">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Ready to study smarter?
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            No credit card. One free generation as guest. Unlimited when you sign in.
          </p>
          <div className="mt-8">
            <Link href="/studio">
              <Button size="lg" className="gap-2">
                Open Studio
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Clean exports
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Dark mode
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Privacy-first RLS
            </li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-10 dark:border-slate-800/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <BookOpen className="h-4 w-4" />
            StudyBuddy AI
          </div>
          <p className="text-xs text-slate-400">
            Built for calm, focused learning. No AI-slop formatting.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardContent className="p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400 dark:group-hover:bg-indigo-900/40">
          {icon}
        </div>
        <h3 className="font-semibold text-slate-900 dark:text-slate-50">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative">
      <span className="text-4xl font-bold text-indigo-100 dark:text-indigo-950">
        {number}
      </span>
      <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}
