// Builds the review request the learner pastes into an AI mentor (e.g. ChatGPT).
// Nothing is sent anywhere by the academy: the prompt is copied to the clipboard and the learner
// chooses where to paste it. The solution is deliberately NOT included, so the mentor reviews
// the learner's reasoning instead of pattern-matching against the answer.

import { MODE_LABELS } from './progress.js';

/**
 * Build the mentor prompt for one task attempt.
 * args: { mission, mode, task, answer, evaluation (from evaluate()) | null, hintsShown }
 */
export function buildMentorPrompt({ mission, mode, task, answer, evaluation, hintsShown }) {
  const checks = evaluation
    ? evaluation.results.map((r) => `- [${r.passed ? 'pass' : 'FAIL'}] ${r.description}`).join('\n')
    : '- (not run: I have not submitted this answer yet)';
  const fence = task.answerType === 'bicep' ? 'bicep' : task.answerType === 'json' ? 'json' : task.answerType === 'cli' ? 'sh' : 'text';

  return [
    'You are my Azure mentor. I am preparing for the AZ-104 exam and learning by solving',
    'realistic engineering tasks. Review my answer below like a senior platform engineer would.',
    '',
    'Please:',
    '1. Say whether my answer would work as written, and why or why not.',
    '2. Explain each mistake and the concept behind it — do not just correct it.',
    '3. Point out least-privilege, security, cost or production concerns, even if it works.',
    '4. If I am wrong, give me a hint first rather than the full solution.',
    '5. End with a single line: "Verdict: PASS" or "Verdict: NEEDS WORK".',
    '',
    `Mission: ${mission.id.toUpperCase()} — ${mission.title}`,
    `Mode: ${MODE_LABELS[mode]}`,
    `Task: ${task.title}`,
    `AZ-104 topics: ${task.topics.join(', ')}`,
    '',
    'Scenario:',
    task.scenario,
    '',
    'Challenge:',
    task.challenge,
    '',
    'My answer:',
    '```' + fence,
    String(answer ?? '').trim() || '(empty)',
    '```',
    '',
    'Automated rule checks from the academy (simple pattern rules; they can miss valid',
    'alternatives and cannot judge correctness — weigh them, do not trust them):',
    checks,
    '',
    `Hints I used: ${hintsShown} of ${task.hints.length}.`,
  ].join('\n');
}
