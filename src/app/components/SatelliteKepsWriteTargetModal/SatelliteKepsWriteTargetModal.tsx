/**
 * Workflow A (#859, design §8): "Write Keps to Radio" from the Satellite Keps library page.
 * Lets the operator pick a target radio — a build's persisted Web Serial egress, or a generic
 * "other supported radio" with no persisted build — then connects and uploads the library's
 * enabled satellites in the same distinct progress UI Workflow B (BuildRadioIoPanel) uses.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, Radio, Stack, Text } from '@mantine/core';
import type { EgressPath } from '@core/models/egressPath.ts';
import { egressKindForFormatId } from '@core/models/egressPath.ts';
import { listRadioDescriptors } from '@integrations/radio-io/index.ts';
import type { ProgressUpdate, RadioSession } from '@integrations/radio-io/types.ts';
import { ModalShell, Button as V2Button } from '../v2/index.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { persistence } from '../../state/persistence.ts';
import {
  closeRadioSession,
  descriptorsForEgress,
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
  openRadioSessionForEgress,
  RadioWriteBlockedError,
} from '../../services/radioIoSession.ts';
import {
  resolveRadioWriteGate,
  resolveRadioWriteProdDisabledMessage,
} from '../../services/radioWriteEnvGate.ts';
import {
  getSatelliteKepsWriteAdapter,
  hasSatelliteKepsWriteAdapter,
} from '../../services/satelliteKepsWriteAdapters.ts';
import RadioIoProgressModal, {
  type RadioIoProgressPhase,
} from '../builds/RadioIoProgressModal.tsx';

export interface SatelliteKepsWriteTargetModalProps {
  opened: boolean;
  onClose: () => void;
  projectId: string | null;
}

/** A persisted build's Web Serial egress with a registered keps-write adapter. */
interface YourRadioTarget {
  kind: 'build';
  key: string;
  label: string;
  egress: EgressPath;
}

/**
 * A registered adapter's radio with no persisted build/egress — Studio does not have wire
 * names or trait layout for it, only "connect and upload keps." The stub `EgressPath` built
 * for this case is safe here specifically because `writeSatellitesToRadio` never reads
 * `egress.hydration` — it would NOT be safe to reuse this stub for a codeplug write.
 */
interface GenericRadioTarget {
  kind: 'generic';
  key: string;
  label: string;
  formatId: string;
  profileId: string;
}

type WriteTarget = YourRadioTarget | GenericRadioTarget;

function targetToEgress(projectId: string, target: WriteTarget): EgressPath {
  if (target.kind === 'build') return target.egress;
  return {
    id: '',
    projectId,
    revision: 0,
    updatedAt: '',
    radioBuildId: '',
    formatId: target.formatId,
    profileId: target.profileId,
    kind: egressKindForFormatId(target.formatId),
  };
}

/**
 * Outer wrapper only mounts {@link SatelliteKepsWriteTargetModalInner} while `opened` is true —
 * a fresh mount each time gives every internal `useState` a clean initial value for free, so
 * there is no separate "reset transient state on reopen" effect to maintain (and no
 * setState-in-effect anti-pattern to work around).
 */
export default function SatelliteKepsWriteTargetModal({
  opened,
  onClose,
  projectId,
}: SatelliteKepsWriteTargetModalProps) {
  if (!opened) return null;
  return <SatelliteKepsWriteTargetModalInner onClose={onClose} projectId={projectId} />;
}

