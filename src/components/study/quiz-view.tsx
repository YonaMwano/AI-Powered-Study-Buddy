"use client";

import { useMemo, useState } from "react";
import type { Quiz } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuizView({ quiz }: { quiz: Quiz }) {
  const questions = quiz?.questions ?? [];
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [, setAnswers] = useState<boolean[]>([]);

  const q = questions[index];

  const progress = useMemo(
    () => (questions.length ? ((index + (finished ? 1 : 0)) / questions.length) * 100 : 0),
    [index, finished, questions.length]
  );

  if (!questions.length) {
    return <p className="text-sm text-slate-500">No quiz questions available.</p>;
  }

  function checkAnswer() {
    if (!q || selected === null) return;
    const correct =
      q.type === "truefalse"
        ? selected.toLowerCase() === q.answer.toLowerCase()
        : selected.toLowerCase().trim() === q.answer.toLowerCase().trim() ||
          (q.options?.some(
            (o) =>
              o === selected &&
              (o.toLowerCase() === q.answer.toLowerCase() ||
                q.answer.toLowerCase().includes(o.toLowerCase()))
          ) ?? false);
    setRevealed(true);
    setAnswers((prev) => [...prev, correct]);
    if (correct) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
  }

  function restart() {
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setScore(0);
    setFinished(false);
    setAnswers([]);
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="text-4xl font-semibold text-slate-900 dark:text-slate-50">
            {score} / {questions.length}
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            You scored {pct}%
          </p>
          <Button onClick={restart} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const options =
    q.type === "truefalse"
      ? ["True", "False"]
      : q.type === "mcq"
        ? q.options ?? []
        : [];

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Question {index + 1} of {questions.length}
        </span>
        <Badge variant="secondary">{q.type}</Badge>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          <p className="text-base font-medium text-slate-900 dark:text-slate-50">
            {q.prompt}
          </p>

          {q.type === "short" ? (
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="Type your answer…"
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value)}
              disabled={revealed}
            />
          ) : (
            <div className="space-y-2">
              {options.map((opt, i) => {
                const isSelected = selected === opt;
                const isCorrect =
                  revealed &&
                  (opt.toLowerCase() === q.answer.toLowerCase() ||
                    q.answer.toLowerCase().includes(opt.toLowerCase()));
                const isWrong = revealed && isSelected && !isCorrect;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={revealed}
                    onClick={() => setSelected(opt)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                      isSelected && !revealed && "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40",
                      isCorrect && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
                      isWrong && "border-red-400 bg-red-50 dark:bg-red-950/30",
                      !isSelected && !revealed && "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {isWrong && <XCircle className="h-4 w-4 text-red-500" />}
                  </button>
                );
              })}
            </div>
          )}

          {revealed && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                Answer: {q.answer}
              </p>
              {q.explanation && (
                <p className="mt-1 text-slate-600 dark:text-slate-400">
                  {q.explanation}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            {!revealed ? (
              <Button onClick={checkAnswer} disabled={selected === null || selected === ""}>
                Check answer
              </Button>
            ) : (
              <Button onClick={next} className="gap-1">
                {index + 1 >= questions.length ? "Finish" : "Next"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
