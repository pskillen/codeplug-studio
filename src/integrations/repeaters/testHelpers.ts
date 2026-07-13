export {
  createSessionStorageMock,
  setupIntegrationHttpTestMocks as setupRepeaterDirectoryTestMocks,
  teardownIntegrationHttpTestMocks as teardownRepeaterDirectoryTestMocks,
} from '../http/testHelpers.ts';
import { vi } from 'vitest';

export function mockJsonFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

export function mockTextFetch(status: number, body: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status })),
  );
}
