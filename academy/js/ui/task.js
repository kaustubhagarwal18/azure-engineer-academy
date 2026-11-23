// Task player: scenario -> challenge -> answer -> rule checks -> progressive hints -> solution
// (after an attempt) -> mentor review. The rule checks are presented as what they are: pattern
// rules that catch common mistakes. The mentor review is where real judgement happens.

import { h, rich, inline, codeBlock, statusBadge, notice, missionCrumbs } from './dom.js';
import { href } from '../core/router.js';
import {
  MODE_LABELS, taskKey, taskRecord, taskStatus, recordAttempt, showNextHint, canRevealSolution,
  revealSolution, setMentorVerdict,
} from '../core/progress.js';
import { evaluate } from '../core/evaluate.js';
import { buildMentorPrompt } from '../core/mentorPrompt.js';

/** Unsubmitted answers, kept per task while the tab is open so re-renders never lose typing. */
const drafts = new Map();

const ANSWER_LABELS = {
  cli: ['Your Azure CLI command(s)', 'Shell line continuations (\\) are fine.'],
  json: ['Your JSON', 'Paste the full JSON document.'],
  bicep: ['Your Bicep', 'The whole file or module.'],
  text: ['Your write-up', 'Plain prose. Be specific: symptom, cause, fix, and what you would not do.'],
};

