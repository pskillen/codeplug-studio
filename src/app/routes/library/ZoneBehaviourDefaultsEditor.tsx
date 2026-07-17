import { useEffect, useState } from 'react';
import { Alert, Stack, Switch } from '@mantine/core';
import type { ZoneBehaviourDefaults } from '@core/models/zoneBehaviourDefaults.ts';
import { normalizeZoneBehaviourDefaults } from '@core/domain/normalizeZoneBehaviourDefaults.ts';
import { FormSection, UnsavedChangesModal } from '../../components/ui/index.ts';
import { useEntityFormDirty, useFormBaseline } from '../../hooks/useEntityFormDirty.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { persistence } from '../../state/persistence.ts';
import EditorActions from './EditorActions.tsx';

export default function ZoneBehaviourDefaultsEditor({
  projectId,
  zoneDefaults,
  onDirtyChange,
  onSaved,
  permitNavigationOnce: permitNavigationOnceFromParent,
}: {
  projectId: string;
  zoneDefaults: ZoneBehaviourDefaults;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => Promise<void>;
  permitNavigationOnce?: () => void;
}) {
  const base = normalizeZoneBehaviourDefaults(zoneDefaults);
  const [includeInZoneDerivedScanList, setIncludeInZoneDerivedScanList] = useState(
    base.includeInZoneDerivedScanList,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildDefaults(): ZoneBehaviourDefaults {
    return normalizeZoneBehaviourDefaults({ includeInZoneDerivedScanList });
  }

  const baseline = useFormBaseline(buildDefaults);
  const {
    isDirty,
    permitNavigationRef,
    permitNavigationOnce: permitNavigationOnceLocal,
  } = useEntityFormDirty({ baseline, buildCurrent: buildDefaults });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const {
    modalOpen: routeModalOpen,
    stay: routeStay,
    leave: routeLeave,
  } = useUnsavedNavigationGuard(isDirty, permitNavigationRef);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const meta = await persistence.loadProjectMeta(projectId);
      if (!meta) {
        setError('Project not found.');
        return;
      }
      const nextDefaults = buildDefaults();
      const result = await persistence.putProjectMeta(
        { ...meta, zoneDefaults: nextDefaults },
        meta.revision,
      );
      if (!result.ok) {
        setError(
          result.reason === 'revision_conflict'
            ? 'Project was changed elsewhere. Reload and try again.'
            : 'Failed to save zone defaults.',
        );
        return;
      }
      permitNavigationOnceFromParent?.();
      permitNavigationOnceLocal();
      await onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="md" maw={640}>
      <FormSection>
        <Switch
          label="Include zone members in zone-derived scan lists"
          description="Library default for formats that synthesise scan lists from zones (e.g. DM32, Anytone). Per-member and per-build overrides take precedence when set."
          checked={includeInZoneDerivedScanList}
          onChange={(event) => setIncludeInZoneDerivedScanList(event.currentTarget.checked)}
          disabled={saving}
        />
      </FormSection>
      {error ? <Alert color="red">{error}</Alert> : null}
      <EditorActions
        saving={saving}
        error={null}
        onSave={() => void handleSave()}
        hideCancel
        cancelPath="/library/zones"
      />
      <UnsavedChangesModal opened={routeModalOpen} onStay={routeStay} onLeave={routeLeave} />
    </Stack>
  );
}
