/**
 * Dedicated Satellite Keps tab (#1085) — promotes the write preview + "Write Keps" trigger
 * that previously lived inline (collapsed) on the Export page's `BuildRadioIoPanel` into a
 * full-page view of its own, so the preview `DataTable` gets real room and the write action is
 * co-located with the exact records it will send. `BuildRadioIoPanel` keeps a "Write Keps…" link
 * to this page instead of the button/panel it used to render inline.
 *
 * Only reachable when the build has an egress pathway with a registered keps write adapter
 * (`hasSatelliteKepsWriteAdapter`, gated the same way the nav item is — see
 * `showsSatelliteKepsNav` in `nav.ts`); redirects to Export otherwise (e.g. direct URL entry
 * after removing the relevant egress pathway).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Group, Stack, Text } from '@mantine/core';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import { findEncodedNameCollisions } from '@core/domain/satellite/findEncodedNameCollisions.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { SatelliteWritePreviewEntry } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import type { ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
import { Button, DataTable, Panel, type DataTableColumn } from '../../components/v2/index.ts';
import { SatelliteEncodedNameCell } from '../../components/builds/satelliteKeps/SatelliteEncodedNameCell.tsx';
import { resolveOptimisticBuild } from '../../lib/resolveOptimisticBuild.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { persistence } from '../../state/persistence.ts';
import { BuildService } from '../../state/buildService.ts';
import { useProjects } from '../../state/useProjects.ts';
import {
  closeRadioSession,
  descriptorsForEgress,
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
  openRadioSessionForEgress,
  RadioWriteBlockedError,
} from '../../services/radioIoSession.ts';
import { resolveRadioWriteGate } from '../../services/radioWriteEnvGate.ts';
import {
  getSatelliteKepsExclusions,
  getSatelliteKepsWriteAdapter,
  getSatelliteKepsWriteCapacity,
  getSatelliteKepsWritePreview,
  hasSatelliteKepsWriteAdapter,
  type SatelliteKepsExclusion,
  type SatelliteKepsWriteResult,
} from '../../services/satelliteKepsWriteAdapters.ts';
import RadioIoProgressModal, {
  type RadioIoProgressPhase,
} from '../../components/builds/RadioIoProgressModal.tsx';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import classes from './BuildExportPage.module.css';

const buildService = new BuildService(persistence);

/**
 * Which egress pathway on this build to use for the keps write — prefers the operator's active
 * pathway (Export page's pathway switcher) when it's keps-capable, otherwise falls back to the
 * first keps-capable pathway on the build. Mirrors `showsSatelliteKepsNav`'s "any egress path
 * qualifies" nav gating (`nav.ts`) rather than requiring the active pathway specifically to be
 * the keps-capable one.
 */
function resolveSatelliteKepsEgress(
  egressPaths: readonly EgressPath[],
  activeEgress: EgressPath | null,
): EgressPath | null {
  if (activeEgress && hasSatelliteKepsWriteAdapter(activeEgress.profileId)) return activeEgress;
  return egressPaths.find((path) => hasSatelliteKepsWriteAdapter(path.profileId)) ?? null;
}

type SatellitePreviewParentRow = {
  kind: 'parent';
  id: string;
  satelliteName: string;
  children: SatellitePreviewRow[];
};

type SatellitePreviewChildRow = SatelliteWritePreviewEntry & {
  kind: 'child';
  id: string;
};

type SatellitePreviewRow = SatellitePreviewParentRow | SatellitePreviewChildRow;

function isPreviewParentRow(row: SatellitePreviewRow): row is SatellitePreviewParentRow {
  return row.kind === 'parent';
}

