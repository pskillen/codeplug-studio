import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { Satellite } from '@core/models/satellite.ts';
import { BuildLayoutProvider } from '../../routes/builds/BuildLayoutContext.tsx';
import BuildRadioIoPanel from './BuildRadioIoPanel.tsx';

/**
 * Slice 5 (#859): "Write Keps" shares this panel's `busy`/`operation` state with the
 * existing Read/Write buttons, so clicking one disables the others — the concrete mechanism
 * satisfying design §9's "disable the adjacent button" COM-port-collision requirement for the
 * same-page case. That's the one behaviour worth a real component test rather than relying on
 * manual clicking (plan §Slice 5 test plan) — everything else here is supporting scaffolding.
 */

let resolveOpenSession: (() => void) | null = null;

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return {
    ...actual,
    isRadioSerialSupported: () => true,
    getRadioSerialUnsupportedMessage: () => 'Web Serial not supported.',
    openRadioSessionForEgress: vi.fn(
      () =>
        new Promise((resolve) => {
          resolveOpenSession = () =>
            resolve({
              session: {
                descriptor: { label: 'D890' },
                pipe: {},
                radio: {},
              },
              descriptor: { label: 'D890' },
            });
        }),
    ),
    closeRadioSession: vi.fn(async () => {}),
  };
});

const kepsWriteFn = vi.fn(
  () => new Promise(() => {}), // never resolves — we only assert the disabled state mid-flight
);

// Mutable per-test capacity stub (#1068) — most tests want no ceiling registered (undefined),
// so the pre-flight capacity check is a no-op and clicking "Write Keps" reaches kepsWriteFn
// directly; the capacity-warning test below overrides this before rendering.
let kepsCapacityStub: { max: number; countEligible: (s: readonly unknown[]) => number } | undefined;

// Mutable per-test preview stub (#1074) — undefined by default so the preview Panel doesn't
// render for tests unrelated to it; the preview-specific describe block below overrides this.
let kepsPreviewStub: ((satellites: readonly Satellite[]) => unknown[]) | undefined;

vi.mock('../../services/satelliteKepsWriteAdapters.ts', () => ({
  getSatelliteKepsWriteAdapter: (profileId: string) =>
    profileId === 'radio-io-at-d890uv' ? kepsWriteFn : undefined,
  getSatelliteKepsWriteCapacity: () => kepsCapacityStub,
  getSatelliteKepsWritePreview: () => kepsPreviewStub,
}));

vi.mock('../../hooks/useUnsavedNavigationGuard.ts', () => ({
  useUnsavedNavigationGuard: () => ({ modalOpen: false, stay: vi.fn(), leave: vi.fn() }),
}));

vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({ activeProjectId: 'project-1', activeProject: { name: 'Demo' } }),
}));

const satellite: Satellite = {
  id: 'sat-1',
  projectId: 'project-1',
  revision: 1,
  updatedAt: '2024-01-01T00:00:00Z',
  name: 'ISS',
  noradId: 25544,
  enabled: true,
  source: 'celestrak',
  tleLine1: '1 25544U 98067A   24079.51782528  .00016717  00000-0  30721-3 0  9993',
  tleLine2: '2 25544  51.6416 335.6205 0006447  56.6529  36.3752 15.49560768 45087',
  epoch: '2024-01-01T00:00:00Z',
  classification: 'U',
  inclinationDeg: 51.6416,
  raanDeg: 335.6205,
  eccentricity: 0.0006447,
  argPerigeeDeg: 56.6529,
  meanAnomalyDeg: 36.3752,
  meanMotionRevPerDay: 15.4956,
  bstar: 0.00030721,
  elementSetNumber: 999,
  revolutionNumber: 4508,
  transmitters: [],
};

vi.mock('../../state/persistence.ts', () => ({
  persistence: {
    listSatellites: vi.fn(async () => [satellite]),
    subscribe: vi.fn(() => () => {}),
  },
}));

function renderPanel() {
  const { build, egress, egressPaths } = newRadioBuildForProfile('project-1', 'radio-io-at-d890uv');
  const layoutValue = {
    build,
    buildId: build.id,
    egressPaths,
    activeEgress: egress,
    setActiveEgressId: vi.fn(),
    reloadEgressPaths: vi.fn(async () => {}),
  };
  return render(
    <BuildLayoutProvider value={layoutValue}>
      <MantineProvider>
        <BuildRadioIoPanel build={build} egress={egress} />
      </MantineProvider>
    </BuildLayoutProvider>,
  );
}

