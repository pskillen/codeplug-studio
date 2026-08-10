import { useState } from 'react';
import { Select } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import type { Satellite } from '@core/models/satellite.ts';
import { newId } from '@core/models/ids.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { UnsavedChangesModal } from '../../components/ui/index.ts';
import {
  DesignSystemV2Provider,
  EditorHeader,
  FormField,
  Panel,
  StickyFooter,
  TextInput,
} from '../../components/v2/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import {
  hzToMhzString,
  mhzStringToHz,
  optionalNumberToString,
  parseOptionalFloat,
} from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useSatelliteEnrichment } from '../../state/satelliteEnrichment.tsx';
import {
  FREQUENCY_FIELD_ERROR,
  TONE_FIELD_ERROR,
  fieldError,
  sortTransmittersAliveFirst,
  transmitterLabel,
} from './satelliteEditorHelpers.ts';
import { useEntitySave } from './useEntitySave.ts';
import classes from './CompactFormEditor.module.css';

function satelliteSubtitle(entity: Satellite): string {
  const sourceLabel = entity.source === 'celestrak' ? 'CelesTrak' : 'AMSAT';
  return `NORAD ${entity.noradId} · ${sourceLabel} · ${entity.enabled ? 'enabled' : 'disabled'}`;
}

/**
 * Editor for a satellite's operator-entered uplink/downlink metadata (#854). Orbital elements
 * (TLE, epoch, mean motion, ...) are refreshed from CelesTrak/AMSAT on the list page and are not
 * editable here. Satellite rows are only ever created via that refresh flow, so this editor never
 * runs in a "new entity" mode.
 */
