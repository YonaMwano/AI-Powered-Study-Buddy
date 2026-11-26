"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Paperclip,
  Sparkles,
  Loader2,
  File,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UploadGateModal } from "@/components/studio/upload-gate-modal";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Difficulty } from "@/types";

type Step =
  | "idle"
  | "ingesting"
  | "analyzing"
  | "generating"
  | "illustrating"
  | "ready";

const STEP_LABELS: Record<Step, string> = {
  idle: "",
  ingesting: "Reading…",
  analyzing: "Understanding…",
  generating: "Writing quiz & flashcards…",
  illustrating: "Drawing diagrams…",
  ready: "Ready",
};

function StudioInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [text, setText] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [includeDiagrams, setIncludeDiagrams] = useState(false);
  const [includeFlashcardImages, setIncludeFlashcardImages] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    // After Google OAuth, session may land a tick later — refresh until ready
    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setUser({ id: data.session.user.id, email: data.session.user.email });
      }
    };
    sync();
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("auth") === "success") {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", url.pathname + url.search);
      // Ensure server components see the session
      router.refresh();
      toast.success("Signed in");
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase.auth, router]);

  useEffect(() => {
    if (searchParams.get("pendingUpload") === "1" && user) {
      setTimeout(() => fileInputRef.current?.click(), 400);
      const url = new URL(window.location.href);
      url.searchParams.delete("pendingUpload");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams, user]);

  const onUploadClick = () => {
    if (!user) {
      setGateOpen(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    if (!user) {
      setGateOpen(true);
      return;
    }
    setSelectedFileName(file.name);
    setStep("ingesting");
    setPreview("");
    setDocumentId(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setDocumentId(data.documentId);
      setPreview(data.extractedTextPreview || "");
      setText(data.extractedTextPreview || "");

      if (data.hasImages) {
        setStep("analyzing");
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: data.documentId }),
        });
        const analyzeData = await analyzeRes.json();
        if (analyzeRes.ok && analyzeData.text) {
          setPreview(analyzeData.text.slice(0, 600));
          setText(analyzeData.text.slice(0, 4000));
        }
      }
      setStep("ready");
      toast.success("File processed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setStep("idle");
      setSelectedFileName(null);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const runTextIngest = async (): Promise<string | null> => {
    const form = new FormData();
    form.append("text", text.trim());
    const res = await fetch("/api/ingest", { method: "POST", body: form });
    let data: { error?: string; detail?: string; documentId?: string } = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      // Document may still have been written; do not hard-block generation
      const msg = [data.error, data.detail].filter(Boolean).join(" — ");
      console.warn("ingest warning", msg);
      // Return null so onGenerate can still run with raw text
      if (!data.documentId) {
        // Soft-fail: generation path sends text directly
        return null;
      }
    }
    return (data.documentId as string) || null;
  };

  const onGenerate = async () => {
    if (!text.trim() && !documentId) {
      toast.error("Paste some text or upload a file first");
      return;
    }
    try {
      let docId = documentId;
      if (!docId && text.trim()) {
        setStep("ingesting");
        docId = await runTextIngest();
        if (docId) setDocumentId(docId);
      }
      // Generation works with text alone (document row is optional for guests)
      if (!docId && !text.trim()) {
        throw new Error("Paste some text or upload a file first");
      }

      setStep("generating");

      // Always send text + documentId so generation works even if document
      // re-read is blocked (guest RLS). user_id NULL in DB is normal for guests.
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: docId || undefined,
          text: text.trim() || undefined,
          difficulty,
          includeDiagrams,
          includeFlashcardImages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "GUEST_LIMIT") {
          toast.error(data.error, {
            action: {
              label: "Sign in",
              onClick: () => router.push("/login?next=/studio"),
            },
          });
        } else {
          const msg = [data.error, data.detail].filter(Boolean).join(" — ");
          throw new Error(msg || "Generation failed");
        }
        setStep("ready");
        return;
      }

      toast.success("Study ready");
      router.push(`/study/${data.studyId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setStep("idle");
    }
  };

  const focusTextarea = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  const busy =
    step === "ingesting" ||
    step === "analyzing" ||
    step === "generating" ||
    step === "illustrating";

  return (
    <div className="min-h-screen paper">
      <Header user={user} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Studio</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Paste text or upload a file to generate your study set
            </p>
          </div>
          <Link href="/library">
            <Button variant="outline" size="sm">Library</Button>
          </Link>
        </div>

        {/* Progress strip */}
        {busy && (
          <div className="mb-6 overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/30">
            <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              {STEP_LABELS[step]}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900/50">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-500" />
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                Your material
                {selectedFileName && (
                  <Badge variant="secondary" className="font-normal">
                    <File className="mr-1 h-3 w-3" />
                    {selectedFileName}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                ref={textareaRef}
                placeholder="Paste lecture notes, textbook excerpts, or any study material here…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[280px] resize-y font-mono text-sm"
                disabled={busy}
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.jpg,.jpeg,.png,.webp"
                  onChange={onFileChange}
                />
                <Button variant="outline" size="sm" onClick={onUploadClick} disabled={busy}>
                  <Paperclip className="h-4 w-4" />
                  Upload
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    setText(
                      "Photosynthesis is the process by which green plants and some other organisms use sunlight to synthesize foods with the help of chlorophyll. It occurs in two stages: the light-dependent reactions and the Calvin cycle (light-independent reactions). In the light reactions, energy from light is used to split water, releasing oxygen and forming ATP and NADPH. The Calvin cycle uses these products to fix carbon dioxide into glucose. Chloroplasts are the organelles where photosynthesis takes place. The overall chemical equation is 6CO2 + 6H2O + light energy → C6H12O6 + 6O2."
                    )
                  }
                >
                  Use sample
                </Button>
              </div>
              {preview && step === "ready" && (
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                  Preview: {preview.slice(0, 280)}…
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit lg:sticky lg:top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Generate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <div className="flex flex-wrap gap-2">
                  {(["beginner", "intermediate", "advanced"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        difficulty === d
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex cursor-pointer items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300">Diagrams</span>
                  <input
                    type="checkbox"
                    checked={includeDiagrams}
                    onChange={(e) => setIncludeDiagrams(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    disabled={!user}
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300">Flashcard images</span>
                  <input
                    type="checkbox"
                    checked={includeFlashcardImages}
                    onChange={(e) => setIncludeFlashcardImages(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    disabled={!user}
                  />
                </label>
                {!user && (
                  <p className="text-xs text-slate-400">Sign in to enable illustrations</p>
                )}
              </div>

              <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                {user ? (
                  <p className="flex items-center gap-2">
                    <Badge variant="success">Signed in</Badge>
                    Unlimited
                  </p>
                ) : (
                  <p className="flex items-center gap-2">
                    <Badge variant="secondary">Guest</Badge>
                    1 free generation per 24h
                  </p>
                )}
              </div>

              <Button
                className="w-full gap-2"
                size="lg"
                disabled={(!text.trim() && !documentId) || busy}
                onClick={onGenerate}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {STEP_LABELS[step] || "Working…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate study set
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <UploadGateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        onContinuePasting={focusTextarea}
      />
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen paper" />}>
      <StudioInner />
    </Suspense>
  );
}
