import { useEffect, useState } from 'react';
import type { AprsConfiguration } from '@core/models/aprs.ts';
import type { AprsPositionSource } from '@core/models/libraryTypes.ts';
import type { Library } from '@core/models/library.ts';
import { newAprsConfiguration } from '@core/domain/factories.ts';
import { normalizeAprsConfiguration } from '@core/domain/aprs/index.ts';
import { NumberInput, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import AprsChannelSlotsEditor from '../../components/library/AprsChannelSlotsEditor.tsx';
import GeoPointEditor from '../../components/library/GeoPointEditor.tsx';
import { FieldCard } from '../../components/fields/Fields.tsx';
import { UnsavedChangesModal } from '../../components/ui/index.ts';
import { useEntityFormDirty, useFormBaseline } from '../../hooks/useEntityFormDirty.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import EditorActions from './EditorActions.tsx';

const POSITION_SOURCE_OPTIONS = [
  { value: 'fixed', label: 'Fixed location' },
  { value: 'gps', label: 'GPS' },
  { value: 'beidou', label: 'BeiDou' },
  { value: 'galileo', label: 'Galileo' },
  { value: 'allGnss', label: 'All GNSS' },
] satisfies { value: AprsPositionSource; label: string }[];

function parseOptionalPositiveInt(value: string | number): number | null {
  if (value === '' || value == null) return null;
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function AprsConfigurationEditor({
  projectId,
  entity,
  library,
  settingsPage = false,
  mapActive = true,
  onDirtyChange,
  onSaved,
  permitNavigationOnce: permitNavigationOnceFromParent,
}: {
  projectId: string;
  entity: AprsConfiguration | null;
  library: Library;
  settingsPage?: boolean;
  mapActive?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => Promise<void>;
  permitNavigationOnce?: () => void;
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
  const [fixedLocator, setFixedLocator] = useState('');
  const [channelSlots, setChannelSlots] = useState(base.channelSlots);
  const { save, saving, error } = useEntitySave('aprs-configuration', {
    navigateOnSave: !settingsPage,
  });
  const navigate = useNavigate();
  const cancelPath = settingsPage ? '/library/aprs-configuration' : '/library/aprs-configuration';

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
    });
  }

  const baseline = useFormBaseline(buildRow);
  const {
    isDirty,
    permitNavigationRef,
    permitNavigationOnce: permitNavigationOnceLocal,
  } = useEntityFormDirty({ baseline, buildCurrent: buildRow });
  const { modalOpen, stay, leave } = useUnsavedNavigationGuard(
    !settingsPage && isDirty,
    permitNavigationRef,
  );

  useEffect(() => {
    if (settingsPage) {
      onDirtyChange?.(isDirty);
    }
  }, [settingsPage, isDirty, onDirtyChange]);

  const permitNavigationOnce = settingsPage
    ? permitNavigationOnceFromParent
    : permitNavigationOnceLocal;

  async function handleSave() {
    const row = buildRow();
    const ok = await save(
      () => persistence.putAprsConfiguration(row, entity ? entity.revision : null),
      { permitNavigation: permitNavigationOnce },
    );
    if (ok) {
      await onSaved?.();
    }
  }

  return (
    <Stack gap="md" maw={900}>
      <FieldCard title="Identity" description="Display name and optional library notes.">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Textarea
          label="Comment"
          description="Optional internal note. Not exported to CPS wire files."
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
          autosize
          minRows={2}
        />
      </FieldCard>

      <FieldCard
        title="Beacon timing"
        description="Manual and automatic position beacon intervals in seconds."
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput
            label="Manual TX interval (seconds)"
            value={manualTxIntervalSec ?? ''}
            onChange={(value) => setManualTxIntervalSec(parseOptionalPositiveInt(value))}
            min={1}
            allowDecimal={false}
            allowNegative={false}
          />
          <NumberInput
            label="Auto TX interval (seconds)"
            value={autoTxIntervalSec ?? ''}
            onChange={(value) => setAutoTxIntervalSec(parseOptionalPositiveInt(value))}
            min={1}
            allowDecimal={false}
            allowNegative={false}
          />
        </SimpleGrid>
      </FieldCard>

      <FieldCard title="Position" description="Beacon position source and fixed coordinates.">
        <Select
          label="Position source"
          data={POSITION_SOURCE_OPTIONS}
          value={positionSource}
          onChange={(value) => setPositionSource((value as AprsPositionSource | null) ?? 'allGnss')}
        />
        {positionSource === 'fixed' ? (
          <GeoPointEditor
            lat={fixedLat}
            lon={fixedLon}
            maidenheadLocator={fixedLocator}
            mapActive={mapActive}
            onChange={({ lat, lon, maidenheadLocator }) => {
              setFixedLat(lat);
              setFixedLon(lon);
              setFixedLocator(maidenheadLocator);
            }}
          />
        ) : null}
      </FieldCard>

      <FieldCard title="Channel slots" description="DMR channels used for APRS transmission slots.">
        <AprsChannelSlotsEditor
          channels={library.channels}
          slots={channelSlots}
          onChange={setChannelSlots}
        />
      </FieldCard>

      <EditorActions
        saving={saving}
        error={error}
        onSave={handleSave}
        cancelPath={cancelPath}
        hideCancel={settingsPage}
      />
      {entity && !settingsPage ? (
        <EntityDeleteButton
          kind="aprsConfiguration"
          entityId={entity.id}
          label={entity.name}
          onDeleted={() => navigate('/library/aprs-configuration')}
        />
      ) : null}
      {!settingsPage ? (
        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      ) : null}
    </Stack>
  );
}
