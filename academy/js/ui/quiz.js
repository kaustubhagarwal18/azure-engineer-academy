// Exam-style quiz with feedback on the chosen option and the full explanation after answering.

import { h, inline, notice, missionCrumbs } from './dom.js';
import { href } from '../core/router.js';
import { answerQuiz, quizKey, quizProgress } from '../core/progress.js';

/** Render a mission's quiz. */
export function quizView(app, { missionId }) {
  const mission = app.content.missionsById[missionId];
  if (!mission) return null;
  const state = app.store.getState();
  const p = quizProgress(state, mission);

  const questions = mission.quiz.map((q, qi) => {
    const key = quizKey(mission.id, q.id);
    const rec = state.quiz[key];
    const name = `q-${q.id}`;
    const error = h('p', { class: 'field-error', id: `${name}-error`, hidden: true }, 'Choose an option first.');

    const options = q.options.map((opt, oi) => {
      const id = `${name}-${oi}`;
      const chosen = rec?.lastChoice === oi;
      const cls = rec && chosen ? (rec.correct ? 'opt-correct' : 'opt-wrong') : '';
      return h('li', { class: `option ${cls}` },
        h('input', { type: 'radio', name, id, value: String(oi), checked: chosen }),
        h('label', { for: id }, inline(opt)),
        rec && chosen && h('span', { class: 'visually-hidden' }, rec.correct ? ' (your answer, correct)' : ' (your answer, incorrect)'),
      );
    });

    let feedback = null;
    if (rec) {
      const chosenFeedback = q.optionFeedback?.[rec.lastChoice];
      feedback = h('div', { id: `${name}-feedback`, tabindex: '-1' },
        rec.correct
          ? notice('success', h('strong', {}, 'Correct. '), inline(q.explanation))
          : notice('warn', h('strong', {}, 'Not quite. '), chosenFeedback ? inline(chosenFeedback) : 'Have another look.', ' Try again — the explanation appears once you get it right.'),
        rec.correct && !rec.firstTryCorrect && h('p', { class: 'muted small' }, 'Missed on the first try, so this topic is in your revision plan.'),
      );
    }

    return h('li', { class: 'card question' },
      h('form', {
        'aria-labelledby': `${name}-legend`,
        onSubmit: (e) => {
          e.preventDefault();
          const picked = e.target.querySelector(`input[name="${name}"]:checked`);
          if (!picked) {
            error.hidden = false;
            e.target.querySelector('input').focus();
            return;
          }
          const choice = Number(picked.value);
          const correct = choice === q.answer;
          app.store.update((s) => answerQuiz(s, key, choice, correct));
          app.announce(correct ? `Question ${qi + 1}: correct.` : `Question ${qi + 1}: not quite.`);
          app.rerender({ focusId: `${name}-feedback` });
        },
      },
      h('fieldset', {},
        h('legend', { id: `${name}-legend` }, h('span', { class: 'eyebrow' }, `Question ${qi + 1} of ${mission.quiz.length}`), h('span', { class: 'q-prompt' }, inline(q.prompt))),
        h('ul', { class: 'options', role: 'list' }, options),
      ),
      error,
      h('button', { type: 'submit' }, rec ? 'Check again' : 'Check answer'),
      ),
      feedback,
    );
  });

  const node = h('div', { class: 'stack' },
    missionCrumbs(app, mission, ['Quiz', href.quiz(mission.id)]),
    h('h1', {}, `${mission.id.toUpperCase()} quiz`),
    h('p', {}, `${p.done} of ${p.total} correct · ${p.correctFirstTry} correct on the first try. Only the first try counts toward the "Quiz ace" achievement and your weak topics.`),
    h('ol', { class: 'stack questions', role: 'list' }, questions),
    h('a', { href: href.mission(mission.id) }, '← Back to the mission'),
  );
  return { title: `${mission.id.toUpperCase()} quiz`, node };
}
