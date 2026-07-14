export class RadioidDirectoryError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RadioidDirectoryError';
    this.status = status;
  }
}
