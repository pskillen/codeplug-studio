import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import RadioDebugPage from './RadioDebugPage.tsx';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { exampleArchive } from './debugReadHistory.fixture.ts';
import { radioDebugDescriptors } from './descriptors.ts';

const withCapture = radioDebugDescriptors.filter((descriptor) => descriptor.capture);

function open(slug: string) {
  render(
    <MemoryRouter initialEntries={[`/debug/radios/${slug}`]}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
}

const read = (modelId: string, capturedAt: string) => {
  const archive = exampleArchive(capturedAt);
  return { ...archive, manifest: { ...archive.manifest, radioModelId: modelId } };
};

describe('Compare picker on every radio with a capture', () => {
  beforeEach(() => {
    for (const descriptor of withCapture) getDebugReadHistory(descriptor).clear();
  });

  it('keeps a read history on every radio that can capture', () => {
    expect(withCapture.length).toBeGreaterThanOrEqual(6);
    for (const descriptor of withCapture) expect(descriptor.readHistory).toBe(true);
  });

  for (const descriptor of withCapture) {
    it(`${descriptor.slug}: asks for a second read when there is only one`, () => {
      open(descriptor.slug);
      expect(screen.getByText('Read or open a second capture to compare.')).toBeInTheDocument();
    });

    it(`${descriptor.slug}: defaults to previous vs latest, swaps, and a pick survives a new read`, () => {
      const store = getDebugReadHistory(descriptor);
      const model = descriptor.archiveModelId;
      store.importArchives([read(model, '2026-01-01T00:00:00Z')]);
      store.importArchives([read(model, '2026-01-02T00:00:00Z')]);
      open(descriptor.slug);
      expect(screen.getByRole('combobox', { name: 'Compare A' })).toHaveDisplayValue(/^A ·/);
      expect(screen.getByRole('combobox', { name: 'Compare B' })).toHaveDisplayValue(/^B ·/);
      fireEvent.click(screen.getByRole('button', { name: 'Swap A and B' }));
      expect(screen.getByRole('combobox', { name: 'Compare A' })).toHaveDisplayValue(/^B ·/);
      expect(screen.getByRole('combobox', { name: 'Compare B' })).toHaveDisplayValue(/^A ·/);
      store.importArchives([read(model, '2026-01-03T00:00:00Z')]);
      const { entries, comparePair } = store.getSnapshot();
      expect(comparePair).toEqual({ a: entries[1]!.id, b: entries[0]!.id });
    });
  }

  it('shows the chosen pair in the generic compare (RT95)', () => {
    const descriptor = withCapture.find((item) => item.slug === 'rt95')!;
    const store = getDebugReadHistory(descriptor);
    for (const at of ['2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '2026-01-03T00:00:00Z'])
      store.importArchives([read(descriptor.archiveModelId, at)]);
    open('rt95');
    expect(screen.getByText(/Capture A: 2026-01-02T00:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText(/Capture B: 2026-01-03T00:00:00Z/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Compare A' }));
    fireEvent.click(screen.getByRole('option', { name: /^A ·/ }));
    expect(screen.getByText(/Capture A: 2026-01-01T00:00:00Z/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Swap A and B' }));
    expect(screen.getByText(/Capture A: 2026-01-03T00:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText(/Capture B: 2026-01-01T00:00:00Z/)).toBeInTheDocument();
  });

  it('says so when A and B are the same read', () => {
    const descriptor = withCapture.find((item) => item.slug === 'dm-32uv')!;
    const store = getDebugReadHistory(descriptor);
    const [one] = store.importArchives([read('DM-32UV', '2026-01-01T00:00:00Z')]);
    store.importArchives([read('DM-32UV', '2026-01-02T00:00:00Z')]);
    store.setComparePair({ a: one!.id, b: one!.id });
    open('dm-32uv');
    expect(screen.getByText('Same read on both sides')).toBeInTheDocument();
    expect(screen.getByText('Capture B: Not selected')).toBeInTheDocument();
  });
});
