import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OPENGD77_DM1701_MODEL_ID } from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { createOpenUv380Image, writeAbs } from '@integrations/radio-io/radios/opengd77/memory.ts';
import { CompareViewer } from './ArchiveViewers.tsx';
import type { DebugArchive } from './captureArchive.ts';
import { dm32Capture, dm32Page } from './dm32Archive.fixture.ts';
import { archiveDm32Capture } from './dm32Capture.ts';
import { syntheticOpenGd77Archive } from './opengd77.fixture.ts';

const MARKER = '[masked bytes differ]';
const view = (a: DebugArchive, b: DebugArchive, modelId: string) =>
  render(
    <MantineProvider>
      <CompareViewer archive={a} other={b} modelId={modelId} />
    </MantineProvider>,
  );
/** The DM-32 settings page sits 0x431 bytes in: page 4 of the single sparse region. */
function toPage(pages: number) {
  for (let i = 0; i < pages; i++) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}
const table = () => screen.getByLabelText('Byte comparison').textContent ?? '';

async function dm32WithPassword(password: string) {
  const settings = dm32Page(0x04);
  settings.set(new TextEncoder().encode(password), 0x431);
  return archiveDm32Capture(
    dm32Capture({
      blocks: new Map([
        [0x1000, settings],
        [0x2000, dm32Page(0x12)],
      ]),
    }),
  );
}

async function opengd77WithPassword(password: string) {
  const img = createOpenUv380Image();
  writeAbs(img, 0x100, new TextEncoder().encode(password));
  return syntheticOpenGd77Archive(OPENGD77_DM1701_MODEL_ID, { image: img });
}

describe.each([
  ['DM-32UV', () => dm32WithPassword('1234'), () => dm32WithPassword('5678'), 4],
  [
    OPENGD77_DM1701_MODEL_ID,
    () => opengd77WithPassword('PRG123'),
    () => opengd77WithPassword('XYZ789'),
    0,
  ],
] as const)(
  'Compare masks and flags changed password bytes: %s',
  (modelId, makeA, makeB, pages) => {
    it('shows •• and a marker, never the values, until revealed', async () => {
      view(await makeA(), await makeB(), modelId);
      toPage(pages);
      expect(table()).toContain(MARKER);
      expect(table()).toContain('••');
      expect(table()).not.toMatch(/31 32 33 34|35 36 37 38|50 52 47|58 59 5a/i);
      fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
      expect(table()).not.toContain(MARKER);
    });

    it('does not flag identical passwords', async () => {
      view(await makeA(), await makeA(), modelId);
      toPage(pages);
      expect(table()).not.toContain(MARKER);
      expect(table()).toContain('••');
    });
  },
);
