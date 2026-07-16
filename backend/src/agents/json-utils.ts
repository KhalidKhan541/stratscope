export function cleanupJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  s = s.replace(/[\u2018\u2019\u201C\u201D]/g, (c) => {
    if (c === '\u2018' || c === '\u2019') return "'";
    return '"';
  });
  return s.trim();
}

export function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = cleanupJson(raw);
    return JSON.parse(cleaned);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        let fixed = match[0];
        fixed = fixed.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        try {
          return JSON.parse(fixed);
        } catch {}
      }
    }
    return fallback;
  }
}