function SatelliteKepsWriteTargetModalInner({
  onClose,
  projectId,
}: Omit<SatelliteKepsWriteTargetModalProps, 'opened'>) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [yourRadios, setYourRadios] = useState<YourRadioTarget[]>([]);
  const [otherRadios, setOtherRadios] = useState<GenericRadioTarget[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<RadioIoProgressPhase>('connecting');
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [transferStages, setTransferStages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  /**
   * Written/skipped counts from the last successful write. `RadioIoProgressModal` itself
   * shows the generic "Keps write finished" alert (shared with Workflow B); this supplements
   * it with per-satellite skip reasons once the modal is dismissed, mirroring the summary
   * `BuildRadioIoPanel` keeps visible after a Workflow B write.
   */
  const [summary, setSummary] = useState<{
    written: number;
    skipped: { satelliteId: string; reason: string }[];
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<RadioSession | null>(null);

  const { modalOpen: leaveAttempted, stay } = useUnsavedNavigationGuard(busy);

  useEffect(() => {
    if (leaveAttempted) stay();
  }, [leaveAttempted, stay]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [builds, egressPaths] = await Promise.all([
          persistence.listRadioBuilds(projectId),
          persistence.listEgressPaths(projectId),
        ]);
        if (cancelled) return;

        const buildById = new Map(builds.map((b) => [b.id, b]));
        const yours: YourRadioTarget[] = [];
        const shownProfileIds = new Set<string>();
        for (const egress of egressPaths) {
          if (egress.kind !== 'web-serial') continue;
          if (!hasSatelliteKepsWriteAdapter(egress.profileId)) continue;
          const build = buildById.get(egress.radioBuildId);
          if (!build) continue;
          const descriptor = descriptorsForEgress(egress)[0];
          const radioLabel = descriptor?.label ?? egress.profileId;
          yours.push({
            kind: 'build',
            key: `build:${egress.id}`,
            label: `${build.name} — ${radioLabel}`,
            egress,
          });
          shownProfileIds.add(egress.profileId);
        }
        yours.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

        const others: GenericRadioTarget[] = [];
        const seenGenericProfileIds = new Set<string>();
        for (const descriptor of listRadioDescriptors()) {
          for (const profile of descriptor.compatibleProfiles) {
            if (!hasSatelliteKepsWriteAdapter(profile.profileId)) continue;
            if (shownProfileIds.has(profile.profileId)) continue;
            if (seenGenericProfileIds.has(profile.profileId)) continue;
            seenGenericProfileIds.add(profile.profileId);
            others.push({
              kind: 'generic',
              key: `generic:${profile.profileId}`,
              label: descriptor.label,
              formatId: profile.formatId,
              profileId: profile.profileId,
            });
          }
        }
        others.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

        setYourRadios(yours);
        setOtherRadios(others);
        setSelectedKey(yours[0]?.key ?? others[0]?.key ?? null);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load radio targets.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function onProgress(p: ProgressUpdate) {
    setPhase('transfer');
    setProgress(p);
    if (p.stage) {
      setTransferStages((prev) => (prev.includes(p.stage!) ? prev : [...prev, p.stage!]));
    }
  }

  const allTargets: WriteTarget[] = [...yourRadios, ...otherRadios];
  const selectedTarget = allTargets.find((t) => t.key === selectedKey) ?? null;
  const serialOk = isRadioSerialSupported();

  async function handleConnectAndWrite() {
    if (!projectId || !selectedTarget) return;
    const egress = targetToEgress(projectId, selectedTarget);
    const descriptor = descriptorsForEgress(egress)[0];
    const writeKeps = getSatelliteKepsWriteAdapter(egress.profileId);
    if (!writeKeps) return;

    if (descriptor && resolveRadioWriteGate(descriptor) === 'hidden') {
      setError(resolveRadioWriteProdDisabledMessage(egress.profileId));
      return;
    }

    setError(null);
    setBusy(true);
    setPhase('connecting');
    setProgress(null);
    setTransferStages([]);
    setSummary(null);
    abortRef.current = new AbortController();

    try {
      const { session } = await openRadioSessionForEgress(egress, {
        forcePortSelection: true,
        purpose: 'write',
      });
      sessionRef.current = session;
      setPhase('preparing');
      const allSatellites = await persistence.listSatellites(projectId);
      const satellites = allSatellites.filter((s) => s.enabled);
      setPhase('transfer');
      const result = await writeKeps(session, satellites, {
        onProgress,
        signal: abortRef.current.signal,
      });
      setSummary(result);
      await closeRadioSession(session);
      sessionRef.current = null;
      setPhase('done');
    } catch (err) {
      if (err instanceof RadioWriteBlockedError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) await closeRadioSession(session);
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleProgressClose() {
    // Return to the target-select modal (this component stays mounted until the parent
    // stops rendering it) rather than closing the whole flow, so the written/skipped
    // summary below has somewhere to render.
    setBusy(false);
    setProgress(null);
    abortRef.current = null;
  }

  return (
    <>
      <ModalShell
        open={!busy}
        onClose={onClose}
        title="Select target radio"
        size="md"
        footer={
          <>
            <V2Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </V2Button>
            <V2Button
              size="sm"
              disabled={!serialOk || !selectedTarget || loading}
              onClick={() => void handleConnectAndWrite()}
            >
              Connect &amp; write
            </V2Button>
          </>
        }
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Uploads your library&apos;s enabled satellites to the selected radio over Web Serial —
            distinct from a codeplug write.
          </Text>
          {!serialOk ? <Alert color="yellow">{getRadioSerialUnsupportedMessage()}</Alert> : null}
          {loadError ? <Alert color="red">{loadError}</Alert> : null}
          {error ? <Alert color="red">{error}</Alert> : null}
          {summary ? (
            <Alert color={summary.skipped.length > 0 ? 'yellow' : 'green'} title="Last keps write">
              <Stack gap={4}>
                <Text size="sm">{summary.written} satellite(s) written.</Text>
                {summary.skipped.map((s) => (
                  <Text key={`keps-skipped-${s.satelliteId}`} size="sm" c="dimmed">
                    Skipped {s.satelliteId}: {s.reason}
                  </Text>
                ))}
              </Stack>
            </Alert>
          ) : null}
          {loading ? <Text size="sm">Loading radio targets…</Text> : null}
          {!loading && allTargets.length === 0 ? (
            <Text size="sm" c="dimmed">
              No radios currently support a satellite keps write.
            </Text>
          ) : null}
          <Radio.Group value={selectedKey} onChange={setSelectedKey}>
            <Stack gap="md">
              {yourRadios.length > 0 ? (
                <Stack gap="xs">
                  <Text fw={600} size="sm">
                    Recommended / Your radios
                  </Text>
                  {yourRadios.map((target) => (
                    <Radio key={target.key} value={target.key} label={target.label} />
                  ))}
                </Stack>
              ) : null}
              {otherRadios.length > 0 ? (
                <Stack gap="xs">
                  <Text fw={600} size="sm">
                    Other supported radios
                  </Text>
                  {otherRadios.map((target) => (
                    <Radio key={target.key} value={target.key} label={target.label} />
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Radio.Group>
        </Stack>
      </ModalShell>

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
    </>
  );
}
