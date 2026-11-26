"use client";

import { useState } from "react";
import {
  Download,
  FileText,
  Presentation,
  FileType,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ExportFormat } from "@/types";

const FORMATS: {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "pdf",
    label: "PDF",
    description: "Printable study packet",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    id: "docx",
    label: "Word (DOCX)",
    description: "Editable document",
    icon: <FileType className="h-5 w-5" />,
  },
  {
    id: "pptx",
    label: "PowerPoint",
    description: "Slides for review",
    icon: <Presentation className="h-5 w-5" />,
  },
];

function saveBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

export function ExportMenu({
  studyId,
  title,
}: {
  studyId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportFormat | null>(null);

  async function exportFormat(format: ExportFormat) {
    setLoading(format);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyId, format, delivery: "binary" }),
      });

      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        // Error responses are JSON
        let message = "Export failed";
        try {
          const data = await res.json();
          message = data.error || message;
        } catch {
          message = `Export failed (${res.status})`;
        }
        throw new Error(message);
      }

      // Binary file response
      if (
        contentType.includes("application/pdf") ||
        contentType.includes("officedocument") ||
        contentType.includes("presentationml") ||
        contentType.includes("octet-stream")
      ) {
        const blob = await res.blob();
        if (blob.size < 32) throw new Error("Export produced an empty file");
        const filename =
          res.headers
            .get("content-disposition")
            ?.match(/filename="?([^";]+)"?/)?.[1] ||
          `${title.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.${format}`;
        saveBlob(blob, filename);
        toast.success(`${format.toUpperCase()} ready`);
        setOpen(false);
        return;
      }

      // Fallback JSON with data URL
      const data = await res.json();
      if (!data.signedUrl) throw new Error(data.error || "No file returned");
      const blobRes = await fetch(data.signedUrl);
      const blob = await blobRes.blob();
      saveBlob(blob, data.filename || `study.${format}`);
      toast.success(`${format.toUpperCase()} ready`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Download className="h-4 w-4" />
        Download
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export study</DialogTitle>
            <DialogDescription>
              Download a clean PDF, Word, or PowerPoint file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={!!loading}
                onClick={() => exportFormat(f.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  {loading === f.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    f.icon
                  )}
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-50">
                    {f.label}
                  </p>
                  <p className="text-xs text-slate-500">{f.description}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
