import { useState } from 'react';
import { Select } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitterInfo } from '@core/models/satelliteEnrichment.ts';
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
import { useEntitySave } from './useEntitySave.ts';
import classes from './CompactFormEditor.module.css';

function satelliteSubtitle(entity: Satellite): string {
  const sourceLabel = entity.source === 'celestrak' ? 'CelesTrak' : 'AMSAT';
  return `NORAD ${entity.noradId} · ${sourceLabel} · ${entity.enabled ? 'enabled' : 'disabled'}`;
}

function transmitterLabel(transmitter: SatelliteTransmitterInfo): string {
  const modeLabel = transmitter.mode ?? 'unknown mode';
  const suffix = transmitter.alive ? '' : ' (inactive)';
  return `${transmitter.description} — ${modeLabel}${suffix}`;
}

/** Alive transmitters first, both groups otherwise in upstream order. */
function sortTransmittersAliveFirst(
  transmitters: SatelliteTransmitterInfo[],
): SatelliteTransmitterInfo[] {
  return [...transmitters].sort((a, b) => Number(b.alive) - Number(a.alive));
}

const FREQUENCY_FIELD_ERROR = 'Enter a positive frequency in MHz.';
const TONE_FIELD_ERROR = 'Enter a positive tone in Hz.';

/** Non-blocking inline validation: only surfaces once the operator has typed something that
 * fails to parse (covers both non-numeric entry and the out-of-range rejection in units.ts). */
function fieldError(rawValue: string, parsed: number | null, message: string): string | undefined {
  return rawValue.trim() !== '' && parsed === null ? message : undefined;
}

/**
 * Editor for a satellite's operator-entered uplink/downlink metadata (#854). Orbital elements
 * (TLE, epoch, mean motion, ...) are refreshed from CelesTrak/AMSAT on the list page and are not
 * editable here. Satellite rows are only ever created via that refresh flow, so this editor never
 * runs in a "new entity" mode.
 */
export function SatelliteEditor({ entity }: { entity: Satellite }) {
  const [uplink, setUplink] = useState(hzToMhzString(entity.uplinkHz ?? null));
  const [downlink, setDownlink] = useState(hzToMhzString(entity.downlinkHz ?? null));
  const [uplinkTone, setUplinkTone] = useState(optionalNumberToString(entity.uplinkToneHz));
  const [downlinkTone, setDownlinkTone] = useState(optionalNumberToString(entity.downlinkToneHz));
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
    return {
      ...entity,
      uplinkHz: mhzStringToHz(uplink),
      downlinkHz: mhzStringToHz(downlink),
      uplinkToneHz: parseOptionalFloat(uplinkTone),
      downlinkToneHz: parseOptionalFloat(downlinkTone),
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
