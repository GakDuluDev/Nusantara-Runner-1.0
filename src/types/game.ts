export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuestionItem {
  id: number;
  difficulty: Difficulty;
  passage: string;
  question: string;
  options: [string, string, string, string, string] | string[];
  correctIndex: number; // 0-4
}

export type GamePhase =
  | 'lobby'
  | 'playing'
  | 'paused'
  | 'popup_quiz'
  | 'revive_quiz'
  | 'gameover';

export type GameLevel = 1 | 2 | 3;

export interface GateOptionDisplay {
  lane: 0 | 1 | 2; // 0 = Kiri, 1 = Tengah, 2 = Kanan
  label: 'A' | 'B' | 'C';
  text: string;
  isCorrect: boolean;
}

export interface GateQuizState {
  question: QuestionItem;
  laneOptions: [GateOptionDisplay, GateOptionDisplay, GateOptionDisplay];
}

export interface PopupQuizState {
  mode: 'passage' | 'revive';
  question: QuestionItem;
  timeLimitSeconds: number | null; // 10 for revive, null for reading passage
}

export interface RunStats {
  score: number;
  distance: number;
  lives: number;
  level: GameLevel;
  multiplier: number;
  correctAnswers: number;
  totalQuestions: number;
  shieldRemaining: number; // seconds
  reviveUsed: boolean;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  highScore: number;
  bestDistance: number;
  correctAnswers: number;
  levelReached: GameLevel;
  isAnonymous: boolean;
  updatedAt?: unknown;
}
