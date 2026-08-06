import { useEffect, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import type { ZoneBehaviourDefaults } from '@core/models/zoneBehaviourDefaults.ts';
import { normalizeZoneBehaviourDefaults } from '@core/domain/normalizeZoneBehaviourDefaults.ts';
import { UnsavedChangesModal } from '../../components/ui/index.ts';
import { Button, Panel, ToggleSwitch } from '../../components/v2/index.ts';
import { useEntityFormDirty, useFormBaseline } from '../../hooks/useEntityFormDirty.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { persistence } from '../../state/persistence.ts';
import classes from './DefaultsSettings.module.css';

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
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

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
    <div className={[classes.stack, isMobile ? classes.pageCompact : ''].filter(Boolean).join(' ')}>
      <Panel title="Zone behavioural defaults">
        <div className={classes.toggleBlock}>
          <ToggleSwitch
            checked={includeInZoneDerivedScanList}
            onChange={setIncludeInZoneDerivedScanList}
            disabled={saving}
            label="Include members in zone-derived scan lists by default"
          />
          <p className={classes.segmentHint} style={{ marginTop: 8 }}>
            On = include; off = exclude. Used when a build makes scan lists from zones (for example
            DM32 or Anytone). Per-member and per-build overrides still win when set.
          </p>
        </div>
      </Panel>

      {error ? <p className={classes.error}>{error}</p> : null}

      <div className={classes.actions}>
        <Button variant="primary" size="sm" onClick={() => void handleSave()} loading={saving}>
          Save zone defaults
        </Button>
        {isDirty ? (
          <span className={classes.segmentHint}>Unsaved changes</span>
        ) : (
          <span className={classes.segmentHint}>All changes saved</span>
        )}
      </div>

      <UnsavedChangesModal opened={routeModalOpen} onStay={routeStay} onLeave={routeLeave} />
    </div>
  );
}
