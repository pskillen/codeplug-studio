import { useState } from 'react';
import type { AprsConfiguration } from '@core/models/aprs.ts';
import type { AprsPositionSource, AprsSlotCallType } from '@core/models/libraryTypes.ts';
import type { Library } from '@core/models/library.ts';
import { newAprsConfiguration } from '@core/domain/factories.ts';
import { normalizeAprsConfiguration } from '@core/domain/aprs/index.ts';
import { NumberInput, Select, Stack, TextInput, Textarea } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { UnsavedChangesModal } from '../../components/ui/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import EditorActions from './EditorActions.tsx';

const POSITION_SOURCE_OPTIONS = [
  { value: 'gps', label: 'GPS' },
  { value: 'fixed', label: 'Fixed location' },
] satisfies { value: AprsPositionSource; label: string }[];

const CALL_TYPE_OPTIONS = [
  { value: 'group', label: 'Group' },
  { value: 'private', label: 'Private' },
] satisfies { value: AprsSlotCallType; label: string }[];

function parseOptionalPositiveInt(value: string | number): number | null {
  if (value === '' || value == null) return null;
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function AprsConfigurationEditor({
  projectId,
  entity,
}: {
  projectId: string;
  entity: AprsConfiguration | null;
  library: Library;
}) {
  const base = entity ?? newAprsConfiguration(projectId, '');
  const [name, setName] = useState(base.name);
  const [comment, setComment] = useState(base.comment);
  const [manualTxIntervalSec, setManualTxIntervalSec] = useState(base.manualTxIntervalSec);
  const [autoTxIntervalSec, setAutoTxIntervalSec] = useState(base.autoTxIntervalSec);
  const [positionSource, setPositionSource] = useState<AprsPositionSource>(base.positionSource);
  const [fixedLat, setFixedLat] = useState(
    base.fixedLocation?.lat != null ? String(base.fixedLocation.lat) : '',
  );
  const [fixedLon, setFixedLon] = useState(
    base.fixedLocation?.lon != null ? String(base.fixedLocation.lon) : '',
  );
  const [channelSlots] = useState(base.channelSlots);
  const [defaultDmrId, setDefaultDmrId] = useState(base.defaultDmrId);
  const [defaultCallType, setDefaultCallType] = useState<AprsSlotCallType>(base.defaultCallType);
  const { save, saving, error } = useEntitySave('aprs-configurations');
  const navigate = useNavigate();

  function buildRow(): AprsConfiguration {
    const lat = Number.parseFloat(fixedLat);
    const lon = Number.parseFloat(fixedLon);
    const fixedLocation =
      positionSource === 'fixed' && Number.isFinite(lat) && Number.isFinite(lon)
        ? { lat, lon }
        : null;
    return normalizeAprsConfiguration({
      ...base,
      name: name.trim() || 'Untitled APRS configuration',
      comment: comment.trim(),
      manualTxIntervalSec,
      autoTxIntervalSec,
      positionSource,
      fixedLocation,
      channelSlots,
      defaultDmrId,
      defaultCallType,
    });
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putAprsConfiguration(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  return (
    <Stack gap="md" maw={900}>
      <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <Textarea
        label="Comment"
        description="Beacon comment text exported with APRS position reports."
        value={comment}
        onChange={(e) => setComment(e.currentTarget.value)}
        autosize
        minRows={2}
      />
      <NumberInput
        label="Manual TX interval (seconds)"
        description="Interval when the operator triggers a manual position report."
        value={manualTxIntervalSec ?? ''}
        onChange={(value) => setManualTxIntervalSec(parseOptionalPositiveInt(value))}
        min={1}
        allowDecimal={false}
        allowNegative={false}
      />
      <NumberInput
        label="Auto TX interval (seconds)"
        description="Automatic position beacon interval."
        value={autoTxIntervalSec ?? ''}
        onChange={(value) => setAutoTxIntervalSec(parseOptionalPositiveInt(value))}
        min={1}
        allowDecimal={false}
        allowNegative={false}
      />
      <Select
        label="Position source"
        data={POSITION_SOURCE_OPTIONS}
        value={positionSource}
        onChange={(value) => setPositionSource((value as AprsPositionSource | null) ?? 'gps')}
      />
      {positionSource === 'fixed' ? (
        <Stack gap="xs">
          <NumberInput
            label="Fixed latitude"
            value={fixedLat === '' ? '' : Number.parseFloat(fixedLat)}
            onChange={(value) => setFixedLat(value === '' ? '' : String(value))}
            decimalScale={6}
          />
          <NumberInput
            label="Fixed longitude"
            value={fixedLon === '' ? '' : Number.parseFloat(fixedLon)}
            onChange={(value) => setFixedLon(value === '' ? '' : String(value))}
            decimalScale={6}
          />
        </Stack>
      ) : null}
      <NumberInput
        label="Default DMR ID"
        description="Global default target (Anytone APRS TG)."
        value={defaultDmrId ?? ''}
        onChange={(value) => setDefaultDmrId(parseOptionalPositiveInt(value))}
        min={1}
        allowDecimal={false}
        allowNegative={false}
      />
      <Select
        label="Default call type"
        data={CALL_TYPE_OPTIONS}
        value={defaultCallType}
        onChange={(value) => setDefaultCallType((value as AprsSlotCallType | null) ?? 'group')}
      />
      <EditorActions
        saving={saving}
        error={error}
        onSave={handleSave}
        cancelPath="/library/aprs-configurations"
      />
      {entity ? (
        <EntityDeleteButton
          kind="aprsConfiguration"
          entityId={entity.id}
          label={entity.name}
          onDeleted={() => navigate('/library/aprs-configurations')}
        />
      ) : null}
      <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
    </Stack>
  );
}
