"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, Image, Trash2, Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

interface StudyListItem {
  id: string;
  title: string;
  difficulty: string;
  created_at: string;
  has_diagrams: boolean;
  documents?: { source_type?: string; original_filename?: string } | null;
}

export default function LibraryPage() {
  const { user, loading: authLoading } = useUser();
  const [studies, setStudies] = useState<StudyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/studies")
      .then((r) => r.json())
      .then((data) => setStudies(data.studies || []))
      .catch(() => toast.error("Failed to load library"))
      .finally(() => setLoading(false));
  }, []);

  async function deleteStudy(id: string) {
    if (!confirm("Delete this study?")) return;
    const res = await fetch(`/api/studies/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStudies((s) => s.filter((x) => x.id !== id));
      toast.success("Deleted");
    } else {
      toast.error("Could not delete");
    }
  }

  const filtered = studies.filter((s) => {
    if (filter === "all") return true;
    const st = s.documents?.source_type || "text";
    if (filter === "pdfs") return st.startsWith("pdf");
    if (filter === "scans") return st === "pdf_scan" || st === "image";
    if (filter === "slides") return st === "pptx";
    if (filter === "images") return st === "image";
    return true;
  });

  return (
    <div className="min-h-screen paper">
      <Header user={user} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Library</h1>
            <p className="text-sm text-slate-500">Your saved studies</p>
          </div>
          <Link href="/studio">
            <Button>New study</Button>
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {["all", "pdfs", "scans", "slides", "images"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {authLoading || loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <BookOpen className="h-10 w-10 text-slate-300" />
              <p className="text-slate-600 dark:text-slate-400">
                {user ? "No studies yet. Generate your first one in Studio." : "Sign in or generate as guest to see studies here."}
              </p>
              <Link href="/studio">
                <Button>Open Studio</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <Card key={s.id} className="group relative transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                      {(s.documents?.source_type || "").includes("image") ||
                      s.documents?.source_type === "pdf_scan" ? (
                        <Image className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </div>
                    {user && (
                      <button
                        type="button"
                        onClick={() => deleteStudy(s.id)}
                        className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/30"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Link href={`/study/${s.id}`}>
                    <h3 className="line-clamp-2 font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-50 dark:hover:text-indigo-400">
                      {s.title}
                    </h3>
                  </Link>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{s.difficulty}</Badge>
                    {s.has_diagrams && <Badge variant="default">Diagrams</Badge>}
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
