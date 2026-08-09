export class SatelliteDirectoryError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SatelliteDirectoryError';
    this.status = status;
  }
}
