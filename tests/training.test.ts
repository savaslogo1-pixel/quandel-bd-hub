import { CAPSTONE_RUBRIC, gradeQuiz, rubricTotal, sessionParts } from "../lib/training/logic";

let fail = 0;
const eq = (a: unknown, b: unknown, m: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log("FAIL", m, JSON.stringify(a), "≠", JSON.stringify(b)); } else console.log("ok  ", m);
};

const qs = [0, 1, 2, 3, 4].map((i) => ({ id: `q${i}`, options: ["a", "b", "c"], correctIndex: i % 3 }));
eq(gradeQuiz(qs, { q0: 0, q1: 1, q2: 2, q3: 0, q4: 1 }, 80), { correct: 5, total: 5, scorePct: 100, passed: true }, "all right");
eq(gradeQuiz(qs, { q0: 0, q1: 1, q2: 2, q3: 0 }, 80), { correct: 4, total: 5, scorePct: 80, passed: true }, "80% passes (SPEC: 80% to pass)");
eq(gradeQuiz(qs, { q0: 0, q1: 1, q2: 2 }, 80), { correct: 3, total: 5, scorePct: 60, passed: false }, "60% fails; unanswered counts wrong");
eq(gradeQuiz([], {}, 80).passed, false, "an empty quiz can't be passed");

eq(CAPSTONE_RUBRIC.criteria.reduce((a, c) => a + c.max, 0), 100, "capstone rubric totals 100");
eq(CAPSTONE_RUBRIC.criteria.map((c) => c.max), [25, 20, 15, 15, 15, 10], "stack 25, approvals 20, delivery 15, need 15, answers 15, ethics 10");
eq(rubricTotal(CAPSTONE_RUBRIC, { stack: 22, approvals: 18, delivery: 12, need: 14, answers: 11, ethics: 10 }, false), 87, "rubric sum");
eq(rubricTotal(CAPSTONE_RUBRIC, { stack: 40, approvals: -3 }, false), 25, "clamped to each criterion's range");
eq(rubricTotal(CAPSTONE_RUBRIC, { stack: 25, approvals: 20, delivery: 15, need: 15, answers: 15, ethics: 10 }, true), 0, "any ethics violation = 0");

eq(sessionParts({ deckReviewed: true, questionCount: 0, bestAttemptPassed: false, hasDeliverable: false, deliverableAccepted: false }).complete, true, "deck only when no quiz or deliverable yet");
eq(sessionParts({ deckReviewed: true, questionCount: 5, bestAttemptPassed: false, hasDeliverable: false, deliverableAccepted: false }), { deck: "done", quiz: "todo", deliverable: "n/a", complete: false }, "quiz must be passed once it exists");
eq(sessionParts({ deckReviewed: true, questionCount: 5, bestAttemptPassed: true, hasDeliverable: true, deliverableAccepted: false }).complete, false, "deliverable must be accepted");
eq(sessionParts({ deckReviewed: false, questionCount: 5, bestAttemptPassed: true, hasDeliverable: true, deliverableAccepted: true }).complete, false, "deck still required");
eq(sessionParts({ deckReviewed: true, questionCount: 5, bestAttemptPassed: true, hasDeliverable: true, deliverableAccepted: true }).complete, true, "all parts done");

if (fail) process.exit(1);
