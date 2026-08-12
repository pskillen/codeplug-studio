import { useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { mergeSatnogsTransmittersIntoSatellite } from '@core/domain/satnogs/mergeSatnogsTransmitters.ts';
import { mapSatnogsTransmitter } from '@core/domain/satnogs/parseSatnogsTransmitters.ts';
import { newId } from '@core/models/ids.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { fetchSatnogsTransmittersForNoradId } from '@integrations/satellites/satnogsClient.ts';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { UnsavedChangesModal } from '../../components/v2/index.ts';
import {
  Button,
  Checkbox,
  DesignSystemV2Provider,
  EditorHeader,
  FormField,
  Panel,
  RowActionIcon,
  StickyFooter,
  TextInput,
} from '../../components/v2/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import {
  hzToMhzString,
  mhzStringToHz,
  optionalNumberToString,
  parseOptionalFloat,
} from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import {
  FREQUENCY_FIELD_ERROR,
  TONE_FIELD_ERROR,
  fieldError,
  transmitterSourceLabel,
} from './satelliteEditorHelpers.ts';
import { useEntitySave } from './useEntitySave.ts';
import classes from './CompactFormEditor.module.css';
import rowClasses from './SatelliteEditor.module.css';

function satelliteSubtitle(entity: Satellite): string {
  const sourceLabel = entity.source === 'celestrak' ? 'CelesTrak' : 'AMSAT';
  return `NORAD ${entity.noradId} · ${sourceLabel} · ${entity.enabled ? 'enabled' : 'disabled'}`;
}

/**
 * In-progress editable copy of a `SatelliteTransmitter` — frequency/tone fields stay as raw
 * text while the operator types, same as the rest of this app's numeric editors; parsed only
 * when building the saved row (see `fromDraft`). Keeps `fieldError` able to distinguish
 * "blank" from "typed something invalid" per row.
 */
interface TransmitterDraft {
  id: string;
  label: string;
  mode: string;
  uplink: string;
  downlink: string;
  uplinkTone: string;
  downlinkTone: string;
  source: SatelliteTransmitter['source'];
  satnogsUuid: string | null;
  satnogsAlive: boolean | null;
  satnogsStatus: string | null;
  satnogsSyncedAt: string | null;
  dismissed: boolean;
  includeInWrite: boolean;
}

function toDraft(transmitter: SatelliteTransmitter): TransmitterDraft {
  return {
    id: transmitter.id,
    label: transmitter.label,
    mode: transmitter.mode ?? '',
    uplink: hzToMhzString(transmitter.uplinkHz),
    downlink: hzToMhzString(transmitter.downlinkHz),
    uplinkTone: optionalNumberToString(transmitter.uplinkToneHz),
    downlinkTone: optionalNumberToString(transmitter.downlinkToneHz),
    source: transmitter.source,
    satnogsUuid: transmitter.satnogsUuid,
    satnogsAlive: transmitter.satnogsAlive,
    satnogsStatus: transmitter.satnogsStatus,
    satnogsSyncedAt: transmitter.satnogsSyncedAt,
    dismissed: transmitter.dismissed,
    includeInWrite: transmitter.includeInWrite,
  };
}

function fromDraft(draft: TransmitterDraft): SatelliteTransmitter {
  return {
    id: draft.id,
    label: draft.label,
    mode: draft.mode.trim() === '' ? null : draft.mode,
    uplinkHz: mhzStringToHz(draft.uplink),
    downlinkHz: mhzStringToHz(draft.downlink),
    uplinkToneHz: parseOptionalFloat(draft.uplinkTone),
    downlinkToneHz: parseOptionalFloat(draft.downlinkTone),
    source: draft.source,
    satnogsUuid: draft.satnogsUuid,
    satnogsAlive: draft.satnogsAlive,
    satnogsStatus: draft.satnogsStatus,
    satnogsSyncedAt: draft.satnogsSyncedAt,
    dismissed: draft.dismissed,
    includeInWrite: draft.includeInWrite,
  };
}

