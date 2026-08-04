import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DigitalChannelMode, DigitalContact } from '@core/models/library.ts';
import { newDigitalContact } from '@core/domain/factories.ts';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { GradientSegmentedControl, UnsavedChangesModal } from '../../components/ui/index.ts';
import {
  Button,
  DesignSystemV2Provider,
  FormField,
  Panel,
  TextInput,
} from '../../components/v2/index.ts';
import { digitalModeSegmentOptions } from '../../lib/channelModes.ts';
import { parseOptionalInt } from '../../lib/units.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import RadioidContactVerifyPanel from '../../components/contacts/RadioidContactVerifyPanel.tsx';
import { useLibrary } from '../../state/useLibrary.ts';
import classes from './zones/ZoneEditLayout.module.css';

const MODE_OPTIONS = digitalModeSegmentOptions();

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
  const { reload } = useLibrary();
  const navigate = useNavigate();

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

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putDigitalContact(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <header className={classes.stickyHeader}>
          <Link to="/library/contacts" className={classes.backLink}>
            ← Contacts
          </Link>
          <div className={classes.headerDivider} aria-hidden />
          <div className={classes.headerIdentity}>
            <div className={classes.headerName}>{name.trim() || 'Untitled contact'}</div>
            <div className={classes.headerSubtitle}>
              {entity ? 'Edit digital contact' : 'New digital contact'}
            </div>
          </div>
          <div className={classes.headerActions}>
            <Button variant="secondary" onClick={() => navigate('/library/contacts')}>
              Discard
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save contact
            </Button>
          </div>
        </header>

        {error ? <p className={classes.error}>{error}</p> : null}

        <div className={classes.content}>
          <Panel title="Identity">
            <div className={classes.fieldStack}>
              <FormField label="Name">
                <TextInput
                  variant="plain"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  aria-label="Name"
                />
              </FormField>
              <GradientSegmentedControl
                label="Mode"
                value={mode}
                onChange={setMode}
                data={MODE_OPTIONS}
                scheme="digitalModes"
                fullWidth
              />
              <FormField label="Contact ID">
                <TextInput
                  variant="plain"
                  value={digitalId}
                  onChange={(e) => setDigitalId(e.currentTarget.value)}
                  aria-label="Contact ID"
                />
              </FormField>
              <FormField label="Callsign">
                <TextInput
                  variant="plain"
                  value={callsign}
                  onChange={(e) => setCallsign(e.currentTarget.value)}
                  aria-label="Callsign"
                />
              </FormField>
            </div>
          </Panel>

          <Panel title="Address">
            <div className={classes.fieldStack}>
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
              <FormField label="Country">
                <TextInput
                  variant="plain"
                  value={country}
                  onChange={(e) => setCountry(e.currentTarget.value)}
                  aria-label="Country"
                />
              </FormField>
              <FormField label="Remarks">
                <TextInput
                  variant="plain"
                  value={remarks}
                  onChange={(e) => setRemarks(e.currentTarget.value)}
                  aria-label="Remarks"
                />
              </FormField>
              <p className={classes.hint}>
                Exported on some CPS formats (e.g. Anytone Remarks column).
              </p>
            </div>
          </Panel>

          <Panel title="Notes">
            <div className={classes.fieldStack}>
              <FormField label="Comment">
                <TextInput
                  variant="plain"
                  value={comment}
                  onChange={(e) => setComment(e.currentTarget.value)}
                  aria-label="Comment"
                />
              </FormField>
              <p className={classes.hint}>Internal notes — not exported on all formats.</p>
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

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
