const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Read a text file via FileReader with a size guard. */
export async function readTextFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File is too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
