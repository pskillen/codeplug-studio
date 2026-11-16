import { buildSyntheticRt95Image } from '@integrations/radio-io/radios/rt95/__fixtures__/syntheticImage.ts';
import { encodeBcdFreq } from '@integrations/radio-io/radios/rt95/bcd.ts';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DebugArchive } from '../captureArchive.ts';
import { radioDebugDescriptors } from '../descriptors.ts';
import { dm32Capture, dm32Page } from '../dm32Archive.fixture.ts';
import { archiveDm32Capture } from '../dm32Capture.ts';
import { rt95Archive } from '../rt95Archive.fixture.ts';
import { RadioCompare } from './RadioCompare.tsx';

const descriptor = (slug: string) => radioDebugDescriptors.find((d) => d.slug === slug)!;
const show = (slug: string, a: DebugArchive, b: DebugArchive) =>
  render(
    <MantineProvider>
      <RadioCompare descriptor={descriptor(slug)} a={a} b={b} />
    </MantineProvider>,
  );

describe('RT95 decoded diff on the shared compare', () => {
  it('shows only the one changed channel for 4 vs 5', () => {
    const a = buildSyntheticRt95Image();
    const b = buildSyntheticRt95Image();
    b.set(encodeBcdFreq(146_540_000), 0);
    show('rt95', rt95Archive(a), rt95Archive(b));
    const records = screen
      .getAllByRole('group')
      .filter((g) => /^Slot \d+ ·/.test(g.getAttribute('aria-label') ?? ''));
    expect(records).toHaveLength(1);
    expect(records[0]).toHaveTextContent('Slot 1 · TEST01');
    expect(within(records[0]!).getByText('changed')).toBeInTheDocument();
    expect(within(records[0]!).getAllByText('146.54000 MHz').length).toBeGreaterThan(0);
    // The summary names the category counts.
    expect(screen.getByRole('table', { name: 'Fields by category' })).toBeInTheDocument();
    expect(screen.getByText(/changed fields? in 1 record/)).toBeInTheDocument();
  });

  it('shows no decoded records for identical reads', () => {
    const img = buildSyntheticRt95Image();
    show('rt95', rt95Archive(img), rt95Archive(img.slice()));
    expect(screen.getByText('No decoded changes.')).toBeInTheDocument();
  });
});

describe('Mini decoded diff on the shared compare', () => {
  const SIZE = 32;
  const record = (name: string) => {
    const r = new Uint8Array(SIZE);
    r.set([0x00, 0x00, 0x00, 0x10], 0);
    r.set([0x00, 0x00, 0x00, 0x10], 4);
    r[12] = 0x01;
    r.set(new TextEncoder().encode(name).subarray(0, 12), 20);
    return r;
  };
  const image = (name: string) => {
    const img = new Uint8Array(0x10000);
    img.fill(0xff, 0, 999 * SIZE);
    img.set(record('TEST A'), 0);
    img.set(record(name), SIZE);
    return img;
  };
  const mini = (clone: Uint8Array) =>
    ({
      manifest: { radioModelId: 'UV-5R Mini', capturedAt: '2026-01-01', regions: [] },
      regions: { clone },
      sidecars: {},
      source: 'file',
    }) as unknown as DebugArchive;

  it('shows a renamed slot with (was ...) and the changed name field', () => {
    show('uv-5r-mini', mini(image('TEST B')), mini(image('TEST X')));
    const rec = screen.getByRole('group', { name: 'Slot 2 · TEST X (was TEST B)' });
    expect(within(rec).getByText('changed')).toBeInTheDocument();
  });

  it('shows no records when the channels match', () => {
    show('uv-5r-mini', mini(image('TEST B')), mini(image('TEST B')));
    expect(screen.queryByRole('group', { name: /^Slot/ })).not.toBeInTheDocument();
  });
});

describe('DM-32 decoded diff on the shared compare', () => {
  const bcd = (digits: string) =>
    digits
      .match(/../g)!
      .map((p) => parseInt(p, 16))
      .reverse();
  async function withChannel(rx: string) {
    const page = dm32Page(0x12);
    page[0] = 1;
    page[1] = 0;
    const rec = new Uint8Array(48);
    rec.set(new TextEncoder().encode('SIMPLEX'), 0);
    rec.set(bcd(rx), 0x10);
    rec.set(bcd(rx), 0x14);
    rec[0x19] = 0x80;
    page.set(rec, 0x10);
    return archiveDm32Capture(dm32Capture({ blocks: new Map([[0x1000, page]]), channelCount: 1 }));
  }

  it('shows one channel change', async () => {
    show('dm-32uv', await withChannel('14500000'), await withChannel('14600000'));
    const rec = screen.getByRole('group', { name: /Slot 1 · SIMPLEX/ });
    expect(within(rec).getByText('changed')).toBeInTheDocument();
    expect(within(rec).getAllByText('146.00000 MHz', { selector: 'mark' }).length).toBeGreaterThan(
      0,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show Channels in the decoded diff' }));
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('Channels');
  });
});
