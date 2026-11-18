import React from 'react';
import { Award, Home, RotateCcw } from 'lucide-react';
import type { LeaderboardEntry, RunStats } from '../types/game';
import { LeaderboardPanel } from './LeaderboardPanel';

interface GameOverModalProps {
  stats: RunStats;
  isNewHighScore: boolean;
  personalBest: number;
  currentUid?: string | null;
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  leaderboardError: string | null;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  isNewHighScore,
  personalBest,
  currentUid,
  leaderboard,
  leaderboardLoading,
  leaderboardError,
  onPlayAgain,
  onBackToLobby,
}) => {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/75 p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-4xl my-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Run Summary */}
        <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-rose-600">
              Permainan Selesai
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">
              Ringkasan Lari Anda
            </h2>

            {isNewHighScore && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-sm font-bold text-amber-900">
                <Award className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Rekor Baru! Skor tertinggi Anda diperbarui.</span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                <div className="text-xs text-slate-500">Skor Akhir</div>
                <div className="mt-1 text-2xl font-extrabold font-mono-num text-slate-900">
                  {stats.score.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                <div className="text-xs text-slate-500">Skor Tertinggi Anda</div>
                <div className="mt-1 text-2xl font-extrabold font-mono-num text-sky-700">
                  {Math.max(personalBest, stats.score).toLocaleString('id-ID')}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                <div className="text-xs text-slate-500">Jarak Tempuh</div>
                <div className="mt-1 text-lg font-bold font-mono-num text-slate-900">
                  {stats.distance.toLocaleString('id-ID')} m
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                <div className="text-xs text-slate-500">Kuis Benar</div>
                <div className="mt-1 text-lg font-bold font-mono-num text-emerald-700">
                  {stats.correctAnswers} / {stats.totalQuestions}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onPlayAgain}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Main Lagi</span>
            </button>
            <button
              type="button"
              onClick={onBackToLobby}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Lobby</span>
            </button>
          </div>
        </div>

        {/* Realtime Top 10 Leaderboard */}
        <div className="lg:col-span-6">
          <LeaderboardPanel
            entries={leaderboard}
            currentUid={currentUid}
            loading={leaderboardLoading}
            error={leaderboardError}
          />
        </div>
      </div>
    </div>
  );
};
