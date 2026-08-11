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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteWritePreviewEntry } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import type { ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
import { Button, DataTable, Panel, type DataTableColumn } from '../../components/v2/index.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { persistence } from '../../state/persistence.ts';
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
  getSatelliteKepsWriteAdapter,
  getSatelliteKepsWriteCapacity,
  getSatelliteKepsWritePreview,
  hasSatelliteKepsWriteAdapter,
  type SatelliteKepsWriteResult,
} from '../../services/satelliteKepsWriteAdapters.ts';
import RadioIoProgressModal, {
  type RadioIoProgressPhase,
} from '../../components/builds/RadioIoProgressModal.tsx';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import classes from './BuildExportPage.module.css';

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

export default function BuildSatelliteKepsPage() {
  const { build, egressPaths, activeEgress } = useBuildLayout();
  const { activeProjectId } = useProjects();
  const egress = resolveSatelliteKepsEgress(egressPaths, activeEgress);

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

  /**
   * Live-loaded enabled satellites for the preview — re-runs on `activeProjectId` change and on
   * any persisted change for this project, so the preview stays live without a Write Keps or
   * page reload. Moved verbatim from `BuildRadioIoPanel` (#1074/#1085).
   */
  useEffect(() => {
    if (!activeProjectId || !kepsPreview) {
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
  }, [activeProjectId, kepsPreview]);

  const previewEntries = useMemo<SatelliteWritePreviewEntry[]>(
    () => (kepsPreview ? kepsPreview(enabledSatellites) : []),
    [kepsPreview, enabledSatellites],
  );

  const previewColumns = useMemo<DataTableColumn<SatelliteWritePreviewEntry>[]>(
    () => [
      { key: 'satelliteName', header: 'Satellite', render: (r) => r.satelliteName },
      {
        key: 'encodedName',
        header: 'Encoded name',
        render: (r) => (
          <Group gap={6} wrap="nowrap">
            <Text size="sm">{r.encodedName}</Text>
            {r.nameTruncated ? (
              <Tooltip label="Shortened to fit the radio's 8-character name field">
                <IconAlertTriangle
                  size={14}
                  stroke={ICON_STROKE}
                  color="var(--mantine-color-orange-6)"
                  aria-label="Name truncated"
                />
              </Tooltip>
            ) : null}
          </Group>
        ),
      },
      { key: 'mode', header: 'Mode', render: (r) => r.mode ?? '—' },
      {
        key: 'uplinkHz',
        header: 'Uplink',
        render: (r) => (r.uplinkHz != null ? `${(r.uplinkHz / 1e6).toFixed(4)} MHz` : '—'),
      },
      {
        key: 'downlinkHz',
        header: 'Downlink',
        render: (r) => (r.downlinkHz != null ? `${(r.downlinkHz / 1e6).toFixed(4)} MHz` : '—'),
      },
    ],
    [],
  );

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
            satellites — no session or write required. &quot;Encoded name&quot; is the 8-character
            value written to the radio&apos;s name field; a warning icon marks rows where that value
            was shortened from the satellite&apos;s full name (and transmitter label, when there was
            room).
          </Text>
          <DataTable
            columns={previewColumns}
            rows={previewEntries}
            getRowId={(r) => `${r.satelliteId}-${r.transmitterId}`}
            totalRowCount={previewEntries.length}
            emptyMessage="No satellites are currently eligible to write."
          />
        </Panel>
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
