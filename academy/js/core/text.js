// Text helpers shared by the evaluator and the UI. Pure functions: no DOM, no I/O.

/**
 * Normalise a learner's answer before checks run: join shell line continuations
 * (a trailing backslash + newline), turn tabs into spaces, collapse runs of spaces,
 * and normalise Windows line endings. Newlines are kept so multi-line JSON/Bicep still reads.
 */
export function normalizeAnswer(answer) {
  return String(answer ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\\\n[ \t]*/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Split prose into paragraphs on blank lines, dropping empty ones. */
export function paragraphs(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Tokenise one paragraph into text and `inline code` runs, so the UI can render code without
 * ever using innerHTML. An unmatched backtick is kept as literal text.
 */
export function parseInline(text) {
  const tokens = [];
  const re = /`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: text.slice(last, m.index) });
    tokens.push({ type: 'code', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  return tokens;
}
