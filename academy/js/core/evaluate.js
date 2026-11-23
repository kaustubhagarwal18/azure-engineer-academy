// Rule-based answer checks. These are deliberately honest about what they are: pattern rules that
// catch common, specific mistakes (a missing flag, the wrong scope, an over-broad role). They do
// not understand the answer and cannot judge an equivalent solution written differently — that
// is what the mentor review is for.

import { normalizeAnswer } from './text.js';

/** Compile a check's pattern once; throws on an invalid regex (content validation relies on it). */
export function compileCheck(check) {
  return new RegExp(check.pattern, check.flags ?? '');
}

/**
 * Evaluate an answer against a task's checks.
 * Each check is { id, kind: 'require' | 'forbid', pattern, flags?, description, mistake }.
 * `require` passes when the pattern matches; `forbid` passes when it does not.
 * Returns { empty, passed, results: [{ id, description, passed, mistake }] }.
 * An empty answer never passes, even for a task whose checks are all `forbid` rules.
 */
export function evaluate(answer, checks) {
  const text = normalizeAnswer(answer);
  const empty = text === '';
  const results = checks.map((check) => {
    const hit = compileCheck(check).test(text);
    const passed = !empty && (check.kind === 'forbid' ? !hit : hit);
    return {
      id: check.id,
      description: check.description,
      passed,
      mistake: passed ? null : check.mistake,
    };
  });
  return { empty, passed: !empty && results.every((r) => r.passed), results };
}