export default function BuildSatelliteKepsPage() {
  const { build: contextBuild, egressPaths, activeEgress } = useBuildLayout();
  const buildRef = useRef(contextBuild);
  const [savedBuild, setSavedBuild] = useState<RadioBuild | null>(null);
  const build = resolveOptimisticBuild(contextBuild, savedBuild);
  const { activeProjectId } = useProjects();
  const egress = resolveSatelliteKepsEgress(egressPaths, activeEgress);

  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  const persistBuild = useCallback((mutate: (current: RadioBuild) => RadioBuild) => {
    const run = async () => {
      const current = buildRef.current;
      const next = mutate(current);
      if (next === current) return;
      const result = await buildService.putBuild(next, current.revision);
      if (result.ok) {
        const saved = { ...next, revision: result.revision };
        buildRef.current = saved;
        setSavedBuild(saved);
      }
    };
    void run();
  }, []);

  const [editingTransmitterId, setEditingTransmitterId] = useState<string | null>(null);

  function setTransmitterWireName(transmitterId: string, wireName: string) {
    void persistBuild((current) =>
      buildService.withWireNameOverride(current, 'satelliteOverrides', transmitterId, wireName),
    );
    setEditingTransmitterId(null);
  }

  const sessionRef = useRef<RadioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<RadioIoProgressPhase>('connecting');
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [transferStages, setTransferStages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kepsWriteSummary, setKepsWriteSummary] = useState<SatelliteKepsWriteResult | null>(null);
  const [kepsCapacityWarning, setKepsCapacityWarning] = useState<string | null>(null);
  const [enabledSatellites, setEnabledSatellites] = useState<Satellite[]>([]);

  const { modalOpen: leaveAttempted, stay } = useUnsavedNavigationGuard(busy);

  useEffect(() => {
    if (leaveAttempted) stay();
  }, [leaveAttempted, stay]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void closeRadioSession(session);
    };
  }, []);

  const descriptors = egress ? descriptorsForEgress(egress) : [];
  const descriptor = descriptors[0];
  const serialOk = isRadioSerialSupported();
  const writeGate = egress ? resolveRadioWriteGate(descriptor) : 'hidden';
  const writeHidden = writeGate === 'hidden';
  const kepsWriteFn = egress ? getSatelliteKepsWriteAdapter(egress.profileId) : undefined;
  const kepsCapacity = egress ? getSatelliteKepsWriteCapacity(egress.profileId) : undefined;
  const kepsPreview = egress ? getSatelliteKepsWritePreview(egress.profileId) : undefined;
  const kepsExclusions = egress ? getSatelliteKepsExclusions(egress.profileId) : undefined;

  /**
   * Live-loaded enabled satellites for the preview and the "Excluded from write" panel below
   * (#1085 follow-up) — re-runs on `activeProjectId` change and on any persisted change for
   * this project, so both stay live without a Write Keps or page reload. Gated on either
   * function being registered, not just `kepsPreview`, so a profile with only one of the two
   * still gets live data. Moved verbatim from `BuildRadioIoPanel` (#1074/#1085).
   */
  useEffect(() => {
    if (!activeProjectId || (!kepsPreview && !kepsExclusions)) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      const all = await persistence.listSatellites(activeProjectId);
      if (!cancelled) setEnabledSatellites(all.filter((s) => s.enabled));
    };
    void load();
    const unsubscribe = persistence.subscribe((change) => {
      if (!cancelled && change.projectId === activeProjectId) {
        void load();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeProjectId, kepsPreview, kepsExclusions]);

  const previewEntries = useMemo<SatelliteWritePreviewEntry[]>(
    () =>
      kepsPreview
        ? kepsPreview(enabledSatellites, { satelliteOverrides: build.satelliteOverrides })
        : [],
    [kepsPreview, enabledSatellites, build.satelliteOverrides],
  );

  const previewTreeRows = useMemo((): SatellitePreviewRow[] => {
    const parents: SatellitePreviewParentRow[] = [];
    const parentById = new Map<string, SatellitePreviewParentRow>();
    for (const entry of previewEntries) {
      let parent = parentById.get(entry.satelliteId);
      if (!parent) {
        parent = {
          kind: 'parent',
          id: entry.satelliteId,
          satelliteName: entry.satelliteName,
          children: [],
        };
        parentById.set(entry.satelliteId, parent);
        parents.push(parent);
      }
      parent.children.push({
        kind: 'child',
        id: `${entry.satelliteId}-${entry.transmitterId}`,
        ...entry,
      });
    }
    return parents;
  }, [previewEntries]);

  const previewDefaultExpandedKeys = useMemo(
    () => previewTreeRows.map((row) => row.id),
    [previewTreeRows],
  );

  const transmitterOverrides = useMemo(
    () => overrideByEntityId(build.satelliteOverrides),
    [build.satelliteOverrides],
  );

  const collisionWarning = useMemo(() => {
    const groups = findEncodedNameCollisions(
      previewEntries.map((entry) => ({
        id: entry.transmitterId,
        encodedName: entry.encodedName,
      })),
    );
    if (groups.length === 0) return null;
    return groups
      .map((group) => {
        const labels = group.ids
          .map((id) => previewEntries.find((e) => e.transmitterId === id)?.transmitterLabel ?? id)
          .join(', ');
        return `"${group.encodedName}" — ${labels}`;
      })
      .join('; ');
  }, [previewEntries]);

  /**
   * Live "why did this enabled satellite/transmitter not show up in the preview above" (#1085
   * follow-up) — computed the same way `previewEntries` is, from the same `enabledSatellites`,
   * so it updates as the operator toggles satellites/transmitters, no session or write required.
   * Resolves display names locally rather than in the pure `getSatelliteKepsExclusions` function
   * so that function can stay in `src/app/services/` without a UI-shaped return type.
   */
  interface ResolvedExclusion extends SatelliteKepsExclusion {
    satelliteName: string;
    transmitterLabel: string | null;
  }
  const exclusionEntries = useMemo<ResolvedExclusion[]>(() => {
    if (!kepsExclusions) return [];
    const satelliteById = new Map(enabledSatellites.map((s) => [s.id, s]));
    return kepsExclusions(enabledSatellites).map((exclusion) => {
      const satellite = satelliteById.get(exclusion.satelliteId);
      const transmitter = satellite?.transmitters.find((t) => t.id === exclusion.transmitterId);
      return {
        ...exclusion,
        satelliteName: satellite?.name ?? exclusion.satelliteId,
        transmitterLabel: transmitter?.label ?? null,
      };
    });
  }, [kepsExclusions, enabledSatellites]);

  const exclusionColumns = useMemo<DataTableColumn<ResolvedExclusion>[]>(
    () => [
      { key: 'satelliteName', header: 'Satellite', render: (r) => r.satelliteName },
      {
        key: 'transmitterLabel',
        header: 'Transmitter',
        render: (r) => r.transmitterLabel ?? '—',
      },
      { key: 'reason', header: 'Reason', render: (r) => r.reason },
    ],
    [],
  );

  const previewColumns: DataTableColumn<SatellitePreviewRow>[] = [
    {
      key: 'name',
      header: 'Satellite',
      render: (r) => (isPreviewParentRow(r) ? r.satelliteName : r.transmitterLabel),
    },
    {
      key: 'encodedName',
      header: 'Encoded name',
      render: (r) => {
        if (isPreviewParentRow(r)) return '—';
        const override = transmitterOverrides.get(r.transmitterId)?.wireName?.trim();
        const committed = override ?? '';
        return (
          <SatelliteEncodedNameCell
            entry={r}
            nameLimit={AT_D890UV_LIMITS.SATELLITE_NAME_LENGTH}
            editing={editingTransmitterId === r.transmitterId}
            committedWireName={committed}
            onStartEdit={() => setEditingTransmitterId(r.transmitterId)}
            onCancelEdit={() => setEditingTransmitterId(null)}
            onWireNameChange={(wireName) => setTransmitterWireName(r.transmitterId, wireName)}
          />
        );
      },
    },
    {
      key: 'mode',
      header: 'Mode',
      render: (r) => (isPreviewParentRow(r) ? '—' : (r.mode ?? '—')),
    },
    {
      key: 'uplinkHz',
      header: 'Uplink',
      render: (r) =>
        isPreviewParentRow(r) || r.uplinkHz == null ? '—' : `${(r.uplinkHz / 1e6).toFixed(4)} MHz`,
    },
    {
      key: 'downlinkHz',
      header: 'Downlink',
      render: (r) =>
        isPreviewParentRow(r) || r.downlinkHz == null
          ? '—'
          : `${(r.downlinkHz / 1e6).toFixed(4)} MHz`,
    },
  ];

  function onProgress(p: ProgressUpdate) {
    setPhase('transfer');
    setProgress(p);
    if (p.stage) {
      setTransferStages((prev) => (prev.includes(p.stage!) ? prev : [...prev, p.stage!]));
    }
  }

  async function ensureSession(): Promise<RadioSession> {
    if (!egress) throw new Error('No satellite-keps-capable egress pathway on this build.');
    if (sessionRef.current) return sessionRef.current;
    const { session } = await openRadioSessionForEgress(egress, {
      forcePortSelection: true,
      purpose: 'write',
    });
    sessionRef.current = session;
    return session;
  }

  async function releaseSession(): Promise<void> {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) await closeRadioSession(session);
  }

  /**
   * Moved from `BuildRadioIoPanel.handleWriteKeps` verbatim (#1085) — Workflow B (#859 design
   * §8), now living alongside the preview it writes rather than tucked under Export's Write/Read
   * buttons.
   */
  async function handleWriteKeps() {
    if (!kepsWriteFn) return;
    if (!activeProjectId) {
      setError('No active project.');
      return;
    }

    const allSatellites = await persistence.listSatellites(activeProjectId);
    const satellites = allSatellites.filter((s) => s.enabled);

    // Pre-flight capacity check (#1068) — computed before ensureSession/opening the serial
    // session, so an over-capacity library never pays for a session open it can't use. This
    // mirrors the hard block writeSatellitesToRadio itself enforces (no partial write); the
    // point here is surfacing that same fact earlier, not changing the underlying behavior.
    if (kepsCapacity) {
      const eligibleCount = kepsCapacity.countEligible(satellites);
      if (eligibleCount > kepsCapacity.max) {
        setKepsCapacityWarning(
          `${eligibleCount} transmitter(s) are eligible to write, but this radio only supports ` +
            `${kepsCapacity.max} (placeholder pending hardware confirmation — see ` +
            `docs/reference/radios/anytone/at-d890uv/satellite-keps.md). Deselect some ` +
            `satellites or transmitters in the library before writing.`,
        );
        return;
      }
    }
    setKepsCapacityWarning(null);

    setError(null);
    setBusy(true);
    setPhase('connecting');
    setProgress(null);
    setTransferStages([]);
    setKepsWriteSummary(null);
    abortRef.current = new AbortController();
    try {
      setPhase('preparing');
      const session = await ensureSession();
      setPhase('transfer');
      const result = await kepsWriteFn(session, satellites, {
        onProgress,
        signal: abortRef.current!.signal,
        satelliteOverrides: build.satelliteOverrides,
      });
      setKepsWriteSummary(result);
      await releaseSession();
      setPhase('done');
    } catch (err) {
      if (err instanceof RadioWriteBlockedError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      await releaseSession();
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function resetProgressState(): void {
    setBusy(false);
    setProgress(null);
    abortRef.current = null;
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleProgressClose() {
    resetProgressState();
  }

  if (!egress) {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.title}>Satellite keps</h1>
        <p className={classes.subtitle}>
          Preview and write the library&apos;s enabled satellites to this build&apos;s radio.
          Separate from the codeplug Write on Export — no prior Read/hydration required.
        </p>
      </div>
      <Stack gap="md">
        {!serialOk ? <Alert color="yellow">{getRadioSerialUnsupportedMessage()}</Alert> : null}
        <Panel title="Preview satellites to write">
          <Text size="sm" c="dimmed" mb="xs">
            Exactly what a Write Keps would send right now, from the library&apos;s current enabled
            satellites — no session or write required. Expand a spacecraft to see each transmitter
            (radio) row. Use the edit control beside an encoded name to pin Familiar or OSCAR
            suggestions, or type a custom name (≤8 characters).
          </Text>
          {collisionWarning ? (
            <Alert color="yellow" title="Duplicate encoded names" mb="sm">
              <Text size="sm">{collisionWarning}</Text>
            </Alert>
          ) : null}
          <DataTable
            key={previewDefaultExpandedKeys.join(',') || 'empty'}
            columns={previewColumns}
            rows={previewTreeRows}
            getRowId={(r) => r.id}
            nested
            getChildren={(r) => (isPreviewParentRow(r) ? r.children : undefined)}
            getRowVariant={(r) => (isPreviewParentRow(r) ? 'nestParent' : undefined)}
            defaultExpandedKeys={previewDefaultExpandedKeys}
            totalRowCount={previewEntries.length}
            emptyMessage="No satellites are currently eligible to write."
          />
        </Panel>
        {exclusionEntries.length > 0 ? (
          <Panel title="Excluded from write" collapsible defaultCollapsed>
            <Text size="sm" c="dimmed" mb="xs">
              Enabled satellites/transmitters that would not appear in the preview above, and why —
              computed live from the library, no session or write required.
            </Text>
            <DataTable
              columns={exclusionColumns}
              rows={exclusionEntries}
              getRowId={(r) => `${r.satelliteId}-${r.transmitterId ?? 'satellite'}`}
              totalRowCount={exclusionEntries.length}
              emptyMessage="Nothing excluded."
            />
          </Panel>
        ) : null}
        {kepsWriteFn && !writeHidden ? (
          <Group>
            <Button
              variant="primary"
              size="sm"
              disabled={!serialOk || busy}
              onClick={() => void handleWriteKeps()}
            >
              Write Keps
            </Button>
          </Group>
        ) : null}
        {error ? <Alert color="red">{error}</Alert> : null}
        {kepsCapacityWarning ? (
          <Alert color="yellow" title="Write capacity">
            <Text size="sm">{kepsCapacityWarning}</Text>
          </Alert>
        ) : null}
        {kepsWriteSummary ? (
          <Alert
            color={
              kepsWriteSummary.skipped.length > 0 || kepsWriteSummary.skippedTransmitters.length > 0
                ? 'yellow'
                : 'green'
            }
            title="Keps write"
          >
            <Stack gap={4}>
              <Text size="sm">{kepsWriteSummary.written} transmitter(s) written.</Text>
              {kepsWriteSummary.skipped.map((s) => (
                <Text key={`keps-skipped-${s.satelliteId}`} size="sm" c="dimmed">
                  Skipped {s.satelliteId}: {s.reason}
                </Text>
              ))}
              {kepsWriteSummary.skippedTransmitters.map((s) => (
                <Text key={`keps-skipped-tx-${s.transmitterId}`} size="sm" c="dimmed">
                  Skipped {s.satelliteId} / {s.transmitterId}: {s.reason}
                </Text>
              ))}
            </Stack>
          </Alert>
        ) : null}
      </Stack>
      <RadioIoProgressModal
        opened={busy}
        operation="keps-write"
        phase={phase}
        progress={progress}
        transferStages={transferStages}
        navigationBlocked={leaveAttempted}
        onCancel={handleCancel}
        onClose={handleProgressClose}
      />
    </div>
  );
}
