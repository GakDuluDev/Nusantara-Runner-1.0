import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Heart,
  Pause,
  Play,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { GamePhase, GateQuizState, RunStats } from '../types/game';

interface GameHUDProps {
  phase: GamePhase;
  displayName: string;
  stats: RunStats;
  gateQuiz: GateQuizState | null;
  feedbackBanner: {
    text: string;
    tone: 'success' | 'danger' | 'info';
  } | null;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onSteer: (delta: -1 | 1) => void;
  onJump: () => void;
  onSlide: () => void;
  onQuitToLobby: () => void;
}

const LEVEL_NAMES: Record<1 | 2 | 3, string> = {
  1: 'Jalan Santai',
  2: 'Jam Sibuk',
  3: 'Macet Pantura',
};

export const GameHUD: React.FC<GameHUDProps> = ({
  phase,
  displayName,
  stats,
  gateQuiz,
  feedbackBanner,
  muted,
  onToggleMute,
  onTogglePause,
  onSteer,
  onJump,
  onSlide,
  onQuitToLobby,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* TOP BAR: Compact solid-alpha HUD (No backdrop-blur over WebGL) */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Player + Hearts + Shield */}
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-900/90 border border-slate-700 px-3.5 py-2 text-white shadow-lg">
            <div className="min-w-0 max-w-[130px] sm:max-w-[180px]">
              <div className="text-xs text-slate-300 truncate font-medium">
                {displayName}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {[0, 1, 2].map((idx) => (
                  <Heart
                    key={idx}
                    className={`w-4 h-4 ${
                      idx < stats.lives
                        ? 'text-rose-500 fill-rose-500'
                        : 'text-slate-600'
                    }`}
                  />
                ))}
                {stats.shieldRemaining > 0 && (
                  <span className="ml-1.5 flex items-center gap-1 text-xs font-mono-num text-sky-300 font-semibold">
                    <Shield className="w-3.5 h-3.5 text-sky-400" />
                    {stats.shieldRemaining.toFixed(0)}s
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Distance, Level, Score, Controls */}
          <div className="pointer-events-auto flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-3 sm:gap-4 rounded-xl bg-slate-900/90 border border-slate-700 px-3.5 py-2 text-white shadow-lg">
              <div>
                <div className="text-[11px] text-slate-300">
                  Lv.{stats.level} · {LEVEL_NAMES[stats.level]}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono-num text-amber-300">
                  {stats.distance.toLocaleString('id-ID')}m
                </div>
              </div>
              <div className="h-7 w-px bg-slate-700" />
              <div className="text-right">
                <div className="text-[11px] text-slate-300">
                  Skor {stats.multiplier > 1 ? `(${stats.multiplier}x)` : ''}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono-num text-white">
                  {stats.score.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Aktifkan Suara' : 'Bisukan Suara'}
              className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700 text-white flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer shadow-lg"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-sky-300" />
              )}
            </button>

            <button
              type="button"
              onClick={onTogglePause}
              aria-label={phase === 'paused' ? 'Lanjutkan' : 'Jeda Game'}
              className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700 text-white flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer shadow-lg"
            >
              {phase === 'paused' ? (
                <Play className="w-4 h-4 text-emerald-400" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Active 3-Lane Gate Question Prompt at Top Center */}
        {gateQuiz && (
          <div className="mx-auto w-full max-w-3xl rounded-2xl bg-slate-950/92 border border-sky-400/60 px-4 py-3 text-white shadow-xl">
            <div className="flex items-center justify-between gap-2 text-xs text-sky-300 font-medium mb-1">
              <span>
                Kuis Gerbang Jalan · Tingkat{' '}
                <span className="capitalize">{gateQuiz.question.difficulty}</span>
              </span>
              <span>Arahkan pelari ke jalur jawaban yang benar!</span>
            </div>
            <div className="text-sm sm:text-base font-bold leading-snug text-white">
              {gateQuiz.question.question}
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {gateQuiz.laneOptions.map((opt) => (
                <div
                  key={opt.lane}
                  className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs"
                >
                  <div className="font-bold text-sky-300">
                    {opt.label} ·{' '}
                    {opt.lane === 0
                      ? 'Kiri'
                      : opt.lane === 1
                        ? 'Tengah'
                        : 'Kanan'}
                  </div>
                  <div className="text-slate-100 line-clamp-2 mt-0.5">
                    {opt.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instant Feedback Banner */}
        {feedbackBanner && !gateQuiz && (
          <div
            className={`mx-auto rounded-xl px-4 py-2 text-xs sm:text-sm font-bold shadow-lg border ${
              feedbackBanner.tone === 'success'
                ? 'bg-emerald-600/95 border-emerald-400 text-white'
                : feedbackBanner.tone === 'danger'
                  ? 'bg-rose-600/95 border-rose-400 text-white'
                  : 'bg-sky-600/95 border-sky-400 text-white'
            }`}
          >
            {feedbackBanner.text}
          </div>
        )}
      </div>

      {/* PAUSE OVERLAY */}
      {phase === 'paused' && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-center">
            <h2 className="text-xl font-bold text-slate-900">Game Dijeda</h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Skor sementara:{' '}
              <span className="font-bold font-mono-num text-slate-900">
                {stats.score.toLocaleString('id-ID')}
              </span>{' '}
              · Jarak{' '}
              <span className="font-bold font-mono-num text-slate-900">
                {stats.distance}m
              </span>
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onTogglePause}
                className="w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer"
              >
                Lanjutkan Lari
              </button>
              <button
                type="button"
                onClick={onQuitToLobby}
                className="w-full rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Kembali ke Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM BAR: Compact Touch Buttons (Mobile) + Keyboard Hint (Desktop) */}
      <div className="flex items-end justify-between gap-2">
        <div className="hidden md:block rounded-xl bg-slate-900/85 border border-slate-700 px-3.5 py-2 text-xs text-slate-200">
          Kontrol: <span className="font-semibold text-white">← / →</span> Pindah
          Jalur · <span className="font-semibold text-white">↑ / Spasi</span>{' '}
          Lompat · <span className="font-semibold text-white">↓</span> Slide ·{' '}
          <span className="font-semibold text-white">P / Esc</span> Jeda
        </div>

        {/* Mobile quick-tap pads (also works via swipe anywhere on canvas) */}
        <div className="md:hidden pointer-events-auto flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSteer(-1)}
              aria-label="Geser Kiri"
              className="w-12 h-12 rounded-xl bg-slate-900/85 border border-slate-700 text-white flex items-center justify-center active:bg-sky-600"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => onSteer(1)}
              aria-label="Geser Kanan"
              className="w-12 h-12 rounded-xl bg-slate-900/85 border border-slate-700 text-white flex items-center justify-center active:bg-sky-600"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSlide}
              aria-label="Menunduk Slide"
              className="w-12 h-12 rounded-xl bg-slate-900/85 border border-slate-700 text-white flex items-center justify-center active:bg-amber-600"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={onJump}
              aria-label="Lompat"
              className="w-12 h-12 rounded-xl bg-sky-600/95 border border-sky-400 text-white flex items-center justify-center active:bg-sky-500"
            >
              <ChevronUp className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
