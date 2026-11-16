import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openGd77CalibrationView } from '@integrations/radio-io/radios/opengd77/debugCalibrationView.ts';
import { OPENGD77_DM1701_MODEL_ID } from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { CalibrationTab } from './CalibrationTab.tsx';
import { syntheticOpenGd77Archive } from './opengd77.fixture.ts';

afterEach(cleanup);

describe('OpenGD77 on the shared Calibration tab', () => {
  it('draws the notice, per-band chart cards, striped tables and folded raw bytes', async () => {
    render(
      <MantineProvider>
        <CalibrationTab
          calibration={openGd77CalibrationView}
          archive={await syntheticOpenGd77Archive(OPENGD77_DM1701_MODEL_ID)}
          entries={[]}
          readId={null}
          overlayId={null}
          onRead={() => {}}
          onOverlay={() => {}}
        />
      </MantineProvider>,
    );
    expect(screen.getByText('Not validated on hardware')).toBeInTheDocument();
    expect(screen.getByText('UHF power')).toBeInTheDocument();
    expect(screen.getByText('VHF squelch thresholds')).toBeInTheDocument();
    expect(screen.getByText('UHF oscillator tune')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'DMR and FM I/Q gains' })).toBeInTheDocument();
    expect(screen.getByText('Raw captured bytes')).toBeInTheDocument();
  });
});
