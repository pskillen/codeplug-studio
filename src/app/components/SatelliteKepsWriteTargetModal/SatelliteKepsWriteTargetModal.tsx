/**
 * Workflow A (#859): pick a build with a keps-capable Web Serial egress, then open the Write
 * dialog with only Satellite keps ticked.
 */

import { useEffect, useState } from 'react';
import { Alert, Radio, Stack, Text } from '@mantine/core';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { getFormatProfiles } from '@core/import-export/formatProfiles.ts';
import { ModalShell, Button as V2Button } from '../v2/index.ts';
import { persistence } from '../../state/persistence.ts';
import {
  descriptorsForEgress,
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
} from '../../services/radioIoSession.ts';
import { hasSatelliteKepsWriteAdapter } from '../../services/satelliteKepsWriteAdapters.ts';
import { useRadioWriteDialog } from '../builds/RadioWriteDialog/useRadioWriteDialog.tsx';

function webSerialRadioLabel(profileId: string, descriptorLabel?: string): string {
  return (
    getFormatProfiles('radio-io').find((row) => row.profileId === profileId)?.label ??
    descriptorLabel ??
    profileId
  );
}

export interface SatelliteKepsWriteTargetModalProps {
  opened: boolean;
  onClose: () => void;
  projectId: string | null;
}

interface BuildWriteTarget {
  key: string;
  label: string;
  build: RadioBuild;
  egress: EgressPath;
}

export default function SatelliteKepsWriteTargetModal({
  opened,
  onClose,
  projectId,
}: SatelliteKepsWriteTargetModalProps) {
  if (!opened) return null;
  return <SatelliteKepsWriteTargetModalInner onClose={onClose} projectId={projectId} />;
}

function KepsWriteDialogLauncher({ build, egress }: { build: RadioBuild; egress: EgressPath }) {
  const dialog = useRadioWriteDialog({ build, egress });
  useEffect(() => {
    dialog.open({ codeplug: false, contacts: false, settings: false, keps: true });
  }, [dialog]);
  return <>{dialog.element}</>;
}

function SatelliteKepsWriteTargetModalInner({
  onClose,
  projectId,
}: Omit<SatelliteKepsWriteTargetModalProps, 'opened'>) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [targets, setTargets] = useState<BuildWriteTarget[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [launch, setLaunch] = useState<{ build: RadioBuild; egress: EgressPath } | null>(null);
  const serialOk = isRadioSerialSupported();

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
        const rows: BuildWriteTarget[] = [];
        for (const egress of egressPaths) {
          if (egress.kind !== 'web-serial') continue;
          if (!hasSatelliteKepsWriteAdapter(egress.profileId)) continue;
          const build = buildById.get(egress.radioBuildId);
          if (!build) continue;
          const descriptor = descriptorsForEgress(egress)[0];
          const radioLabel = webSerialRadioLabel(egress.profileId, descriptor?.label);
          rows.push({
            key: `build:${egress.id}`,
            label: `${build.name} — ${radioLabel}`,
            build,
            egress,
          });
        }
        rows.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
        setTargets(rows);
        setSelectedKey(rows[0]?.key ?? null);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load builds.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selected = targets.find((t) => t.key === selectedKey) ?? null;

  function handleContinue() {
    if (!selected) return;
    setLaunch({ build: selected.build, egress: selected.egress });
    onClose();
  }

  return (
    <>
      {launch ? <KepsWriteDialogLauncher build={launch.build} egress={launch.egress} /> : null}
      <ModalShell
        open={!launch}
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
              disabled={!serialOk || !selected || loading}
              onClick={handleContinue}
            >
              Continue
            </V2Button>
          </>
        }
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Opens the Write dialog for the build you choose, with only Satellite keps selected.
          </Text>
          {!serialOk ? <Alert color="yellow">{getRadioSerialUnsupportedMessage()}</Alert> : null}
          {loadError ? <Alert color="red">{loadError}</Alert> : null}
          {loading ? <Text size="sm">Loading builds…</Text> : null}
          {!loading && targets.length === 0 ? (
            <Text size="sm">
              No build can write satellite keps yet. Create a build for a radio that takes satellite
              keps, then write from here or from its Satellite keps tab.
            </Text>
          ) : null}
          <Radio.Group value={selectedKey} onChange={setSelectedKey}>
            <Stack gap="xs">
              {targets.map((target) => (
                <Radio key={target.key} value={target.key} label={target.label} />
              ))}
            </Stack>
          </Radio.Group>
        </Stack>
      </ModalShell>
    </>
  );
}
