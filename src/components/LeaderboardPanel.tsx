import React from 'react';
import { Trophy } from 'lucide-react';
import type { LeaderboardEntry } from '../types/game';

interface LeaderboardPanelProps {
  entries: LeaderboardEntry[];
  currentUid?: string | null;
  loading?: boolean;
  error?: string | null;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  entries,
  currentUid,
  loading = false,
  error = null,
}) => {
  return (
    <div className="flex flex-col rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2.5">
          <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
          <h3 className="text-base font-bold text-slate-900">
            Papan Peringkat Top 10
          </h3>
        </div>
        <span className="text-xs font-medium text-emerald-700">
          Realtime Firestore
        </span>
      </div>

      <div className="p-3 sm:p-4 max-h-[340px] overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Memuat peringkat pemain...
          </div>
        ) : error ? (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            Gagal memuat papan peringkat: {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Belum ada skor tercatat. Jadilah pelari pertama di peringkat #1!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {entries.map((entry, idx) => {
              const isMe = Boolean(currentUid && entry.uid === currentUid);
              const rank = idx + 1;
              return (
                <div
                  key={entry.uid}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isMe ? 'bg-sky-50 border border-sky-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono-num shrink-0 ${
                        rank === 1
                          ? 'bg-amber-400 text-slate-950'
                          : rank === 2
                            ? 'bg-slate-300 text-slate-900'
                            : rank === 3
                              ? 'bg-orange-300 text-slate-950'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {rank}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {entry.displayName}
                        {isMe ? ' (Anda)' : ''}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="font-mono-num">
                          {entry.bestDistance}m
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Lv.{entry.levelReached}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">
                          {entry.correctAnswers} benar
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-slate-900 font-mono-num">
                      {entry.highScore.toLocaleString('id-ID')}
                    </div>
                    <div className="text-[11px] text-slate-400">poin</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
