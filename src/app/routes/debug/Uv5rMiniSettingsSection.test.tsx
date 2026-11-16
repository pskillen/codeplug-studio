import { decodeUv5rMiniFullRead } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { hashUv5rMiniDebugSpans } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';

import Uv5rMiniSettingsSection from './Uv5rMiniSettingsSection.tsx';
import { Uv5rMiniDebugReadStore } from './uv5rMiniDebugReads.ts';

/** Synthetic read: settings and VFO frames set, everything else zero. */
function syntheticRead(): Uint8Array {
  const read = new Uint8Array(0x10000);
  read.set([3, 1, 4, 3, 1, 8], 0x9000);
  read.set([1, 4, 6, 5, 2, 0, 0, 0], 0x8000);
  read.set([4, 3, 0, 1, 2, 5, 0, 0], 0x8020);
  return read;
}

function renderSection(decoded?: Uint8Array) {
  const store = new Uv5rMiniDebugReadStore();
  if (decoded) {
    store.add({
      ident: { f: new Uint8Array(16), m: new Uint8Array(15) },
      raw: decodeUv5rMiniFullRead(decoded),
      decoded,
      spans: hashUv5rMiniDebugSpans(decoded),
    });
  }
  return render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <Uv5rMiniSettingsSection reads={store.getSnapshot().reads} />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

describe('Uv5rMiniSettingsSection', () => {
  it('asks for a read when there is none', () => {
    renderSection();
    expect(screen.getByText('Take a read to view its settings.')).toBeTruthy();
  });

  it('shows the settings frame with counts, confidence and unused bytes', () => {
    renderSection(syntheticRead());
    const s = within(screen.getByTestId('uv5r-mini-settings'));
    expect(
      s.getByText(/45 bytes named \(41 traced, 4 inferred\), 19 bytes unused \(no reader\)/),
    ).toBeTruthy();
    const table = within(screen.getByTestId('uv5r-mini-settings-frame'));
    expect(table.getByText('Backlight')).toBeTruthy();
    expect(table.getAllByText(/^15 s/).length).toBeGreaterThan(0);
    expect(table.getAllByText('unused (no reader)').length).toBe(7);
    expect(table.getAllByText('partly traced').length).toBeGreaterThan(0);
    expect(table.getByText(/CHIRP writes the second programmable key at 0x34/)).toBeTruthy();
  });

  it('shows both VFO records side by side', () => {
    renderSection(syntheticRead());
    const table = within(screen.getByTestId('uv5r-mini-vfo-frame'));
    expect(table.getByText('VFO A')).toBeTruthy();
    expect(table.getByText('VFO B')).toBeTruthy();
    expect(table.getByText(/146\.52000 MHz/)).toBeTruthy();
    expect(table.getByText(/430\.12500 MHz/)).toBeTruthy();
    expect(
      s(screen).getByText(/24 bytes named \(22 traced, 2 inferred\), 8 bytes unused/),
    ).toBeTruthy();
  });

  it('offers nothing to download, copy or send', () => {
    renderSection(syntheticRead());
    const section = screen.getByTestId('uv5r-mini-settings');
    expect(within(section).queryAllByRole('button')).toHaveLength(0);
    expect(section.querySelector('a, [download]')).toBeNull();
  });
});

function s(scope: typeof screen) {
  return within(scope.getByTestId('uv5r-mini-settings'));
}
