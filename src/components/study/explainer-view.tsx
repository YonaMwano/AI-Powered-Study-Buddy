"use client";

import type { Explainer } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ExplainerView({ explainer }: { explainer: Explainer }) {
  if (!explainer?.sections?.length) {
    return (
      <p className="text-sm text-slate-500">No explainer sections available.</p>
    );
  }

  return (
    <div className="space-y-6">
      {explainer.sections.map((section, idx) => (
        <Card key={idx} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {section.heading}
              </h2>
              <Badge variant="secondary" className="shrink-0">
                {idx + 1}
              </Badge>
            </div>

            <div className="space-y-3 font-serif text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
              {section.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {section.keyPoints && section.keyPoints.length > 0 && (
              <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/30">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                  Key points
                </p>
                <ul className="space-y-1.5">
                  {section.keyPoints.map((kp, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                      {kp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {section.diagramUrl && (
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={section.diagramUrl}
                  alt={`Diagram for ${section.heading}`}
                  className="mx-auto max-h-80 w-auto object-contain"
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
