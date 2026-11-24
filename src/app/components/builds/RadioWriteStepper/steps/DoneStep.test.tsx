import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import type { WriteSummary } from '../types.ts';
import { demoFlowView, demoStepperConfig, noopActions } from '../stepperDemo.ts';
import { DoneBody } from './DoneStep.tsx';

function makeSummary(overrides: Partial<WriteSummary> = {}): WriteSummary {
  return {
    codeplugWritten: false,
    contactsWritten: false,
    settingsChanged: null,
    settingsTicked: false,
    channelCount: 0,
    kepsResult: null,
    kepsUnitNoun: null,
    kepsTicked: true,
    kepsError: null,
    warnings: [],
    checkStatus: 'none',
    checkResult: null,
    identity: null,
    writeTimings: null,
    ...overrides,
  };
}

function renderDone(summary: WriteSummary) {
  return render(
    <MantineProvider>
      <DoneBody
        config={demoStepperConfig({ radioLabel: 'Test radio' })}
        view={demoFlowView({ summary })}
        actions={noopActions(() => () => {})}
      />
    </MantineProvider>,
  );
}

describe('DoneBody keps summary', () => {
  it('says satellites and read-back for a RadioFoundry write', () => {
    renderDone(
      makeSummary({
        kepsUnitNoun: 'satellite',
        kepsResult: {
          written: 2,
          readBack: 'matched',
          skipped: [],
          skippedTransmitters: [],
        },
      }),
    );
    expect(
      screen.getByText(
        'Satellite keps written: 2 satellites. The radio read them back and they match.',
      ),
    ).toBeTruthy();
  });

  it('shows keps debug details collapsed on Done', () => {
    renderDone(
      makeSummary({
        kepsResult: {
          written: 2,
          debugText: 'frames: 0 INFO',
          skipped: [],
          skippedTransmitters: [],
        },
      }),
    );
    expect(screen.queryByText('frames: 0 INFO')).toBeNull();
    fireEvent.click(screen.getByText('Debug details'));
    expect(screen.getByText('frames: 0 INFO')).toBeTruthy();
  });

  it('copies keps debug text', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderDone(
      makeSummary({
        kepsResult: {
          written: 2,
          debugText: 'frames: 0 INFO',
          skipped: [],
          skippedTransmitters: [],
        },
      }),
    );
    fireEvent.click(screen.getByText('Debug details'));
    fireEvent.click(screen.getByText('Copy debug text'));
    expect(writeText).toHaveBeenCalledWith('frames: 0 INFO');
    expect(await screen.findByText('Copied')).toBeTruthy();
  });

  it('keeps "transmitter" for a radio without readBack', () => {
    renderDone(
      makeSummary({
        kepsUnitNoun: 'transmitter',
        kepsResult: {
          written: 3,
          skipped: [],
          skippedTransmitters: [],
        },
      }),
    );
    expect(screen.getByText('Satellite keps written: 3 transmitters.')).toBeTruthy();
    expect(screen.queryByText(/read them back/)).toBeNull();
  });

  it('names skipped rows by satellite and transmitter', () => {
    renderDone(
      makeSummary({
        kepsResult: {
          written: 1,
          skipped: [
            {
              satelliteId: 'sat-b',
              reason: 'out of band',
              label: 'AO-27',
            },
          ],
          skippedTransmitters: [
            {
              satelliteId: 'sat-a',
              transmitterId: 'tx-extra',
              reason: 'not chosen',
              label: 'SO-50 / SSTV',
            },
          ],
        },
      }),
    );
    expect(screen.getByText('2 notes')).toBeTruthy();
    fireEvent.click(screen.getByText('2 notes'));
    expect(screen.getByText('Skipped AO-27: out of band')).toBeTruthy();
    expect(screen.getByText('Skipped SO-50 / SSTV: not chosen')).toBeTruthy();
  });

  it('falls back to ids when a row has no label', () => {
    renderDone(
      makeSummary({
        kepsResult: {
          written: 0,
          skipped: [{ satelliteId: 'sat-x', reason: 'no FM pair' }],
          skippedTransmitters: [
            {
              satelliteId: 'sat-y',
              transmitterId: 'tx-z',
              reason: 'unsupported mode',
            },
          ],
        },
      }),
    );
    expect(screen.getByText('2 notes')).toBeTruthy();
    fireEvent.click(screen.getByText('2 notes'));
    expect(screen.getByText('Skipped sat-x: no FM pair')).toBeTruthy();
    expect(screen.getByText('Skipped sat-y / tx-z: unsupported mode')).toBeTruthy();
  });
});