/** Render one task. */
export function taskView(app, { missionId, mode, taskId }) {
  const mission = app.content.missionsById[missionId];
  const tasks = mission?.modes[mode]?.tasks ?? [];
  const index = tasks.findIndex((t) => t.id === taskId);
  if (index === -1) return null;
  const task = tasks[index];
  const key = taskKey(mission.id, mode, task.id);
  const record = taskRecord(app.store.getState(), key);
  const status = taskStatus(task, record);
  const draft = drafts.has(key) ? drafts.get(key) : record.lastAnswer;
  const [answerLabel, answerHelp] = ANSWER_LABELS[task.answerType];
  const isCode = task.answerType !== 'text';

  /** Update state and re-render, then focus the element with the given id. */
  const act = (fn, focusId, message) => {
    app.store.update(fn);
    if (message) app.announce(message);
    app.rerender({ focusId });
  };

  // ---- answer form ---------------------------------------------------------------------------
  const textarea = h('textarea', {
    id: 'answer', name: 'answer', rows: isCode ? '10' : '8', class: isCode ? 'mono' : '',
    spellcheck: isCode ? 'false' : 'true', autocapitalize: 'off', 'aria-describedby': 'answer-help',
    value: draft,
    onInput: (e) => drafts.set(key, e.target.value),
  });
  const formError = h('p', { id: 'answer-error', class: 'field-error', hidden: true }, 'Write an answer before checking it — an empty submission does not count as an attempt.');
  const form = h('form', {
    class: 'card answer-form', 'aria-labelledby': 'answer-h', novalidate: true,
    onSubmit: (e) => {
      e.preventDefault();
      const answer = textarea.value;
      if (answer.trim() === '') {
        formError.hidden = false;
        textarea.setAttribute('aria-invalid', 'true');
        textarea.setAttribute('aria-describedby', 'answer-help answer-error');
        textarea.focus();
        return;
      }
      const evaluation = evaluate(answer, task.checks);
      drafts.set(key, answer);
      const passedCount = evaluation.results.filter((r) => r.passed).length;
      act((s) => recordAttempt(s, key, answer, evaluation), 'feedback-h',
        `${passedCount} of ${evaluation.results.length} checks passed.`);
    },
  },
  h('h2', { id: 'answer-h' }, 'Your answer'),
  h('label', { for: 'answer' }, answerLabel),
  h('p', { id: 'answer-help', class: 'muted small' }, answerHelp),
  textarea,
  formError,
  h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary' }, record.attempts > 0 ? 'Check again' : 'Check my answer')),
  );

  // ---- feedback --------------------------------------------------------------------------------
  let feedback = null;
  if (record.attempts > 0) {
    const ev = evaluate(record.lastAnswer, task.checks);
    const passedCount = ev.results.filter((r) => r.passed).length;
    const verdict = ev.passed
      ? (task.review === 'mentor'
        ? notice('info', 'Your write-up covers the key points the rules look for. Open-ended answers need judgement, so this task completes with a mentor PASS — see "Mentor review" below.')
        : notice('success', 'All checks passed — task complete. A mentor review is still worth it: the rules cannot tell you whether your reasoning is sound.'))
      : notice('warn', 'Not yet. Each ✗ below explains the mistake. Fix it and check again, or open the next hint.');
    feedback = h('section', { class: 'card', 'aria-labelledby': 'feedback-h' },
      h('h2', { id: 'feedback-h', tabindex: '-1' }, `Automated checks: ${passedCount} of ${ev.results.length} passed`),
      h('p', { class: 'muted small' },
        `Attempt ${record.attempts}. These are pattern rules for common mistakes on your last submitted answer. `,
        'They can reject a valid alternative or miss a subtle error — the mentor review is the real judgement.'),
      verdict,
      h('ul', { class: 'checks' }, ev.results.map((r) => h('li', { class: r.passed ? 'check-pass' : 'check-fail' },
        h('span', { class: 'check-icon', 'aria-hidden': 'true' }, r.passed ? '✓' : '✗'),
        h('div', {},
          h('span', { class: 'visually-hidden' }, r.passed ? 'Passed: ' : 'Failed: '),
          h('span', {}, inline(r.description)),
          r.mistake && h('p', { class: 'mistake' }, inline(r.mistake))),
      ))),
    );
  }

  // ---- hints -----------------------------------------------------------------------------------
  const hintsLeft = task.hints.length - record.hintsShown;
  const hints = h('section', { class: 'card', 'aria-labelledby': 'hints-h' },
    h('h2', { id: 'hints-h' }, 'Hints'),
    record.hintsShown === 0 && h('p', { class: 'muted' }, 'Try first. Each hint is a little more specific than the last; hints used feed your revision plan.'),
    record.hintsShown > 0 && h('ol', { class: 'hints', id: 'hint-list' },
      task.hints.slice(0, record.hintsShown).map((hint, i) => h('li', { id: `hint-${i}`, tabindex: '-1' }, inline(hint)))),
    hintsLeft > 0
      ? h('button', {
        type: 'button', id: 'hint-btn',
        onClick: () => act((s) => showNextHint(s, key, task.hints.length), `hint-${record.hintsShown}`, `Hint ${record.hintsShown + 1} shown.`),
      }, `Show hint ${record.hintsShown + 1} of ${task.hints.length}`)
      : h('p', { class: 'muted small' }, 'All hints shown.'),
  );

  // ---- solution --------------------------------------------------------------------------------
  let solutionBody;
  if (record.solutionRevealed) {
    solutionBody = [
      codeBlock(task.solution.code, 'Reference solution'),
      rich(task.solution.explanation),
      record.solutionBeforeComplete && h('p', { class: 'muted small' }, 'You revealed this before solving the task, so it counts toward this topic in your revision plan. Close it, then solve the task in your own words.'),
    ];
  } else if (!canRevealSolution(record)) {
    solutionBody = [
      h('p', { class: 'muted', id: 'solution-locked' }, 'The solution unlocks after your first submitted attempt.'),
      h('button', { type: 'button', disabled: true, 'aria-describedby': 'solution-locked' }, 'Reveal solution'),
    ];
  } else {
    solutionBody = [
      status !== 'complete' && h('p', { class: 'muted' }, 'Revealing before you have solved the task is recorded and feeds your revision plan. Another hint might be enough.'),
      h('button', { type: 'button', id: 'solution-btn', onClick: () => act((s) => revealSolution(s, key, task), 'solution-h', 'Solution revealed.') }, 'Reveal solution'),
    ];
  }
  const solution = h('section', { class: 'card', 'aria-labelledby': 'solution-h' }, h('h2', { id: 'solution-h', tabindex: '-1' }, 'Solution'), solutionBody);

  // ---- mentor review ---------------------------------------------------------------------------
  const copyStatus = h('p', { class: 'muted small', id: 'copy-status', role: 'status' });
  const promptText = h('textarea', { id: 'prompt-text', class: 'mono', rows: '10', readonly: true, 'aria-label': 'Mentor review prompt' });
  const promptDetails = h('details', {}, h('summary', {}, 'Show the prompt (to copy by hand)'), promptText);
  /** Build the prompt from whatever is in the answer box right now. */
  const currentPrompt = () => {
    const answer = textarea.value;
    return buildMentorPrompt({ mission, mode, task, answer, evaluation: answer.trim() ? evaluate(answer, task.checks) : null, hintsShown: record.hintsShown });
  };
  promptDetails.addEventListener('toggle', () => { promptText.value = currentPrompt(); });
  const notes = h('textarea', { id: 'mentor-notes', rows: '3', value: record.mentorNotes, 'aria-describedby': 'notes-help' });
  const verdictText = { pass: 'PASS', 'needs-work': 'NEEDS WORK' };

  const mentor = h('section', { class: 'card', 'aria-labelledby': 'mentor-h' },
    h('h2', { id: 'mentor-h', tabindex: '-1' }, 'Mentor review'),
    h('p', {}, 'Static rules cannot review reasoning. Copy a ready-made prompt, paste it into ChatGPT (or another AI mentor), and record the verdict here. ',
      'The prompt includes the scenario, your answer, the rule-check results and your hint count — never the solution. Nothing is sent anywhere by this page.'),
    h('div', { class: 'row' },
      h('button', {
        type: 'button', id: 'copy-btn',
        onClick: async () => {
          const prompt = currentPrompt();
          promptText.value = prompt;
          try {
            await navigator.clipboard.writeText(prompt);
            copyStatus.textContent = 'Copied. Paste it into your mentor chat.';
          } catch {
            promptDetails.open = true;
            promptText.focus();
            promptText.select();
            copyStatus.textContent = 'Could not copy automatically. The prompt is selected below — press Ctrl+C (Cmd+C on a Mac).';
          }
        },
      }, 'Copy review prompt'),
    ),
    copyStatus,
    promptDetails,
    h('h3', {}, 'Record the verdict'),
    record.mentor
      ? h('p', { id: 'verdict-now', tabindex: '-1' }, 'Recorded: ', h('strong', {}, verdictText[record.mentor]))
      : h('p', { id: 'verdict-now', tabindex: '-1', class: 'muted' }, 'No verdict recorded yet.'),
    h('label', { for: 'mentor-notes' }, 'Mentor feedback to remember (optional)'),
    h('p', { id: 'notes-help', class: 'muted small' }, 'Stored only in this browser.'),
    notes,
    h('div', { class: 'row' },
      h('button', { type: 'button', onClick: () => act((s) => setMentorVerdict(s, key, 'pass', notes.value), 'verdict-now', 'Mentor verdict PASS recorded.') }, 'Mentor said PASS'),
      h('button', { type: 'button', onClick: () => act((s) => setMentorVerdict(s, key, 'needs-work', notes.value), 'verdict-now', 'Mentor verdict NEEDS WORK recorded.') }, 'Mentor said NEEDS WORK'),
      record.mentor && h('button', { type: 'button', class: 'link', onClick: () => act((s) => setMentorVerdict(s, key, null, notes.value), 'verdict-now', 'Verdict cleared.') }, 'Clear verdict'),
    ),
  );

  // ---- page ------------------------------------------------------------------------------------
  const prev = tasks[index - 1];
  const next = tasks[index + 1];
  const node = h('div', { class: 'stack task' },
    missionCrumbs(app, mission, [MODE_LABELS[mode], href.mission(mission.id)], [task.title, href.task(mission.id, mode, task.id)]),
    h('p', { class: 'eyebrow' }, `${MODE_LABELS[mode]} · Task ${index + 1} of ${tasks.length}`),
    h('div', { class: 'row spread' }, h('h1', {}, task.title), statusBadge(status)),
    h('section', { class: 'card', 'aria-labelledby': 'scenario-h' }, h('h2', { id: 'scenario-h' }, 'Scenario'), rich(task.scenario)),
    h('section', { class: 'card challenge', 'aria-labelledby': 'challenge-h' }, h('h2', { id: 'challenge-h' }, 'Your challenge'), rich(task.challenge)),
    form,
    feedback,
    h('div', { class: 'grid two' }, hints, solution),
    mentor,
    h('nav', { class: 'row spread pager', 'aria-label': 'Task navigation' },
      prev ? h('a', { href: href.task(mission.id, mode, prev.id) }, `← ${prev.title}`) : h('a', { href: href.mission(mission.id) }, '← Mission overview'),
      next ? h('a', { href: href.task(mission.id, mode, next.id) }, `${next.title} →`) : h('a', { href: href.mission(mission.id) }, `Finish ${MODE_LABELS[mode]} →`),
    ),
  );
  return { title: `${task.title} · ${mission.id.toUpperCase()}`, node };
}
