import rawQuestions from '../../questions.json';
import type {
  Difficulty,
  GameLevel,
  GateOptionDisplay,
  QuestionItem,
} from '../types/game';

const ALL_QUESTIONS: QuestionItem[] = rawQuestions as QuestionItem[];

export class QuizManager {
  private usedIds = new Set<number>();

  public reset(): void {
    this.usedIds.clear();
  }

  public getDifficultyForLevel(level: GameLevel): Difficulty {
    if (level === 1) return 'easy';
    if (level === 2) return 'medium';
    return 'hard';
  }

  public pickQuestion(
    difficulty: Difficulty,
    preferNoPassage: boolean,
  ): QuestionItem {
    let pool = ALL_QUESTIONS.filter(
      (q) => q.difficulty === difficulty && !this.usedIds.has(q.id),
    );

    if (pool.length === 0) {
      // Clear used IDs for this difficulty so questions can cycle cleanly
      ALL_QUESTIONS.filter((q) => q.difficulty === difficulty).forEach((q) =>
        this.usedIds.delete(q.id),
      );
      pool = ALL_QUESTIONS.filter((q) => q.difficulty === difficulty);
    }

    if (preferNoPassage) {
      const noPassagePool = pool.filter((q) => !q.passage || q.passage.trim() === '');
      if (noPassagePool.length > 0) {
        pool = noPassagePool;
      }
    }

    const picked = pool[Math.floor(Math.random() * pool.length)];
    this.usedIds.add(picked.id);
    return picked;
  }

  public pickReviveQuestion(level: GameLevel): QuestionItem {
    const diff = this.getDifficultyForLevel(level);
    return this.pickQuestion(diff, false);
  }

  /**
   * Automatically picks 1 correct answer + 2 random distractors from the 5 options (A-E)
   * and maps them onto the 3 lanes (0 = Left, 1 = Center, 2 = Right) labeled A, B, C.
   */
  public buildThreeLaneOptions(
    question: QuestionItem,
  ): [GateOptionDisplay, GateOptionDisplay, GateOptionDisplay] {
    const correctIdx = question.correctIndex;
    const distractorIndices = question.options
      .map((_, idx) => idx)
      .filter((idx) => idx !== correctIdx);

    // Fisher-Yates shuffle distractors
    for (let i = distractorIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [distractorIndices[i], distractorIndices[j]] = [
        distractorIndices[j],
        distractorIndices[i],
      ];
    }

    const chosen = [
      { text: question.options[correctIdx], isCorrect: true },
      { text: question.options[distractorIndices[0]], isCorrect: false },
      { text: question.options[distractorIndices[1]], isCorrect: false },
    ];

    // Shuffle across the 3 lanes
    for (let i = chosen.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
    }

    const labels: ['A', 'B', 'C'] = ['A', 'B', 'C'];
    return [
      {
        lane: 0,
        label: labels[0],
        text: chosen[0].text,
        isCorrect: chosen[0].isCorrect,
      },
      {
        lane: 1,
        label: labels[1],
        text: chosen[1].text,
        isCorrect: chosen[1].isCorrect,
      },
      {
        lane: 2,
        label: labels[2],
        text: chosen[2].text,
        isCorrect: chosen[2].isCorrect,
      },
    ];
  }
}

export const totalQuestionCount = ALL_QUESTIONS.length;
