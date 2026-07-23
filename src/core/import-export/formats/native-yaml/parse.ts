import { parse as parseYaml } from 'yaml';
import type { ProjectAggregate } from '../../projectDocument.ts';
import { NativeYamlImportError } from './errors.ts';
import { validateDocument, type ValidateDocumentResult } from './validate.ts';

/** Parse native YAML text into a validated project aggregate plus import warnings. */
export function parseProjectDocumentWithWarnings(text: string): ValidateDocumentResult {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new NativeYamlImportError(`Invalid YAML syntax: ${message}`);
  }

  if (raw === null || raw === undefined) {
    throw new NativeYamlImportError('Document must be a YAML mapping');
  }

  return validateDocument(raw);
}

/** Parse native YAML text into a validated project aggregate. */
export function parseProjectDocument(text: string): ProjectAggregate {
  return parseProjectDocumentWithWarnings(text).aggregate;
}
