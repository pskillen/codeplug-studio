import { useEffect, useState } from 'react';
import { Alert, Stack } from '@mantine/core';
import type { ChannelBehaviourDefaults } from '@core/models/channelBehaviourDefaults.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS } from '@core/models/channelBehaviourDefaults.ts';
import { normalizeChannelBehaviourDefaults } from '@core/domain/normalizeChannelBehaviourDefaults.ts';
import { FormSection, UnsavedChangesModal } from '../../components/ui/index.ts';
import LibraryForbidTransmitDefaultSegment from '../../components/channels/LibraryForbidTransmitDefaultSegment.tsx';
import TxPermitSegment from '../../components/channels/TxPermitSegment.tsx';
import SendTalkerAliasSegment from '../../components/channels/SendTalkerAliasSegment.tsx';
import AnalogSquelchModeSegment from '../../components/channels/AnalogSquelchModeSegment.tsx';
import { useEntityFormDirty, useFormBaseline } from '../../hooks/useEntityFormDirty.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { persistence } from '../../state/persistence.ts';
import EditorActions from './EditorActions.tsx';

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

  function buildDefaults(): ChannelBehaviourDefaults {
    return normalizeChannelBehaviourDefaults({
      forbidTransmit,
      txPermit,
      sendTalkerAlias,
      analogSquelchMode,
    });
  }

  const baseline = useFormBaseline(buildDefaults);
  const { isDirty, permitNavigationRef, permitNavigationOnce: permitNavigationOnceLocal } =
    useEntityFormDirty({ baseline, buildCurrent: buildDefaults });

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
    <Stack gap="md" maw={640}>
      <FormSection>
        <LibraryForbidTransmitDefaultSegment
          value={forbidTransmit}
          onChange={setForbidTransmit}
          disabled={saving}
        />
        <TxPermitSegment
          value={txPermit}
          onChange={(value) => {
            if (value !== 'default') setTxPermit(value);
          }}
          includeDefault={false}
          disabled={saving}
        />
        <SendTalkerAliasSegment
          value={sendTalkerAlias}
          onChange={(value) => {
            if (value !== 'default') setSendTalkerAlias(value);
          }}
          includeDefault={false}
          disabled={saving}
        />
        <AnalogSquelchModeSegment
          value={analogSquelchMode}
          onChange={(value) => {
            if (value !== 'default') setAnalogSquelchMode(value);
          }}
          includeDefault={false}
          disabled={saving}
        />
      </FormSection>

      {error ? <Alert color="red">{error}</Alert> : null}

      <EditorActions saving={saving} error={null} onSave={() => void handleSave()} hideCancel />

      <UnsavedChangesModal
        opened={routeModalOpen}
        onStay={routeStay}
        onLeave={routeLeave}
      />
    </Stack>
  );
}

export { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS };
