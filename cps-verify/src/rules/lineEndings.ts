import type { VerifyDiagnostic } from '../types.ts';

/**
 * Require CRLF line endings for CPS text files.
 * Empty files and files with no newlines are treated as OK (no lines to terminate).
 */
export function checkCrlfLineEndings(fileName: string, text: string): VerifyDiagnostic[] {
  if (!text.includes('\n')) return [];
  // Any LF not preceded by CR is a failure; also flag lone CR without LF as unusual
  const diagnostics: VerifyDiagnostic[] = [];
  let lfCount = 0;
  let crlfCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      if (i > 0 && text[i - 1] === '\r') {
        crlfCount++;
      } else {
        lfCount++;
      }
    }
  }
  if (lfCount > 0) {
    diagnostics.push({
      rule: 'line-endings',
      file: fileName,
      message: `Expected CRLF line endings; found ${lfCount} LF-only newline(s) (${crlfCount} CRLF).`,
    });
  }
  return diagnostics;
}
