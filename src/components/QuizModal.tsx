import React, { useEffect, useState } from 'react';
import { BookOpen, Clock, ShieldAlert } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import type { PopupQuizState } from '../types/game';

interface QuizModalProps {
  quiz: PopupQuizState;
  onAnswer: (isCorrect: boolean, mode: 'passage' | 'revive') => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

export const QuizModal: React.FC<QuizModalProps> = ({ quiz, onAnswer }) => {
  const { mode, question, timeLimitSeconds } = quiz;
  const [timeLeft, setTimeLeft] = useState<number>(timeLimitSeconds ?? 0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    setTimeLeft(timeLimitSeconds ?? 0);
    setSelectedIdx(null);
  }, [quiz, timeLimitSeconds]);

  // 10-second countdown for Revive mode
  useEffect(() => {
    if (mode !== 'revive' || timeLimitSeconds === null || selectedIdx !== null) {
      return;
    }

    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next > 0 && next <= 5) {
          soundEngine.playTick();
        }
        if (next <= 0) {
          window.clearInterval(interval);
          onAnswer(false, 'revive');
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [mode, timeLimitSeconds, selectedIdx, onAnswer]);

  const handleChoose = (idx: number) => {
    if (selectedIdx !== null) return;
    setSelectedIdx(idx);
    const isCorrect = idx === question.correctIndex;
    window.setTimeout(() => {
      onAnswer(isCorrect, mode);
    }, 450);
  };

  // Keyboard 1-5 or A-E support inside modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedIdx !== null) return;
      const upper = e.key.toUpperCase();
      const letterIdx = OPTION_LETTERS.indexOf(
        upper as (typeof OPTION_LETTERS)[number],
      );
      if (letterIdx >= 0 && letterIdx < question.options.length) {
        e.preventDefault();
        handleChoose(letterIdx);
        return;
      }
      const num = Number(e.key);
      if (num >= 1 && num <= 5 && num <= question.options.length) {
        e.preventDefault();
        handleChoose(num - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const isRevive = mode === 'revive';
  const progressPct =
    isRevive && timeLimitSeconds ? (timeLeft / timeLimitSeconds) * 100 : 100;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={`flex items-center justify-between gap-4 px-5 py-4 border-b ${
            isRevive
              ? 'bg-amber-50 border-amber-200'
              : 'bg-sky-50 border-sky-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {isRevive ? (
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <BookOpen className="w-5 h-5 text-sky-700 shrink-0" />
            )}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {isRevive
                  ? 'Kesempatan Revive — Jawab untuk Lanjut!'
                  : 'Pos Bacaan Bahasa Inggris Kelas 12'}
              </h2>
              <p className="text-xs text-slate-600">
                Tingkat:{' '}
                <span className="font-semibold capitalize">
                  {question.difficulty}
                </span>{' '}
                · Pilih A, B, C, D, atau E
              </p>
            </div>
          </div>

          {isRevive && (
            <div className="flex items-center gap-1.5 rounded-xl bg-white border border-amber-300 px-3 py-1.5 shrink-0">
              <Clock className="w-4 h-4 text-amber-600" />
              <span
                className={`text-base font-bold font-mono-num ${
                  timeLeft <= 3 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {timeLeft}s
              </span>
            </div>
          )}
        </div>

        {/* Countdown bar for revive */}
        {isRevive && (
          <div className="h-1.5 w-full bg-amber-100">
            <div
              className={`h-full transition-all duration-500 ${
                timeLeft <= 3 ? 'bg-rose-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.max(0, progressPct)}%` }}
            />
          </div>
        )}

        <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Optional Reading Passage */}
          {question.passage && question.passage.trim().length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-800 leading-relaxed">
              {question.passage}
            </div>
          )}

          {/* Question */}
          <div className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            {question.question}
          </div>

          {/* 5 Multiple Choice Options (A-E) */}
          <div className="space-y-2.5">
            {question.options.map((optText, idx) => {
              const isChosen = selectedIdx === idx;
              const isRight = idx === question.correctIndex;
              let btnStyle =
                'bg-white border-slate-200 hover:border-sky-400 hover:bg-sky-50 text-slate-800';
              if (selectedIdx !== null) {
                if (isRight) {
                  btnStyle =
                    'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold';
                } else if (isChosen) {
                  btnStyle =
                    'bg-rose-50 border-rose-500 text-rose-950 font-semibold';
                } else {
                  btnStyle = 'bg-slate-50 border-slate-200 text-slate-400';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={selectedIdx !== null}
                  onClick={() => handleChoose(idx)}
                  className={`w-full flex items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors cursor-pointer disabled:cursor-default min-h-[44px] ${btnStyle}`}
                >
                  <span className="w-7 h-7 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono-num">
                    {OPTION_LETTERS[idx]}
                  </span>
                  <span className="leading-snug pt-0.5">{optText}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
