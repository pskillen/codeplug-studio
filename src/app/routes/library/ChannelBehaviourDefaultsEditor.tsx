import { useEffect, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import type { ChannelBehaviourDefaults } from '@core/models/channelBehaviourDefaults.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS } from '@core/models/channelBehaviourDefaults.ts';
import { normalizeChannelBehaviourDefaults } from '@core/domain/normalizeChannelBehaviourDefaults.ts';
import { UnsavedChangesModal } from '../../components/ui/index.ts';
import { Button, Panel, SegmentedControl } from '../../components/v2/index.ts';
import { useEntityFormDirty, useFormBaseline } from '../../hooks/useEntityFormDirty.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { persistence } from '../../state/persistence.ts';
import classes from './DefaultsSettings.module.css';

export default function ChannelBehaviourDefaultsEditor({
  projectId,
  channelDefaults,
  onDirtyChange,
  onSaved,
  permitNavigationOnce: permitNavigationOnceFromParent,
}: {
  projectId: string;
  channelDefaults: ChannelBehaviourDefaults;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => Promise<void>;
  permitNavigationOnce?: () => void;
}) {
  const base = normalizeChannelBehaviourDefaults(channelDefaults);
  const [forbidTransmit, setForbidTransmit] = useState(base.forbidTransmit);
  const [txPermit, setTxPermit] = useState(base.txPermit);
  const [sendTalkerAlias, setSendTalkerAlias] = useState(base.sendTalkerAlias);
  const [analogSquelchMode, setAnalogSquelchMode] = useState(base.analogSquelchMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  function buildDefaults(): ChannelBehaviourDefaults {
    return normalizeChannelBehaviourDefaults({
      forbidTransmit,
      txPermit,
      sendTalkerAlias,
      analogSquelchMode,
    });
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
        { ...meta, channelDefaults: nextDefaults },
        meta.revision,
      );
      if (!result.ok) {
        setError(
          result.reason === 'revision_conflict'
            ? 'Project was changed elsewhere. Reload and try again.'
            : 'Failed to save channel defaults.',
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
      <Panel title="Channel behavioural defaults">
        <div className={classes.segmentBlock}>
          <p className={classes.segmentLabel}>Transmit</p>
          <SegmentedControl
            options={[
              { value: 'allow', label: 'Allow TX' },
              { value: 'forbid', label: 'RX only' },
            ]}
            value={forbidTransmit ? 'forbid' : 'allow'}
            onChange={(value) => setForbidTransmit(value === 'forbid')}
            disabled={saving}
          />
          <p className={classes.segmentHint}>
            Default for channels set to Default on the channel editor. Build export can still
            override.
          </p>
        </div>

        <div className={classes.segmentBlock} style={{ marginTop: 14 }}>
          <p className={classes.segmentLabel}>TX permit</p>
          <SegmentedControl
            options={[
              { value: 'permitAlways', label: 'Permit always' },
              { value: 'busyLock', label: 'Busy lock' },
            ]}
            value={txPermit}
            onChange={setTxPermit}
            disabled={saving}
          />
        </div>

        <div className={classes.segmentBlock} style={{ marginTop: 14 }}>
          <p className={classes.segmentLabel}>Send talker alias</p>
          <SegmentedControl
            options={[
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
            value={sendTalkerAlias}
            onChange={setSendTalkerAlias}
            disabled={saving}
          />
        </div>

        <div className={classes.segmentBlock} style={{ marginTop: 14 }}>
          <p className={classes.segmentLabel}>Analog squelch mode</p>
          <SegmentedControl
            options={[
              { value: 'carrier', label: 'Carrier' },
              { value: 'tone', label: 'Tone' },
            ]}
            value={analogSquelchMode}
            onChange={setAnalogSquelchMode}
            disabled={saving}
          />
        </div>
      </Panel>

      {error ? <p className={classes.error}>{error}</p> : null}

      <div className={classes.actions}>
        <Button variant="primary" size="sm" onClick={() => void handleSave()} loading={saving}>
          Save channel defaults
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

export { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS };
