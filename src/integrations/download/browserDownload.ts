/** Browser file download helpers — integrations layer (DOM side effects). */

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(
  content: string,
  fileName: string,
  mimeType = 'text/csv;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, fileName);
}

export function downloadZip(zipBytes: Uint8Array, fileName: string): void {
  const blob = new Blob([new Uint8Array(zipBytes)], { type: 'application/zip' });
  downloadBlob(blob, fileName);
}

export function downloadBinaryFile(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
  downloadBlob(blob, fileName);
}

/** Current time as a filesystem-safe ISO 8601 stamp (`:` and `.` replaced with `-`). */
export function isoTimestampForFilename(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}
