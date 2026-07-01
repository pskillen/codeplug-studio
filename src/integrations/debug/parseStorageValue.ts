export interface ParsedStorageValue {
  parsed: unknown;
  parseError: string | null;
}

/** Parse a localStorage string — JSON objects/arrays, JSON primitives, or plain text. */
export function parseStorageRaw(raw: string | null): ParsedStorageValue {
  if (raw === null) {
    return { parsed: null, parseError: null };
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return { parsed: JSON.parse(raw) as unknown, parseError: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON';
      return { parsed: null, parseError: message };
    }
  }

  try {
    return { parsed: JSON.parse(raw) as unknown, parseError: null };
  } catch {
    return { parsed: { value: raw }, parseError: null };
  }
}

export function maskSensitiveToken(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}

export function redactParsedValue(parsed: unknown, redact: boolean): unknown {
  if (!redact) return parsed;
  if (typeof parsed === 'string') {
    return maskSensitiveToken(parsed);
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    'value' in parsed &&
    typeof (parsed as { value: unknown }).value === 'string'
  ) {
    return { value: maskSensitiveToken((parsed as { value: string }).value) };
  }
  return parsed;
}
