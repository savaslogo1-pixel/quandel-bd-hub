// Training rules (SPEC §10.2). Pure functions; see tests/training.test.ts.
import training from "@/data/training.json";

export type Rubric = { criteria: { key: string; label: string; max: number }[]; ethicsViolationScoresZero: boolean };
export const CAPSTONE_RUBRIC = training.capstoneRubric as Rubric;
export const MOCK_BOARD_ROLES = training.mockBoardRoles;
export const NINETY_DAYS = training.ninetyDays as { key: string; phase: string; label: string; auto?: string; goal?: number }[];
export const ATTESTATION_STATEMENT = training.attestationStatement;

export type Question = { id: string; options: string[]; correctIndex: number };

/** Grade answers ({questionId: chosenIndex}); unanswered questions count as wrong. */
export function gradeQuiz(questions: Question[], answers: Record<string, number>, passPct: number) {
  const total = questions.length;
  const correct = questions.filter((q) => answers[q.id] === q.correctIndex).length;
  const scorePct = total ? Math.round((correct / total) * 100) : 0;
  return { correct, total, scorePct, passed: total > 0 && scorePct >= passPct };
}

/** Capstone total on the 100-point rubric; any ethics violation = 0. Points are clamped to each criterion's max. */
export function rubricTotal(rubric: Rubric, scores: Record<string, number | null | undefined>, ethicsViolation: boolean) {
  if (ethicsViolation && rubric.ethicsViolationScoresZero) return 0;
  return rubric.criteria.reduce((a, c) => a + Math.max(0, Math.min(c.max, Math.round(Number(scores[c.key] ?? 0)))), 0);
}

export type PartState = "done" | "todo" | "n/a";
export type SessionParts = { deck: PartState; quiz: PartState; deliverable: PartState; complete: boolean };

/**
 * A session is complete when the learner has gone through the deck, passed the quiz
 * (only if the session has quiz questions yet) and had the deliverable accepted (only if
 * the session has one). Parts that don't exist yet don't block completion.
 */
export function sessionParts(input: {
  deckReviewed: boolean;
  questionCount: number;
  bestAttemptPassed: boolean;
  hasDeliverable: boolean;
  deliverableAccepted: boolean;
}): SessionParts {
  const deck: PartState = input.deckReviewed ? "done" : "todo";
  const quiz: PartState = input.questionCount === 0 ? "n/a" : input.bestAttemptPassed ? "done" : "todo";
  const deliverable: PartState = !input.hasDeliverable ? "n/a" : input.deliverableAccepted ? "done" : "todo";
  return { deck, quiz, deliverable, complete: [deck, quiz, deliverable].every((p) => p !== "todo") };
}
