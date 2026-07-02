export class NativeYamlImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NativeYamlImportError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new NativeYamlImportError(`${label} must be an object`);
  }
  return value;
}

export function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new NativeYamlImportError(`${label} must be an array`);
  }
  return value;
}

export function expectString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new NativeYamlImportError(`${label} must be a string`);
  }
  return value;
}

export function expectNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new NativeYamlImportError(`${label} must be a number`);
  }
  return value;
}

export function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new NativeYamlImportError(`${label} must be a boolean`);
  }
  return value;
}

function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function expectOptionalString(value: unknown, label: string, defaultValue = ''): string {
  if (isNullish(value)) return defaultValue;
  return expectString(value, label);
}

export function expectNullableString(value: unknown, label: string): string | null {
  if (isNullish(value)) return null;
  return expectString(value, label);
}

export function expectNullableNumber(value: unknown, label: string): number | null {
  if (isNullish(value)) return null;
  return expectNumber(value, label);
}
