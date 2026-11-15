import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DebugReadHistoryControls } from './DebugReadHistoryControls.tsx';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { exampleArchive } from './debugReadHistory.fixture.ts';
import { downloadZip } from '@integrations/download/browserDownload.ts';

vi.mock('@integrations/download/browserDownload.ts', () => ({ downloadZip: vi.fn() }));
const descriptor = { slug: 'controls-test', archiveModelId: 'AT-D890UV' };
const store = getDebugReadHistory(descriptor);
const show = () =>
  render(
    <MantineProvider>
      <DebugReadHistoryControls descriptor={descriptor} store={store} />
    </MantineProvider>,
  );
beforeEach(() => {
  store.clear();
  vi.resetAllMocks();
});
describe('history controls', () => {
  it('marks only the entries present when a successful download started', async () => {
    store.add(exampleArchive());
    let resolve!: (value: { status: 'saved' }) => void;
    vi.mocked(downloadZip).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Download all reads' }));
    act(() => {
      store.add(exampleArchive());
    });
    resolve({ status: 'saved' });
    await waitFor(() => expect(store.getSnapshot().undownloaded).toBe(1));
  });
  it('retains undownloaded status on failure and confirms clear', async () => {
    store.add(exampleArchive());
    vi.mocked(downloadZip).mockRejectedValue(new Error('Save failed'));
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Download all reads' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed');
    expect(store.getSnapshot().undownloaded).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(store.getSnapshot().entries).toHaveLength(1);
    fireEvent.click(await screen.findByRole('button', { name: 'Clear', exact: true }));
    expect(store.getSnapshot().entries).toHaveLength(0);
  });
});
