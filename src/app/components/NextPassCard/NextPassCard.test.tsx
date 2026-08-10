import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PassResult } from '@core/domain/satelliteTracking/types.ts';
import NextPassCard, { type NextPassCardTransmitter } from './NextPassCard.tsx';

const NOW_MS = Date.parse('2026-08-10T12:00:00.000Z');

const UPCOMING_PASS: PassResult = {
  aosAt: '2026-08-10T12:10:00.000Z',
  losAt: '2026-08-10T12:20:00.000Z',
  maxElevationAt: '2026-08-10T12:15:00.000Z',
  maxElevationDeg: 42.5,
  durationSec: 600,
};

const ACTIVE_PASS: PassResult = {
  aosAt: '2026-08-10T11:55:00.000Z',
  losAt: '2026-08-10T12:05:00.000Z',
  maxElevationAt: '2026-08-10T12:00:00.000Z',
  maxElevationDeg: 60,
  durationSec: 600,
};

function transmitter(overrides: Partial<NextPassCardTransmitter> = {}): NextPassCardTransmitter {
  return {
    id: 'transmitter-1',
    label: 'FM repeater',
    mode: null,
    uplinkHz: null,
    downlinkHz: null,
    uplinkToneHz: null,
    downlinkToneHz: null,
    ...overrides,
  };
}

describe('NextPassCard', () => {
  it('shows an empty state when no observer is configured', () => {
    render(
      <NextPassCard
        satelliteName="ISS"
        nextPass={null}
        nowMs={NOW_MS}
        hasObserver={false}
        transmitters={[]}
      />,
    );
    expect(screen.getByText(/set an observer location/i)).toBeInTheDocument();
  });

  it('shows an empty state when an observer is configured but no pass is upcoming', () => {
    render(
      <NextPassCard
        satelliteName="ISS"
        nextPass={null}
        nowMs={NOW_MS}
        hasObserver
        transmitters={[]}
      />,
    );
    expect(screen.getByText(/no upcoming pass/i)).toBeInTheDocument();
  });

  it('renders AOS/LOS/max elevation and static frequencies for an upcoming pass, inactive state', () => {
    render(
      <NextPassCard
        satelliteName="ISS"
        nextPass={UPCOMING_PASS}
        nowMs={NOW_MS}
        hasObserver
        transmitters={[
          transmitter({
            uplinkHz: 145_990_000,
            downlinkHz: 437_800_000,
            uplinkToneHz: 67,
            downlinkToneHz: null,
            mode: 'FM',
          }),
        ]}
      />,
    );
    expect(screen.getByText('42.5°')).toBeInTheDocument();
    expect(screen.getByText('145.99 MHz')).toBeInTheDocument();
    expect(screen.getByText('437.8 MHz')).toBeInTheDocument();
    expect(screen.getByText('67 Hz')).toBeInTheDocument();
    expect(screen.getByText('FM')).toBeInTheDocument();
    expect(screen.getByText('FM repeater')).toBeInTheDocument();
    expect(screen.queryByText(/above horizon/i)).not.toBeInTheDocument();
  });

  it('shows the active badge and Doppler-shaded values only while the pass is active', () => {
    render(
      <NextPassCard
        satelliteName="ISS"
        nextPass={ACTIVE_PASS}
        nowMs={NOW_MS}
        hasObserver
        transmitters={[
          transmitter({
            uplinkHz: 145_990_000,
            downlinkHz: 437_800_000,
            dopplerUplinkHz: 145_991_500,
            dopplerDownlinkHz: 437_795_500,
          }),
        ]}
      />,
    );
    expect(screen.getByText(/above horizon/i)).toBeInTheDocument();
    expect(screen.getByText('145.9915 MHz')).toBeInTheDocument();
    expect(screen.getByText('437.7955 MHz')).toBeInTheDocument();
  });

  it('does not render Doppler values when the pass is not active, even if supplied', () => {
    render(
      <NextPassCard
        satelliteName="ISS"
        nextPass={UPCOMING_PASS}
        nowMs={NOW_MS}
        hasObserver
        transmitters={[transmitter({ uplinkHz: 145_990_000, dopplerUplinkHz: 145_991_500 })]}
      />,
    );
    expect(screen.queryByText('145.9915 MHz')).not.toBeInTheDocument();
  });

  it('shows "—" for unset mode and frequency fields', () => {
    render(
      <NextPassCard
        satelliteName="ISS"
        nextPass={UPCOMING_PASS}
        nowMs={NOW_MS}
        hasObserver
        transmitters={[transmitter()]}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows a no-transmitter-data message when the transmitters array is empty', () => {
    render(
      <NextPassCard
        satelliteName="ISS"
        nextPass={UPCOMING_PASS}
        nowMs={NOW_MS}
        hasObserver
        transmitters={[]}
      />,
    );
    expect(screen.getByText(/no transmitter data/i)).toBeInTheDocument();
    // AOS/LOS/max-elevation still render above the empty transmitter section.
    expect(screen.getByText('42.5°')).toBeInTheDocument();
  });

  it('renders one block per transmitter for satellites with 2+ transmitters', () => {
    render(
      <NextPassCard
        satelliteName="ISS"
        nextPass={UPCOMING_PASS}
        nowMs={NOW_MS}
        hasObserver
        transmitters={[
          transmitter({ id: 't1', label: 'FM repeater', uplinkHz: 145_990_000, mode: 'FM' }),
          transmitter({
            id: 't2',
            label: 'Linear transponder',
            uplinkHz: 145_200_000,
            mode: 'SSB',
          }),
        ]}
      />,
    );
    expect(screen.getByText('FM repeater')).toBeInTheDocument();
    expect(screen.getByText('Linear transponder')).toBeInTheDocument();
    expect(screen.getByText('145.99 MHz')).toBeInTheDocument();
    expect(screen.getByText('145.2 MHz')).toBeInTheDocument();
    expect(screen.getByText('FM')).toBeInTheDocument();
    expect(screen.getByText('SSB')).toBeInTheDocument();
  });

  it('renders the upcoming-passes jump link regardless of empty state, when an anchor id is given', () => {
    render(
      <NextPassCard
        satelliteName="ISS"
        nextPass={null}
        nowMs={NOW_MS}
        hasObserver={false}
        transmitters={[]}
        upcomingPassesAnchorId="upcoming-passes"
      />,
    );
    const link = screen.getByRole('link', { name: /jump to upcoming passes/i });
    expect(link).toHaveAttribute('href', '#upcoming-passes');
  });

  it('omits the jump link when no anchor id is given', () => {
    render(
      <NextPassCard
        satelliteName="ISS"
        nextPass={UPCOMING_PASS}
        nowMs={NOW_MS}
        hasObserver
        transmitters={[]}
      />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
