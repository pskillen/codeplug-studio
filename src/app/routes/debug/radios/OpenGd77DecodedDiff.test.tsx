import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR } from '@integrations/radio-io/radios/opengd77/debugCapture.ts';
import { openDebugArchive } from './captureArchive.ts';
import { OpenGd77DecodedDiff } from './OpenGd77DecodedDiff.tsx';
import { syntheticOpenGd77Archive } from './opengd77.fixture.ts';

describe.each(['DM-1701', 'MD-9600'])('OpenGd77DecodedDiff %s', (modelId) => {
  const show = (first: Awaited<ReturnType<typeof syntheticOpenGd77Archive>>, second = first) =>
    render(
      <MantineProvider>
        <OpenGd77DecodedDiff first={first} second={second} />
      </MantineProvider>,
    );

  it('shows Changed and Unchanged per field', async () => {
    const a = await syntheticOpenGd77Archive(modelId, { revision: 'R1' });
    const b = await syntheticOpenGd77Archive(modelId, { revision: 'R2' });
    show(a, b);
    expect(screen.getByText('Decoded evidence')).toBeInTheDocument();
    expect(screen.getByText('Identity / Revision: Changed · "R1" → "R2"')).toBeInTheDocument();
    expect(screen.getByText(/Identity \/ Build date: Unchanged/)).toBeInTheDocument();
    expect(screen.getByText(/packed/)).toBeInTheDocument();
  });

  it('shows Unavailable for an invalid sidecar and never the word null', async () => {
    const a = await syntheticOpenGd77Archive(modelId);
    const bad = openDebugArchive(
      packRadioBackupZip(a.manifest, a.regions, {
        [OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR]: new Uint8Array(10),
      }),
      modelId,
    );
    show(a, bad);
    expect(screen.getByText(/Identity \/ Revision: Unavailable · "/)).toBeInTheDocument();
    expect(
      screen.getByText(/Identity \/ Revision: .*→ Invalid FirmwareInfo: .*10 bytes/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Identity \/ Revision: .*Not captured/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/null/);
  });
});