export function SatelliteEditor({ entity }: { entity: Satellite }) {
  // Minimal single-transmitter fix — real multi-transmitter editor UI lands in phase 3.
  const firstTransmitter = entity.transmitters[0];
  const [uplink, setUplink] = useState(hzToMhzString(firstTransmitter?.uplinkHz ?? null));
  const [downlink, setDownlink] = useState(hzToMhzString(firstTransmitter?.downlinkHz ?? null));
  const [uplinkTone, setUplinkTone] = useState(
    optionalNumberToString(firstTransmitter?.uplinkToneHz ?? null),
  );
  const [downlinkTone, setDownlinkTone] = useState(
    optionalNumberToString(firstTransmitter?.downlinkToneHz ?? null),
  );
  const { save, saving, error } = useEntitySave('satellite-keps');
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  const { getEnrichmentForNoradId } = useSatelliteEnrichment();
  const enrichment = getEnrichmentForNoradId(entity.noradId);
  const transmitters = enrichment ? sortTransmittersAliveFirst(enrichment.transmitters) : [];

  function applyTransmitter(uuid: string | null) {
    const transmitter = transmitters.find((t) => t.uuid === uuid);
    if (!transmitter) return;
    if (transmitter.uplinkHz !== null) setUplink(hzToMhzString(transmitter.uplinkHz));
    if (transmitter.downlinkHz !== null) setDownlink(hzToMhzString(transmitter.downlinkHz));
  }

  const uplinkFieldError = fieldError(uplink, mhzStringToHz(uplink), FREQUENCY_FIELD_ERROR);
  const downlinkFieldError = fieldError(downlink, mhzStringToHz(downlink), FREQUENCY_FIELD_ERROR);
  const uplinkToneFieldError = fieldError(
    uplinkTone,
    parseOptionalFloat(uplinkTone),
    TONE_FIELD_ERROR,
  );
  const downlinkToneFieldError = fieldError(
    downlinkTone,
    parseOptionalFloat(downlinkTone),
    TONE_FIELD_ERROR,
  );

  function buildRow(): Satellite {
    const uplinkHz = mhzStringToHz(uplink);
    const downlinkHz = mhzStringToHz(downlink);
    const uplinkToneHz = parseOptionalFloat(uplinkTone);
    const downlinkToneHz = parseOptionalFloat(downlinkTone);
    const updatedTransmitter: SatelliteTransmitter = {
      id: firstTransmitter?.id ?? newId(),
      label: firstTransmitter?.label ?? 'Transmitter',
      mode: firstTransmitter?.mode ?? null,
      uplinkHz,
      downlinkHz,
      uplinkToneHz,
      downlinkToneHz,
      source: firstTransmitter?.source ?? 'manual',
      satnogsUuid: firstTransmitter?.satnogsUuid ?? null,
      satnogsAlive: firstTransmitter?.satnogsAlive ?? null,
      satnogsStatus: firstTransmitter?.satnogsStatus ?? null,
      satnogsSyncedAt: firstTransmitter?.satnogsSyncedAt ?? null,
      dismissed: firstTransmitter?.dismissed ?? false,
    };
    return {
      ...entity,
      transmitters: [updatedTransmitter, ...entity.transmitters.slice(1)],
    };
  }

  const { permitNavigationOnce, modalOpen, stay, leave, isDirty } =
    useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putSatellite(row, entity.revision), {
      permitNavigation: permitNavigationOnce,
    });
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <EditorHeader
          crumb="Satellite Keps"
          crumbTo="/library/satellite-keps"
          title={entity.name}
          subtitle={satelliteSubtitle(entity)}
          compact={isMobile}
        />

        <div className={[classes.scrollBody, isMobile ? classes.scrollBodyCompact : ''].join(' ')}>
          {error ? <p className={classes.error}>{error}</p> : null}

          <Panel>
            {transmitters.length > 0 ? (
              <FormField label="Populate from SatNOGS transmitter">
                <Select
                  data={transmitters.map((t) => ({ value: t.uuid, label: transmitterLabel(t) }))}
                  value={null}
                  onChange={applyTransmitter}
                  placeholder="Choose a transmitter…"
                  searchable
                  clearable={false}
                />
              </FormField>
            ) : null}
            <div
              className={[classes.fieldGrid, isMobile ? classes.fieldGridCompact : ''].join(' ')}
              style={transmitters.length > 0 ? { marginTop: 14 } : undefined}
            >
              <FormField label="Uplink frequency (MHz)" mono error={uplinkFieldError}>
                <TextInput
                  variant="plain"
                  value={uplink}
                  onChange={(e) => setUplink(e.currentTarget.value)}
                  mono
                  placeholder="Optional"
                  aria-label="Uplink frequency"
                />
              </FormField>
              <FormField label="Downlink frequency (MHz)" mono error={downlinkFieldError}>
                <TextInput
                  variant="plain"
                  value={downlink}
                  onChange={(e) => setDownlink(e.currentTarget.value)}
                  mono
                  placeholder="Optional"
                  aria-label="Downlink frequency"
                />
              </FormField>
            </div>
            <div
              className={[classes.fieldGrid, isMobile ? classes.fieldGridCompact : ''].join(' ')}
              style={{ marginTop: 14 }}
            >
              <FormField label="Uplink tone (Hz)" mono error={uplinkToneFieldError}>
                <TextInput
                  variant="plain"
                  value={uplinkTone}
                  onChange={(e) => setUplinkTone(e.currentTarget.value)}
                  mono
                  placeholder="Optional"
                  aria-label="Uplink tone"
                />
              </FormField>
              <FormField label="Downlink tone (Hz)" mono error={downlinkToneFieldError}>
                <TextInput
                  variant="plain"
                  value={downlinkTone}
                  onChange={(e) => setDownlinkTone(e.currentTarget.value)}
                  mono
                  placeholder="Optional"
                  aria-label="Downlink tone"
                />
              </FormField>
            </div>
            <p className={classes.hint} style={{ marginTop: 8 }}>
              Operator-entered QSO metadata for this satellite. Orbital elements are refreshed from
              CelesTrak/AMSAT on the Satellite Keps list, not edited here. These fields are not yet
              written to any radio — see{' '}
              <a href="https://github.com/pskillen/codeplug-studio/issues/854">#854</a>.
            </p>
          </Panel>

          <EntityDeleteButton
            kind="satellite"
            entityId={entity.id}
            label={entity.name}
            onDeleted={() => navigate('/library/satellite-keps')}
          />
        </div>

        <StickyFooter
          saveLabel="Save satellite"
          dirty={isDirty}
          onCancel={() => navigate('/library/satellite-keps')}
          onSave={handleSave}
          saving={saving}
          compact={isMobile}
        />

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