function newManualDraft(): TransmitterDraft {
  return {
    id: newId(),
    label: '',
    mode: '',
    uplink: '',
    downlink: '',
    uplinkTone: '',
    downlinkTone: '',
    source: 'manual',
    satnogsUuid: null,
    satnogsAlive: null,
    satnogsStatus: null,
    satnogsSyncedAt: null,
    dismissed: false,
    includeInWrite: true,
  };
}

/**
 * Editor for a satellite's onboard transmitters (#1040). Orbital elements (TLE, epoch, mean
 * motion, ...) are refreshed from CelesTrak/AMSAT on the list page and are not editable here.
 * Satellite rows are only ever created via that refresh flow, so this editor never runs in a
 * "new entity" mode.
 *
 * Manual rows are fully operator-owned (add/edit/delete). SatNOGS-sourced rows can be edited
 * and refreshed from SatNOGS, but "delete" on one only sets `dismissed: true` — it stays in the
 * saved array (hidden from this list) so a later refresh keeps its data current without
 * resurrecting it into the visible list (see `mergeSatnogsTransmittersIntoSatellite`).
 */
export function SatelliteEditor({ entity }: { entity: Satellite }) {
  const [transmitters, setTransmitters] = useState<TransmitterDraft[]>(() =>
    entity.transmitters.map(toDraft),
  );
  const [refreshingSatnogs, setRefreshingSatnogs] = useState(false);
  const [satnogsError, setSatnogsError] = useState<string | null>(null);
  const { save, saving, error } = useEntitySave('satellite-keps');
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  function updateTransmitter(id: string, patch: Partial<TransmitterDraft>) {
    setTransmitters((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addTransmitter() {
    setTransmitters((rows) => [...rows, newManualDraft()]);
  }

  function deleteTransmitter(id: string) {
    setTransmitters((rows) =>
      rows
        .map((row) =>
          row.id === id && row.source === 'satnogs' ? { ...row, dismissed: true } : row,
        )
        .filter((row) => row.id !== id || row.source === 'satnogs'),
    );
  }

  async function handleRefreshSatnogs() {
    setRefreshingSatnogs(true);
    setSatnogsError(null);
    try {
      const raw = await fetchSatnogsTransmittersForNoradId(entity.noradId, { refresh: true });
      const fetched = raw.map(mapSatnogsTransmitter);
      const result = mergeSatnogsTransmittersIntoSatellite(
        { ...entity, transmitters: transmitters.map(fromDraft) },
        fetched,
      );
      setTransmitters(result.satellite.transmitters.map(toDraft));
    } catch (err) {
      setSatnogsError(err instanceof Error ? err.message : 'SatNOGS refresh failed.');
    } finally {
      setRefreshingSatnogs(false);
    }
  }

  function buildRow(): Satellite {
    return { ...entity, transmitters: transmitters.map(fromDraft) };
  }

  const { permitNavigationOnce, modalOpen, stay, leave, isDirty } =
    useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putSatellite(row, entity.revision), {
      permitNavigation: permitNavigationOnce,
    });
  }

  const visible = transmitters.filter((row) => !row.dismissed);

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

          <Panel
            title="Transmitters"
            sub="Onboard transmitters/transponders/beacons for this satellite."
          >
            {satnogsError ? <p className={classes.error}>{satnogsError}</p> : null}

            <div className={rowClasses.list}>
              {visible.length === 0 ? (
                <p className={classes.hint}>
                  No transmitters yet — add one manually or refresh from SatNOGS.
                </p>
              ) : null}
              {visible.map((row) => {
                const uplinkFieldError = fieldError(
                  row.uplink,
                  mhzStringToHz(row.uplink),
                  FREQUENCY_FIELD_ERROR,
                );
                const downlinkFieldError = fieldError(
                  row.downlink,
                  mhzStringToHz(row.downlink),
                  FREQUENCY_FIELD_ERROR,
                );
                const uplinkToneFieldError = fieldError(
                  row.uplinkTone,
                  parseOptionalFloat(row.uplinkTone),
                  TONE_FIELD_ERROR,
                );
                const downlinkToneFieldError = fieldError(
                  row.downlinkTone,
                  parseOptionalFloat(row.downlinkTone),
                  TONE_FIELD_ERROR,
                );

                return (
                  <div key={row.id} className={rowClasses.row}>
                    <div className={rowClasses.rowHeader}>
                      <span className={rowClasses.sourceBadge}>
                        {transmitterSourceLabel(fromDraft(row))}
                      </span>
                      <label className={rowClasses.includeInWriteLabel}>
                        <Checkbox
                          checked={row.includeInWrite}
                          onCheckedChange={(checked) =>
                            updateTransmitter(row.id, { includeInWrite: checked })
                          }
                          aria-label="Include in radio write"
                        />
                        Include in radio write
                      </label>
                      <RowActionIcon
                        icon={<IconTrash size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
                        label="Delete transmitter"
                        tone="destructive"
                        onClick={() => deleteTransmitter(row.id)}
                      />
                    </div>
                    <div
                      className={[classes.fieldGrid, isMobile ? classes.fieldGridCompact : ''].join(
                        ' ',
                      )}
                    >
                      <FormField label="Label">
                        <TextInput
                          variant="plain"
                          value={row.label}
                          onChange={(e) =>
                            updateTransmitter(row.id, { label: e.currentTarget.value })
                          }
                          placeholder="e.g. FM repeater"
                          aria-label="Transmitter label"
                        />
                      </FormField>
                      <FormField label="Mode">
                        <TextInput
                          variant="plain"
                          value={row.mode}
                          onChange={(e) =>
                            updateTransmitter(row.id, { mode: e.currentTarget.value })
                          }
                          placeholder="e.g. FM"
                          aria-label="Transmitter mode"
                        />
                      </FormField>
                    </div>
                    <div
                      className={[classes.fieldGrid, isMobile ? classes.fieldGridCompact : ''].join(
                        ' ',
                      )}
                      style={{ marginTop: 14 }}
                    >
                      <FormField label="Uplink frequency (MHz)" mono error={uplinkFieldError}>
                        <TextInput
                          variant="plain"
                          value={row.uplink}
                          onChange={(e) =>
                            updateTransmitter(row.id, { uplink: e.currentTarget.value })
                          }
                          mono
                          placeholder="Optional"
                          aria-label="Uplink frequency"
                        />
                      </FormField>
                      <FormField label="Downlink frequency (MHz)" mono error={downlinkFieldError}>
                        <TextInput
                          variant="plain"
                          value={row.downlink}
                          onChange={(e) =>
                            updateTransmitter(row.id, { downlink: e.currentTarget.value })
                          }
                          mono
                          placeholder="Optional"
                          aria-label="Downlink frequency"
                        />
                      </FormField>
                    </div>
                    <div
                      className={[classes.fieldGrid, isMobile ? classes.fieldGridCompact : ''].join(
                        ' ',
                      )}
                      style={{ marginTop: 14 }}
                    >
                      <FormField label="Uplink tone (Hz)" mono error={uplinkToneFieldError}>
                        <TextInput
                          variant="plain"
                          value={row.uplinkTone}
                          onChange={(e) =>
                            updateTransmitter(row.id, { uplinkTone: e.currentTarget.value })
                          }
                          mono
                          placeholder="Optional"
                          aria-label="Uplink tone"
                        />
                      </FormField>
                      <FormField label="Downlink tone (Hz)" mono error={downlinkToneFieldError}>
                        <TextInput
                          variant="plain"
                          value={row.downlinkTone}
                          onChange={(e) =>
                            updateTransmitter(row.id, { downlinkTone: e.currentTarget.value })
                          }
                          mono
                          placeholder="Optional"
                          aria-label="Downlink tone"
                        />
                      </FormField>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={rowClasses.actions}>
              <Button
                variant="dashed"
                leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
                onClick={addTransmitter}
              >
                Add transmitter
              </Button>
              <Button
                variant="secondary"
                leftSection={<IconRefresh size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
                onClick={() => void handleRefreshSatnogs()}
                disabled={refreshingSatnogs}
              >
                {refreshingSatnogs ? 'Refreshing SatNOGS…' : 'Refresh from SatNOGS'}
              </Button>
            </div>

            <p className={classes.hint} style={{ marginTop: 8 }}>
              These fields are not yet written to any radio — see{' '}
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
