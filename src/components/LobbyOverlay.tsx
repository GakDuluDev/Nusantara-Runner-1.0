import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  LogIn,
  LogOut,
  Play,
  User as UserIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { totalQuestionCount } from '../game/quizManager';
import type { LeaderboardEntry } from '../types/game';
import { LeaderboardPanel } from './LeaderboardPanel';

interface LobbyOverlayProps {
  user: User | null;
  authLoading: boolean;
  authError: string | null;
  displayName: string;
  myHighScore: number;
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  leaderboardError: string | null;
  muted: boolean;
  onToggleMute: () => void;
  onLoginGoogle: () => Promise<void>;
  onLoginGuest: () => Promise<void>;
  onLogout: () => Promise<void>;
  onSaveDisplayName: (name: string) => Promise<void>;
  onStartGame: () => void;
}

export const LobbyOverlay: React.FC<LobbyOverlayProps> = ({
  user,
  authLoading,
  authError,
  displayName,
  myHighScore,
  leaderboard,
  leaderboardLoading,
  leaderboardError,
  muted,
  onToggleMute,
  onLoginGoogle,
  onLoginGuest,
  onLogout,
  onSaveDisplayName,
  onStartGame,
}) => {
  const [nameInput, setNameInput] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameSavedFlash, setNameSavedFlash] = useState(false);

  useEffect(() => {
    setNameInput(displayName);
  }, [displayName]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || savingName) return;
    setSavingName(true);
    try {
      await onSaveDisplayName(nameInput);
      setNameSavedFlash(true);
      window.setTimeout(() => setNameSavedFlash(false), 1800);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-slate-950/55 p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-5xl my-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Game Intro, Auth / Profile & Controls */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 sm:p-7">
          <div>
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-sky-700">
                  Game Edukasi 3D · Bahasa Inggris Kelas 12 ({totalQuestionCount}{' '}
                  Soal)
                </div>
                <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Nusantara Runner 12
                </h1>
              </div>

              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Aktifkan Suara' : 'Bisukan Suara'}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-rose-600" />
                ) : (
                  <Volume2 className="w-4 h-4 text-sky-700" />
                )}
              </button>
            </div>

            <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
              Susuri jalanan Indonesia dari Jalan Santai hingga Pantura. Hindari
              motor matic, angkot, bus AKAP, dan palang jalan sambil menaklukkan
              gerbang kuis Bahasa Inggris SMA Kelas 12!
            </p>

            {/* Level Progression Summary */}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <div className="text-xs font-bold text-emerald-700">
                  Lv. 1 · 0–500m
                </div>
                <div className="text-xs font-semibold text-slate-900 mt-0.5">
                  Jalan Santai
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Soal Easy · 1x Skor
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <div className="text-xs font-bold text-amber-700">
                  Lv. 2 · 500–1500m
                </div>
                <div className="text-xs font-semibold text-slate-900 mt-0.5">
                  Jam Sibuk
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Trafik Maju · Medium
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <div className="text-xs font-bold text-rose-700">
                  Lv. 3 · &gt;1500m
                </div>
                <div className="text-xs font-semibold text-slate-900 mt-0.5">
                  Macet Pantura
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Soal Hard · 2x Skor
                </div>
              </div>
            </div>

            {/* Auth Section OR Logged-in Profile Setup */}
            <div className="mt-5 pt-5 border-t border-slate-100">
              {authLoading ? (
                <div className="py-6 text-center text-sm text-slate-500">
                  Memeriksa sesi login Firebase...
                </div>
              ) : !user ? (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Masuk untuk Bermain & Simpan Peringkat
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Login diperlukan agar skor tertinggi Anda tersimpan ke
                      Papan Peringkat Realtime.
                    </p>
                  </div>

                  {authError && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 leading-relaxed">
                      {authError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => void onLoginGoogle()}
                      className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Login dengan Google</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onLoginGuest()}
                      className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span>Login Anonim / Guest</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500">
                        Masuk sebagai{' '}
                        <span className="font-semibold text-slate-700">
                          {user.isAnonymous ? 'Pemain Guest' : 'Akun Google'}
                        </span>{' '}
                        · Skor Tertinggi Anda:{' '}
                        <span className="font-bold font-mono-num text-sky-700">
                          {myHighScore.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onLogout()}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar</span>
                    </button>
                  </div>

                  {/* Display Name Editor */}
                  <form
                    onSubmit={(e) => void handleSaveName(e)}
                    className="flex flex-col sm:flex-row gap-2"
                  >
                    <div className="flex-1">
                      <label
                        htmlFor="display-name-input"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Nama Tampilan di Leaderboard
                      </label>
                      <input
                        id="display-name-input"
                        type="text"
                        maxLength={32}
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Masukkan nama Anda..."
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={savingName || !nameInput.trim()}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer h-[42px]"
                      >
                        {nameSavedFlash ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Tersimpan</span>
                          </>
                        ) : (
                          <span>{savingName ? 'Menyimpan...' : 'Simpan Nama'}</span>
                        )}
                      </button>
                    </div>
                  </form>

                  <button
                    type="button"
                    onClick={onStartGame}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-bold text-white hover:bg-emerald-700 transition-colors shadow-md cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    <span>Mulai Main</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Controls & Obstacle Guide Footer */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span>
              Kontrol: <strong className="text-slate-700">← →</strong> Jalur ·{' '}
              <strong className="text-slate-700">↑ / Spasi</strong> Lompat
              (Motor/Angkot) · <strong className="text-slate-700">↓</strong>{' '}
              Slide (Portal)
            </span>
            <span>HP: Geser (Swipe) layar</span>
          </div>
        </div>

        {/* Right Column: Realtime Top 10 Leaderboard */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          {user ? (
            <LeaderboardPanel
              entries={leaderboard}
              currentUid={user.uid}
              loading={leaderboardLoading}
              error={leaderboardError}
            />
          ) : (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 flex flex-col justify-center h-full">
              <h3 className="text-base font-bold text-slate-900">
                Papan Peringkat Top 10 Realtime
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Silakan masuk dengan akun Google atau akun Guest terlebih dahulu
                untuk melihat peringkat 10 besar pemain secara realtime dan
                mencatat skor tertinggi Anda.
              </p>
              <div className="mt-5 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
                <div>· 3 Jalur Gerbang Kuis: Otomatis memilih 1 benar &amp; 2 pengecoh</div>
                <div>· Soal Bacaan &amp; Revive 10 Detik: Pilihan lengkap A–E</div>
                <div>· Jawaban benar memberi bonus skor + Perisai sementara</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
