/** @type {import('prettier').Config} */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  // Windows: CRLF in the working tree (Git checkout). Linux CI: LF (repository canonical).
  endOfLine: process.platform === 'win32' ? 'crlf' : 'lf',
};
