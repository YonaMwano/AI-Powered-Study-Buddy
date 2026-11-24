"use client";

import { useEffect, useState } from "react";
import type { Flashcards } from "@/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export function FlashcardsView({ flashcards }: { flashcards: Flashcards }) {
  const cards = flashcards?.cards ?? [];
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(cards.length - 1, i + 1));
        setFlipped(false);
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(0, i - 1));
        setFlipped(false);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cards.length]);

  if (!cards.length) {
    return <p className="text-sm text-slate-500">No flashcards available.</p>;
  }

  const card = cards[index];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Card {index + 1} of {cards.length}
        </span>
        <span className="hidden sm:inline text-xs">← → navigate · Space flip</span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="group relative mx-auto block w-full max-w-lg perspective-1000"
        style={{ perspective: "1000px" }}
      >
        <div
          className={cn(
            "relative min-h-[240px] w-full transition-transform duration-500",
            flipped && "[transform:rotateY(180deg)]"
          )}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={{ backfaceVisibility: "hidden" }}
          >
            {card.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.imageUrl}
                alt=""
                className="mb-4 max-h-28 object-contain"
              />
            )}
            <p className="text-center text-lg font-medium text-slate-900 dark:text-slate-50">
              {card.front}
            </p>
            <p className="mt-4 text-xs text-slate-400">Click to flip</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 p-8 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/40"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <p className="text-center text-base leading-relaxed text-slate-800 dark:text-slate-100">
              {card.back}
            </p>
          </div>
        </div>
      </button>

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          disabled={index === 0}
          onClick={() => {
            setIndex((i) => i - 1);
            setFlipped(false);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIndex(0);
            setFlipped(false);
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restart
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={index >= cards.length - 1}
          onClick={() => {
            setIndex((i) => i + 1);
            setFlipped(false);
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setIndex(i);
              setFlipped(false);
            }}
            className={cn(
              "rounded-xl border p-3 text-left text-sm transition-colors",
              i === index
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            )}
          >
            <p className="line-clamp-2 font-medium text-slate-800 dark:text-slate-200">
              {c.front}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
