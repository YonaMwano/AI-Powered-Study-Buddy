"use client";

import { useState } from "react";
import { Download, FileText, Presentation, FileType, Loader2 } from "lucide-react";
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

function triggerDownload(url: string, filename: string) {
  // data: URLs and signed URLs both work via <a download>
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  // For cross-origin signed URLs, download attr may be ignored — open in new tab as fallback
  if (url.startsWith("http")) {
    a.target = "_blank";
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadViaBlob(url: string, filename: string, contentType?: string) {
  // Prefer fetching as blob so filename is respected even for signed URLs
  if (url.startsWith("data:")) {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, filename);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    return;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(
      contentType ? new Blob([blob], { type: contentType }) : blob
    );
    triggerDownload(objectUrl, filename);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  } catch {
    // CORS on storage signed URL — open directly
    triggerDownload(url, filename);
  }
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
        body: JSON.stringify({ studyId, format }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");

      const url = data.signedUrl as string;
      if (!url) throw new Error("No download URL returned");

      const filename =
        data.filename ||
        `${title.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.${format}`;

      await downloadViaBlob(url, filename, data.contentType);

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