describe('BuildRadioIoPanel — Write Keps (#859)', () => {
  it('renders a Write Keps button for a profile with a registered keps-write adapter', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Write Keps' })).toBeInTheDocument();
  });

  it('disables Read/Write while a Write Keps operation is in flight, and vice versa', async () => {
    renderPanel();

    const readButton = screen.getByRole('button', { name: 'Read from radio' });
    const writeKepsButton = screen.getByRole('button', { name: 'Write Keps' });

    expect(readButton).not.toBeDisabled();
    expect(writeKepsButton).not.toBeDisabled();

    fireEvent.click(writeKepsButton);

    // Busy state flips synchronously on click (beginBusy runs before any await resolves).
    await waitFor(() => {
      expect(readButton).toBeDisabled();
      expect(writeKepsButton).toBeDisabled();
    });

    // Let the connect promise resolve so the pending kepsWriteFn call keeps the panel busy
    // (kepsWriteFn itself never resolves) — buttons must stay disabled throughout.
    resolveOpenSession?.();
    await waitFor(() => expect(kepsWriteFn).toHaveBeenCalled());
    expect(readButton).toBeDisabled();
    expect(writeKepsButton).toBeDisabled();
  });
});

describe('BuildRadioIoPanel — Write Keps capacity pre-flight (#1068)', () => {
  it('shows a capacity warning and never calls kepsWriteFn or opens a session when over capacity', async () => {
    const callsBefore = kepsWriteFn.mock.calls.length;
    kepsCapacityStub = { max: 0, countEligible: () => 1 };
    try {
      renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Write Keps' }));

      await waitFor(() => expect(screen.getByText(/only supports 0/)).toBeInTheDocument());
      expect(kepsWriteFn.mock.calls.length).toBe(callsBefore);
      // Buttons stay enabled — no session was opened, no busy state entered.
      expect(screen.getByRole('button', { name: 'Read from radio' })).not.toBeDisabled();
    } finally {
      kepsCapacityStub = undefined;
    }
  });
});

describe('BuildRadioIoPanel — satellite write preview (#1074)', () => {
  it('renders the live preview table when a preview function is registered for the profile', async () => {
    kepsPreviewStub = (satellites) =>
      satellites.map((s) => ({
        satelliteId: s.id,
        satelliteName: s.name,
        transmitterId: 'tx-1',
        transmitterLabel: 'FM',
        mode: 'FM',
        encodedName: 'ISS',
        uplinkHz: 145_850_000,
        downlinkHz: 436_795_000,
      }));
    try {
      renderPanel();
      expect(screen.getByText('Preview satellites to write')).toBeInTheDocument();
      // Collapsible panel defaults collapsed — expand it before asserting row content.
      fireEvent.click(screen.getByText('Preview satellites to write'));
      await waitFor(() => expect(screen.getAllByText('ISS').length).toBeGreaterThan(0));
    } finally {
      kepsPreviewStub = undefined;
    }
  });

  it('does not render the preview panel when the profile has no registered preview function', () => {
    renderPanel();
    expect(screen.queryByText('Preview satellites to write')).not.toBeInTheDocument();
  });

  it('shows a truncation indicator on a row with nameTruncated true (#1075)', async () => {
    kepsPreviewStub = (satellites) =>
      satellites.map((s) => ({
        satelliteId: s.id,
        satelliteName: s.name,
        transmitterId: 'tx-1',
        transmitterLabel: 'FM',
        mode: 'FM',
        encodedName: 'CUBESAT',
        uplinkHz: 145_850_000,
        downlinkHz: 436_795_000,
        nameTruncated: true,
      }));
    try {
      renderPanel();
      fireEvent.click(screen.getByText('Preview satellites to write'));
      await waitFor(() => expect(screen.getByLabelText('Name truncated')).toBeInTheDocument());
    } finally {
      kepsPreviewStub = undefined;
    }
  });

  it('does not show a truncation indicator on a row with nameTruncated false', async () => {
    kepsPreviewStub = (satellites) =>
      satellites.map((s) => ({
        satelliteId: s.id,
        satelliteName: s.name,
        transmitterId: 'tx-1',
        transmitterLabel: 'FM',
        mode: 'FM',
        encodedName: 'ISS',
        uplinkHz: 145_850_000,
        downlinkHz: 436_795_000,
        nameTruncated: false,
      }));
    try {
      renderPanel();
      fireEvent.click(screen.getByText('Preview satellites to write'));
      await waitFor(() => expect(screen.getAllByText('ISS').length).toBeGreaterThan(0));
      expect(screen.queryByLabelText('Name truncated')).not.toBeInTheDocument();
    } finally {
      kepsPreviewStub = undefined;
    }
  });
});
