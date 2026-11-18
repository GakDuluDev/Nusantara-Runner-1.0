import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { soundEngine } from './audio/soundEngine';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GameHUD } from './components/GameHUD';
import { GameOverModal } from './components/GameOverModal';
import { LobbyOverlay } from './components/LobbyOverlay';
import { QuizModal } from './components/QuizModal';
import {
  ensureUserLeaderboardProfile,
  loginAsGuest,
  loginWithGoogle,
  logoutUser,
  sanitizeDisplayName,
  submitHighScoreIfBetter,
  subscribeAuth,
  subscribeTopLeaderboard,
  updateUserDisplayName,
} from './firebase';
import {
  RunnerCanvas,
  type RunnerBridge,
  type RunnerCallbacks,
} from './game/RunnerCanvas';
import type {
  GamePhase,
  GateQuizState,
  LeaderboardEntry,
  PopupQuizState,
  RunStats,
} from './types/game';

const INITIAL_STATS: RunStats = {
  score: 0,
  distance: 0,
  lives: 3,
  level: 1,
  multiplier: 1,
  correctAnswers: 0,
  totalQuestions: 0,
  shieldRemaining: 0,
  reviveUsed: false,
};

function GameApp() {
  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('Pelari SMA');
  const [myHighScore, setMyHighScore] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const [stats, setStats] = useState<RunStats>(INITIAL_STATS);
  const [gateQuiz, setGateQuiz] = useState<GateQuizState | null>(null);
  const [popupQuiz, setPopupQuiz] = useState<PopupQuizState | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    text: string;
    tone: 'success' | 'danger' | 'info';
  } | null>(null);
  const [muted, setMuted] = useState(false);

  const bridgeRef = useRef<RunnerBridge | null>(null);
  const userRef = useRef<User | null>(null);
  const displayNameRef = useRef<string>(displayName);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  // Subscribe Firebase Auth State
  useEffect(() => {
    const unsub = subscribeAuth((firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      setAuthError(null);

      if (firebaseUser) {
        void ensureUserLeaderboardProfile(firebaseUser)
          .then((profile) => {
            setDisplayName(profile.displayName);
            setMyHighScore(profile.highScore || 0);
          })
          .catch((err) => {
            console.error(err);
          });
      } else {
        setPhase('lobby');
        setLeaderboard([]);
        setMyHighScore(0);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe Realtime Top 10 Leaderboard (only when authenticated)
  useEffect(() => {
    if (!user) return;
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    const unsub = subscribeTopLeaderboard(
      (rows) => {
        setLeaderboard(rows);
        setLeaderboardLoading(false);
        const me = rows.find((r) => r.uid === user.uid);
        if (me) {
          setMyHighScore((prev) => Math.max(prev, me.highScore));
        }
      },
      (err) => {
        setLeaderboardError(err.message);
        setLeaderboardLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  const handleLoginGoogle = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(`Gagal login Google: ${msg}`);
    }
  };

  const handleLoginGuest = async () => {
    setAuthError(null);
    try {
      await loginAsGuest();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('operation-not-allowed') ||
        msg.includes('admin-restricted-operation')
      ) {
        setAuthError(
          'Login Anonim/Guest belum diaktifkan di Firebase Console Anda. Buka Firebase Console -> Authentication -> Sign-in method -> aktifkan "Anonymous", atau gunakan tombol Login dengan Google.',
        );
      } else {
        setAuthError(`Gagal login Guest: ${msg}`);
      }
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setPhase('lobby');
  };

  const handleSaveDisplayName = async (rawName: string) => {
    const clean = sanitizeDisplayName(rawName);
    setDisplayName(clean);
    if (user) {
      await updateUserDisplayName(user, clean);
    }
  };

  const handleStartGame = useCallback(() => {
    if (!userRef.current) return;
    soundEngine.unlock();
    setIsNewHighScore(false);
    setPopupQuiz(null);
    setGateQuiz(null);
    setFeedbackBanner(null);
    bridgeRef.current?.startNewRun();
    setPhase('playing');
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleTogglePause = useCallback(() => {
    setPhase((prev) =>
      prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev,
    );
  }, []);

  const finalizeGameOver = useCallback(async (finalStats: RunStats) => {
    setStats(finalStats);
    setGateQuiz(null);
    setPopupQuiz(null);
    setPhase('gameover');

    const activeUser = userRef.current;
    if (activeUser) {
      try {
        const res = await submitHighScoreIfBetter(
          activeUser,
          displayNameRef.current,
          finalStats.score,
          finalStats.distance,
          finalStats.correctAnswers,
          finalStats.level,
        );
        setIsNewHighScore(res.isNewHighScore);
        setMyHighScore(res.highScore);
      } catch (err) {
        console.error('Failed to submit high score:', err);
      }
    }
  }, []);

  const runnerCallbacks = useMemo<RunnerCallbacks>(
    () => ({
      onStatsChange: (nextStats) => setStats(nextStats),
      onGateQuizChange: (gate) => setGateQuiz(gate),
      onTriggerPopupQuiz: (popup) => {
        setPopupQuiz(popup);
        setPhase(popup.mode === 'revive' ? 'revive_quiz' : 'popup_quiz');
      },
      onFeedbackBanner: (banner) => setFeedbackBanner(banner),
      onGameOver: (finalStats) => {
        void finalizeGameOver(finalStats);
      },
      onRequestPauseToggle: () => {
        setPhase((prev) =>
          prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev,
        );
      },
    }),
    [finalizeGameOver],
  );

  const handlePopupAnswer = useCallback(
    (isCorrect: boolean, mode: 'passage' | 'revive') => {
      setPopupQuiz(null);
      if (mode === 'revive' && !isCorrect) {
        bridgeRef.current?.resolvePopupQuiz(false, 'revive');
        return;
      }
      setPhase('playing');
      bridgeRef.current?.resolvePopupQuiz(isCorrect, mode);
    },
    [],
  );

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-sky-200">
      {/* Isolated 3D WebGL Viewport */}
      <RunnerCanvas
        phase={phase}
        callbacks={runnerCallbacks}
        bridgeRef={bridgeRef}
      />

      {/* Active Gameplay & Pause HUD */}
      {(phase === 'playing' ||
        phase === 'paused' ||
        phase === 'popup_quiz' ||
        phase === 'revive_quiz') && (
        <GameHUD
          phase={phase}
          displayName={displayName}
          stats={stats}
          gateQuiz={gateQuiz}
          feedbackBanner={feedbackBanner}
          muted={muted}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
          onSteer={(d) => bridgeRef.current?.steerLane(d)}
          onJump={() => bridgeRef.current?.jump()}
          onSlide={() => bridgeRef.current?.slide()}
          onQuitToLobby={() => {
            setGateQuiz(null);
            setPopupQuiz(null);
            setPhase('lobby');
          }}
        />
      )}

      {/* Lobby Overlay */}
      {phase === 'lobby' && (
        <LobbyOverlay
          user={user}
          authLoading={authLoading}
          authError={authError}
          displayName={displayName}
          myHighScore={myHighScore}
          leaderboard={leaderboard}
          leaderboardLoading={leaderboardLoading}
          leaderboardError={leaderboardError}
          muted={muted}
          onToggleMute={handleToggleMute}
          onLoginGoogle={handleLoginGoogle}
          onLoginGuest={handleLoginGuest}
          onLogout={handleLogout}
          onSaveDisplayName={handleSaveDisplayName}
          onStartGame={handleStartGame}
        />
      )}

      {/* 5-Option Reading Passage or 10-Second Revive Modal */}
      {(phase === 'popup_quiz' || phase === 'revive_quiz') && popupQuiz && (
        <QuizModal quiz={popupQuiz} onAnswer={handlePopupAnswer} />
      )}

      {/* Game Over Summary & Realtime Leaderboard */}
      {phase === 'gameover' && (
        <GameOverModal
          stats={stats}
          isNewHighScore={isNewHighScore}
          personalBest={myHighScore}
          currentUid={user?.uid}
          leaderboard={leaderboard}
          leaderboardLoading={leaderboardLoading}
          leaderboardError={leaderboardError}
          onPlayAgain={handleStartGame}
          onBackToLobby={() => setPhase('lobby')}
        />
      )}
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameApp />
    </ErrorBoundary>
  );
}
