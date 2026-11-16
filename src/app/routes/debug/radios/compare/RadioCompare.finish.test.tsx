import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR } from '@integrations/radio-io/radios/opengd77/debugCapture.ts';
import { buildSyntheticRt95Image } from '@integrations/radio-io/radios/rt95/__fixtures__/syntheticImage.ts';
import { encodeBcdFreq } from '@integrations/radio-io/radios/rt95/bcd.ts';
import { MantineProvider } from '@mantine/core';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openDebugArchive, type DebugArchive } from '../captureArchive.ts';
import { radioDebugDescriptors } from '../descriptors.ts';
import { syntheticOpenGd77Archive } from '../opengd77.fixture.ts';
import { rt95Archive } from '../rt95Archive.fixture.ts';
import { RadioCompare } from './RadioCompare.tsx';

const descriptor = (slug: string) => radioDebugDescriptors.find((d) => d.slug === slug)!;
const show = (slug: string, a: DebugArchive, b: DebugArchive) =>
  render(
    <MantineProvider>
      <RadioCompare descriptor={descriptor(slug)} a={a} b={b} />
    </MantineProvider>,
  );

describe.each([
  ['dm-1701-opengd77', 'DM-1701'],
  ['md-9600-opengd77', 'MD-9600'],
])('OpenGD77 %s on the shared decoded compare', (slug, modelId) => {
  it('shows the identity evidence as A and B fields, changed and unchanged', async () => {
    const a = await syntheticOpenGd77Archive(modelId, { revision: 'R1' });
    const b = await syntheticOpenGd77Archive(modelId, { revision: 'R2' });
    show(slug, a, b);
    expect(screen.getByText('Decoded changes')).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).toContain('R1');
    expect(text).toContain('R2');
    expect(text).not.toMatch(/null/);
  });

  it('reads an invalid FirmwareInfo sidecar as not captured, never null', async () => {
    const a = await syntheticOpenGd77Archive(modelId);
    const bad = openDebugArchive(
      packRadioBackupZip(a.manifest, a.regions, {
        [OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR]: new Uint8Array(10),
      }),
      modelId,
    );
    show(slug, a, bad);
    expect(document.body.textContent).not.toMatch(/null/);
    expect(document.body.textContent).toMatch(/Not captured|Invalid FirmwareInfo/);
  });
});

describe('a category that was not captured', () => {
  it('reads "not captured" in Fields by category, not 0 (RT95 Zones without MMD1)', () => {
    const a = buildSyntheticRt95Image();
    const b = buildSyntheticRt95Image();
    b.set(encodeBcdFreq(146_540_000), 0);
    show('rt95', rt95Archive(a), rt95Archive(b));
    const table = screen.getByRole('table', { name: 'Fields by category' });
    const rows = within(table).getAllByRole('row');
    const zones = rows.find((row) => /Zones/.test(row.textContent ?? ''))!;
    expect(within(zones).getAllByText('not captured')).toHaveLength(5);
    expect(within(zones).queryByText('0')).toBeNull();
    // A captured category still counts.
    const channels = rows.find((row) => /Channels/.test(row.textContent ?? ''))!;
    expect(within(channels).queryByText('not captured')).toBeNull();
  });
});

describe('adapter notes', () => {
  it('renders each note once, collapsed', () => {
    const img = buildSyntheticRt95Image();
    const withNotes = {
      ...descriptor('rt95'),
      compare: {
        ...descriptor('rt95').compare!,
        notes: [{ title: 'Limits of this compare', text: 'Equal bytes prove nothing else.' }],
      },
    };
    render(
      <MantineProvider>
        <RadioCompare descriptor={withNotes} a={rt95Archive(img)} b={rt95Archive(img.slice())} />
      </MantineProvider>,
    );
    expect(screen.getAllByText('Limits of this compare')).toHaveLength(1);
    expect(screen.getAllByText('Equal bytes prove nothing else.')).toHaveLength(1);
    expect(screen.getByText('Show details').tagName).toBe('SUMMARY');
  });
});
