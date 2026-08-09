export {
  createSessionStorageMock,
  setupIntegrationHttpTestMocks as setupSatelliteDirectoryTestMocks,
  teardownIntegrationHttpTestMocks as teardownSatelliteDirectoryTestMocks,
} from '../http/testHelpers.ts';
import { vi } from 'vitest';

export function mockTextFetch(status: number, body: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status })),
  );
}

export function mockTextFetchError(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('network error');
    }),
  );
}
