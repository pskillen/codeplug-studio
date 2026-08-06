import { useMemo, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import type { DigitalChannelMode, DigitalContact } from '@core/models/library.ts';
import { newDigitalContact } from '@core/domain/factories.ts';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { UnsavedChangesModal } from '../../components/ui/index.ts';
import {
  DesignSystemV2Provider,
  DismissibleNotice,
  EditorHeader,
  FormField,
  Panel,
  SegmentedControl,
  StickyFooter,
  TextInput,
} from '../../components/v2/index.ts';
import { digitalModeSegmentOptions } from '../../lib/channelModes.ts';
import { parseOptionalInt } from '../../lib/units.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { referenceCount } from '../../lib/listReferences.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import RadioidContactVerifyPanel from '../../components/contacts/RadioidContactVerifyPanel.tsx';
import { useEntitySave } from './useEntitySave.ts';
import classes from './CompactFormEditor.module.css';

const MODE_OPTIONS = digitalModeSegmentOptions();

function digitalContactUsageSubtitle(entity: DigitalContact | null, channelCount: number): string {
  if (!entity) return 'New digital contact';
  if (channelCount === 0) return 'Digital contact · not used by channels';
  return `Digital contact · used by ${channelCount} channel${channelCount === 1 ? '' : 's'}`;
}

function isLikelyRadioidSourced(contact: DigitalContact): boolean {
  return (
    contact.callsign.trim().length > 0 &&
    contact.digitalId > 0 &&
    (contact.country.trim().length > 0 || contact.city.trim().length > 0)
  );
}

export function DigitalContactEditor({
  projectId,
  entity,
}: {
  projectId: string;
  entity: DigitalContact | null;
}) {
  const base = entity ?? newDigitalContact(projectId, '', 0);
  const [name, setName] = useState(base.name);
  const [mode, setMode] = useState<DigitalChannelMode>(base.mode);
  const [digitalId, setDigitalId] = useState(String(base.digitalId));
  const [callsign, setCallsign] = useState(base.callsign);
  const [city, setCity] = useState(base.city);
  const [state, setState] = useState(base.state);
  const [country, setCountry] = useState(base.country);
  const [remarks, setRemarks] = useState(base.remarks);
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave('digital-contacts');
  const { library, reload } = useLibrary();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  function buildRow(): DigitalContact {
    return {
      ...base,
      name: name.trim() || 'Untitled contact',
      mode,
      digitalId: parseOptionalInt(digitalId) ?? 0,
      callsign: callsign.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
      remarks: remarks.trim(),
      comment,
    };
  }

  const {
    permitNavigationOnce,
    modalOpen,
    stay,
    leave,
    isDirty,
  } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putDigitalContact(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  const channelUsageCount = useMemo(() => {
    if (!entity) return 0;
    return referenceCount(library, { kind: 'digitalContact', id: entity.id });
  }, [entity, library]);

  const headerTitle = callsign.trim() || name.trim() || 'Untitled contact';
  const headerSubtitle = digitalContactUsageSubtitle(entity, channelUsageCount);
  const showRadioidNotice = entity != null && isLikelyRadioidSourced(entity);

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <EditorHeader
          crumb="Contacts"
          crumbTo="/library/contacts"
          title={headerTitle}
          subtitle={headerSubtitle}
          compact={isMobile}
        />

        <div
          className={[classes.scrollBody, isMobile ? classes.scrollBodyCompact : ''].join(' ')}
        >
          {error ? <p className={classes.error}>{error}</p> : null}

          <Panel>
            {showRadioidNotice ? (
              <DismissibleNotice tone="info">
                Fetched from RadioID — edits here are local to this project.
              </DismissibleNotice>
            ) : null}

            <div
              className={[
                classes.fieldGrid,
                isMobile ? classes.fieldGridCompact : '',
                showRadioidNotice ? classes.fieldStack : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={showRadioidNotice ? { marginTop: 14 } : undefined}
            >
              <FormField label="Callsign" mono>
                <TextInput
                  variant="plain"
                  value={callsign}
                  onChange={(e) => setCallsign(e.currentTarget.value)}
                  mono
                  aria-label="Callsign"
                />
              </FormField>
              <FormField label="Name">
                <TextInput
                  variant="plain"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  aria-label="Name"
                />
              </FormField>
            </div>

            <div
              className={[classes.fieldGrid, isMobile ? classes.fieldGridCompact : ''].join(' ')}
              style={{ marginTop: 14 }}
            >
              <FormField label="Country">
                <TextInput
                  variant="plain"
                  value={country}
                  onChange={(e) => setCountry(e.currentTarget.value)}
                  aria-label="Country"
                />
              </FormField>
              <FormField label="DMR ID" mono>
                <TextInput
                  variant="plain"
                  value={digitalId}
                  onChange={(e) => setDigitalId(e.currentTarget.value)}
                  mono
                  aria-label="DMR ID"
                />
              </FormField>
            </div>

            <div style={{ marginTop: 14 }}>
              <p className={classes.segmentLabel}>Mode</p>
              <SegmentedControl
                options={MODE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                value={mode}
                onChange={setMode}
              />
            </div>

            <div
              className={[classes.fieldGrid, isMobile ? classes.fieldGridCompact : ''].join(' ')}
              style={{ marginTop: 14 }}
            >
              <FormField label="City">
                <TextInput
                  variant="plain"
                  value={city}
                  onChange={(e) => setCity(e.currentTarget.value)}
                  aria-label="City"
                />
              </FormField>
              <FormField label="State / province">
                <TextInput
                  variant="plain"
                  value={state}
                  onChange={(e) => setState(e.currentTarget.value)}
                  aria-label="State"
                />
              </FormField>
            </div>

            <FormField label="Remarks" hint="Exported on some CPS formats (e.g. Anytone Remarks column).">
              <TextInput
                variant="plain"
                value={remarks}
                onChange={(e) => setRemarks(e.currentTarget.value)}
                aria-label="Remarks"
              />
            </FormField>

            <div style={{ marginTop: 14 }}>
              <FormField label="Comment" hint="Internal notes — not exported on all formats.">
                <TextInput
                  variant="plain"
                  value={comment}
                  onChange={(e) => setComment(e.currentTarget.value)}
                  placeholder="Optional note"
                  aria-label="Comment"
                />
              </FormField>
            </div>
          </Panel>

          {entity ? (
            <RadioidContactVerifyPanel contact={entity} onApplied={() => void reload()} />
          ) : null}

          {entity ? (
            <EntityDeleteButton
              kind="digitalContact"
              entityId={entity.id}
              label={entity.name}
              onDeleted={() => navigate('/library/contacts')}
            />
          ) : null}
        </div>

        <StickyFooter
          saveLabel="Save contact"
          dirty={isDirty}
          onCancel={() => navigate('/library/contacts')}
          onSave={handleSave}
          saving={saving}
          compact={isMobile}
        />

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
