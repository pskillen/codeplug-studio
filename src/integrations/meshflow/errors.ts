export class MeshflowError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'MeshflowError';
    this.status = status;
  }
}
