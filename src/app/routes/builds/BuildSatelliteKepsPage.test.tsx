import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { Satellite } from '@core/models/satellite.ts';
import { BuildLayoutProvider } from './BuildLayoutContext.tsx';
import BuildSatelliteKepsPage from './BuildSatelliteKepsPage.tsx';
import { persistence } from '../../state/persistence.ts';

/**
 * #1085 moved these behaviours here from `BuildRadioIoPanel.test.tsx`'s "Write Keps (#859)",
 * "capacity pre-flight (#1068)", and "satellite write preview (#1074)" describe blocks, which
 * covered the inline button/panel this page now replaces.
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

let kepsCapacityStub: { max: number; countEligible: (s: readonly unknown[]) => number } | undefined;
let kepsPreviewStub:
  | ((satellites: readonly Satellite[], options?: { satelliteOverrides?: unknown[] }) => unknown[])
  | undefined;
let kepsExclusionsStub: ((satellites: readonly Satellite[]) => unknown[]) | undefined;

vi.mock('../../services/satelliteKepsWriteAdapters.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/satelliteKepsWriteAdapters.ts')>();
  return {
    ...actual,
    hasSatelliteKepsWriteAdapter: (profileId: string) =>
      profileId === 'radio-io-at-d890uv' ||
      profileId === 'radio-io-opengd77-1701' ||
      profileId === 'radio-io-opengd77-md9600',
    getSatelliteKepsWriteAdapter: (profileId: string) =>
      profileId === 'radio-io-at-d890uv' ||
      profileId === 'radio-io-opengd77-1701' ||
      profileId === 'radio-io-opengd77-md9600'
        ? kepsWriteFn
        : undefined,
    getSatelliteKepsWriteCapacity: (profileId: string) => {
      if (kepsCapacityStub) {
        return {
          ...kepsCapacityStub,
          nameLength: 8,
          unitNoun: 'transmitter',
          nameScope: 'transmitter' as const,
          limitsDoc: '',
        };
      }
      return actual.getSatelliteKepsWriteCapacity(profileId);
    },
    satelliteKepsCapacityWarning: (_profileId: string, satellites: readonly Satellite[]) => {
      if (!kepsCapacityStub) return null;
      return actual.formatSatelliteKepsCapacityWarning(
        kepsCapacityStub.countEligible(satellites),
        kepsCapacityStub.max,
      );
    },
    getSatelliteKepsWritePreview: () => kepsPreviewStub,
    getSatelliteKepsExclusions: () => kepsExclusionsStub,
  };
});

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
    putRadioBuild: vi.fn(async () => ({ ok: true, revision: 2 })),
  },
}));

function renderPage(profileId = 'radio-io-at-d890uv') {
  const { build, egress, egressPaths } = newRadioBuildForProfile('project-1', profileId);
  const layoutValue = {
    build,
    buildId: build.id,
    egressPaths,
    activeEgress: egress,
    setActiveEgressId: vi.fn(),
    reloadEgressPaths: vi.fn(async () => {}),
  };
  return render(
    <MemoryRouter>
      <BuildLayoutProvider value={layoutValue}>
        <MantineProvider>
          <BuildSatelliteKepsPage />
        </MantineProvider>
      </BuildLayoutProvider>
    </MemoryRouter>,
  );
}

describe('BuildSatelliteKepsPage — Write Keps (#1085, moved from #859)', () => {
  it('renders a Write Keps button for a build with a keps-capable egress', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Write Keps' })).toBeInTheDocument();
  });

  it('disables the Write Keps button while a write is in flight', async () => {
    renderPage();

    const writeKepsButton = screen.getByRole('button', { name: 'Write Keps' });
    expect(writeKepsButton).not.toBeDisabled();

    fireEvent.click(writeKepsButton);
    await waitFor(() => expect(writeKepsButton).toBeDisabled());

    resolveOpenSession?.();
    await waitFor(() => expect(kepsWriteFn).toHaveBeenCalled());
    expect(writeKepsButton).toBeDisabled();
  });
});

describe('BuildSatelliteKepsPage — capacity pre-flight (#1068)', () => {
  it('shows a capacity warning and never calls kepsWriteFn or opens a session when over capacity', async () => {
    const callsBefore = kepsWriteFn.mock.calls.length;
    kepsCapacityStub = { max: 0, countEligible: () => 1 };
    try {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Write Keps' }));

      await waitFor(() => expect(screen.getByText(/only supports 0/)).toBeInTheDocument());
      expect(kepsWriteFn.mock.calls.length).toBe(callsBefore);
      expect(screen.getByRole('button', { name: 'Write Keps' })).not.toBeDisabled();
    } finally {
      kepsCapacityStub = undefined;
    }
  });
});

function previewEntry(overrides: Record<string, unknown> = {}) {
  return {
    satelliteId: 'sat-1',
    satelliteName: 'ISS',
    transmitterId: 'tx-1',
    transmitterLabel: 'FM',
    mode: 'FM',
    encodedName: 'ISS',
    satelliteWireName: 'ISS',
    generatedWireName: 'ISS',
    suggestedFamiliarEncoded: 'ISS',
    suggestedOscarEncoded: null,
    hasWireNameOverride: false,
    uplinkHz: 145_850_000,
    downlinkHz: 436_795_000,
    nameTruncated: false,
    ...overrides,
  };
}

describe('BuildSatelliteKepsPage — satellite write preview (#1074)', () => {
  it('renders the live preview table when a preview function is registered for the profile', async () => {
    kepsPreviewStub = (satellites) => satellites.map(() => previewEntry());
    try {
      renderPage();
      expect(screen.getByText('Preview satellites to write')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getAllByText('ISS').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('FM').length).toBeGreaterThanOrEqual(1);
      });
    } finally {
      kepsPreviewStub = undefined;
    }
  });

  it('shows a truncation indicator on a row with nameTruncated true (#1075)', async () => {
    kepsPreviewStub = () => [
      previewEntry({
        encodedName: 'CUBESAT',
        satelliteWireName: 'CUBESAT',
        generatedWireName: 'CUBESAT',
        suggestedFamiliarEncoded: 'CUBESAT',
        nameTruncated: true,
      }),
    ];
    try {
      renderPage();
      await waitFor(() => expect(screen.getByLabelText('Name truncated')).toBeInTheDocument());
    } finally {
      kepsPreviewStub = undefined;
    }
  });

  it('passes build satelliteOverrides to the preview function', async () => {
    const previewSpy = vi.fn(
      (satellites: readonly Satellite[], options?: { satelliteOverrides?: unknown[] }) => {
        void satellites;
        void options;
        return [previewEntry({ uplinkHz: null, downlinkHz: null })];
      },
    );
    kepsPreviewStub = previewSpy;
    try {
      renderPage();
      await waitFor(() => expect(previewSpy).toHaveBeenCalled());
      expect(previewSpy.mock.calls[0]?.[1]).toEqual({ satelliteOverrides: [] });
    } finally {
      kepsPreviewStub = undefined;
    }
  });

  it('pins Familiar suggestion from inline encoded-name editor after Apply', async () => {
    kepsPreviewStub = () => [
      previewEntry({
        encodedName: 'GEOSCA 1',
        satelliteWireName: 'GEOSCA 1',
        generatedWireName: 'GEOSCA 1',
        suggestedFamiliarEncoded: 'GEOSCA 1',
        nameTruncated: true,
      }),
    ];
    try {
      renderPage();
      await waitFor(() => expect(screen.getByText('GEOSCA 1')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Edit encoded name' }));
      // Suggestion fills draft only — Apply commits the override.
      fireEvent.click(screen.getByRole('button', { name: 'GEOSCA 1' }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply wire name' }));
      await waitFor(() =>
        expect(persistence.putRadioBuild).toHaveBeenCalledWith(
          expect.objectContaining({
            satelliteOverrides: expect.arrayContaining([
              expect.objectContaining({ libraryEntityId: 'tx-1', wireName: 'GEOSCA 1' }),
            ]),
          }),
          expect.anything(),
        ),
      );
    } finally {
      kepsPreviewStub = undefined;
    }
  });

  it('shows a non-blocking warning when encoded names collide', async () => {
    kepsPreviewStub = () => [
      previewEntry({ transmitterId: 'tx-1', transmitterLabel: 'FM A', encodedName: 'SAME' }),
      previewEntry({ transmitterId: 'tx-2', transmitterLabel: 'FM B', encodedName: 'SAME' }),
    ];
    try {
      renderPage();
      await waitFor(() => expect(screen.getByText('Duplicate encoded names')).toBeInTheDocument());
      expect(screen.getByText(/"SAME"/)).toBeInTheDocument();
    } finally {
      kepsPreviewStub = undefined;
    }
  });

  it('does not treat OpenGD77 slot siblings sharing a spacecraft name as a collision', async () => {
    kepsPreviewStub = () => [
      previewEntry({
        transmitterId: 'tx-fm',
        transmitterLabel: 'FM',
        encodedName: 'ISS',
        slot: 'fm',
      }),
      previewEntry({
        transmitterId: 'tx-aprs',
        transmitterLabel: 'APRS',
        encodedName: 'ISS',
        slot: 'aprs',
      }),
    ];
    try {
      renderPage('radio-io-opengd77-1701');
      await waitFor(() =>
        expect(screen.getByText('Preview satellites to write')).toBeInTheDocument(),
      );
      expect(screen.queryByText('Duplicate encoded names')).not.toBeInTheDocument();
    } finally {
      kepsPreviewStub = undefined;
    }
  });

  it('pins OpenGD77 encoded-name override to the satellite id', async () => {
    kepsPreviewStub = () => [
      previewEntry({
        encodedName: 'ISS',
        suggestedFamiliarEncoded: 'ISS',
        slot: 'fm',
      }),
    ];
    try {
      renderPage('radio-io-opengd77-1701');
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Edit encoded name' })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Edit encoded name' }));
      fireEvent.click(screen.getByRole('button', { name: 'ISS' }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply wire name' }));
      await waitFor(() =>
        expect(persistence.putRadioBuild).toHaveBeenCalledWith(
          expect.objectContaining({
            satelliteOverrides: expect.arrayContaining([
              expect.objectContaining({ libraryEntityId: 'sat-1', wireName: 'ISS' }),
            ]),
          }),
          expect.anything(),
        ),
      );
    } finally {
      kepsPreviewStub = undefined;
    }
  });

  it('does not show a Slot column on D890 preview', async () => {
    kepsPreviewStub = () => [previewEntry()];
    try {
      renderPage();
      await waitFor(() =>
        expect(screen.getByText('Preview satellites to write')).toBeInTheDocument(),
      );
      expect(screen.queryByRole('columnheader', { name: 'Slot' })).not.toBeInTheDocument();
    } finally {
      kepsPreviewStub = undefined;
    }
  });

  it('shows OpenGD77 Freq 1/2/3 slot rows', async () => {
    kepsPreviewStub = () => [
      previewEntry({
        slot: 'fm',
        slotCandidates: [{ transmitterId: 'tx-1', label: 'FM', mode: 'FM' }],
      }),
      previewEntry({
        slot: 'aprs',
        transmitterId: '',
        transmitterLabel: '',
        mode: null,
        uplinkHz: null,
        downlinkHz: null,
        slotCandidates: [],
      }),
      previewEntry({
        slot: 'beacon',
        transmitterId: '',
        transmitterLabel: '',
        mode: null,
        uplinkHz: null,
        downlinkHz: null,
        slotCandidates: [],
      }),
    ];
    try {
      renderPage('radio-io-opengd77-1701');
      await waitFor(() =>
        expect(screen.getByRole('columnheader', { name: 'Slot' })).toBeInTheDocument(),
      );
      expect(screen.getByText('Freq 1 (FM)')).toBeInTheDocument();
      expect(screen.getByText('Freq 2 (APRS)')).toBeInTheDocument();
      expect(screen.getByText('Freq 3 (Beacon)')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Radio' })).toBeInTheDocument();
    } finally {
      kepsPreviewStub = undefined;
    }
  });

  it('shows a contested OpenGD77 slot picker', async () => {
    kepsPreviewStub = () => [
      previewEntry({
        transmitterId: 'tx-1',
        transmitterLabel: 'FM A',
        slot: 'fm',
        slotCandidates: [
          { transmitterId: 'tx-1', label: 'FM A', mode: 'FM' },
          { transmitterId: 'tx-2', label: 'FM B', mode: 'FM' },
        ],
      }),
    ];
    try {
      renderPage('radio-io-opengd77-1701');
      expect(
        await screen.findByRole('combobox', {
          name: 'Choose transmitter for Freq 1 (FM)',
        }),
      ).toBeInTheDocument();
    } finally {
      kepsPreviewStub = undefined;
    }
  });
});

describe('BuildSatelliteKepsPage — Excluded from write (#1085 follow-up)', () => {
  it('does not render the Excluded from write panel when nothing is excluded', async () => {
    kepsExclusionsStub = () => [];
    try {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Write Keps' })).toBeInTheDocument(),
      );
      expect(screen.queryByText('Excluded from write')).not.toBeInTheDocument();
    } finally {
      kepsExclusionsStub = undefined;
    }
  });

  it('renders excluded satellites/transmitters with their reason, collapsed by default', async () => {
    kepsExclusionsStub = (satellites) =>
      satellites.map((s) => ({
        satelliteId: s.id,
        transmitterId: 'tx-1',
        reason: 'SSTV not supported by Anytone D890.',
      }));
    try {
      renderPage();
      await waitFor(() => expect(screen.getByText('Excluded from write')).toBeInTheDocument());
      // Collapsed by default — reason text is not visible until expanded.
      expect(screen.queryByText('SSTV not supported by Anytone D890.')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Excluded from write'));
      await waitFor(() =>
        expect(screen.getByText('SSTV not supported by Anytone D890.')).toBeInTheDocument(),
      );
    } finally {
      kepsExclusionsStub = undefined;
    }
  });
});

describe('BuildSatelliteKepsPage — no keps-capable egress', () => {
  it('redirects to Export when the build has no egress with a registered adapter', () => {
    const { build, egress, egressPaths } = newRadioBuildForProfile('project-1', 'neonplug-dm32uv');
    const layoutValue = {
      build,
      buildId: build.id,
      egressPaths,
      activeEgress: egress,
      setActiveEgressId: vi.fn(),
      reloadEgressPaths: vi.fn(async () => {}),
    };
    render(
      <MemoryRouter initialEntries={[`/builds/${build.id}/satellite-keps`]}>
        <BuildLayoutProvider value={layoutValue}>
          <MantineProvider>
            <BuildSatelliteKepsPage />
          </MantineProvider>
        </BuildLayoutProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Satellite keps')).not.toBeInTheDocument();
  });
});
