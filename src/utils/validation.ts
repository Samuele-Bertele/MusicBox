/**
 * Input hygiene. React already escapes rendered text, so this is about
 * normalising what we persist: no control characters, no unbounded strings,
 * no accidental markup ending up in an export file.
 */
export function sanitizeText(value: string, maxLength = 200): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function passwordProblem(value: string): string | null {
  if (value.length < 8) return 'La password deve contenere almeno 8 caratteri.';
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) return 'Usa almeno una lettera e un numero.';
  return null;
}
