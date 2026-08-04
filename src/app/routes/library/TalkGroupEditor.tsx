import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DigitalChannelMode, TalkGroup } from '@core/models/library.ts';
import { newTalkGroup } from '@core/domain/factories.ts';
import TalkGroupWireNameExamples from '../../components/library/TalkGroupWireNameExamples.tsx';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { GradientSegmentedControl, UnsavedChangesModal } from '../../components/ui/index.ts';
import {
  Button,
  DesignSystemV2Provider,
  FormField,
  Panel,
  TextInput,
} from '../../components/v2/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { digitalModeSegmentOptions } from '../../lib/channelModes.ts';
import { parseOptionalInt } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import classes from './zones/ZoneEditLayout.module.css';

const MODE_OPTIONS = digitalModeSegmentOptions();

export function TalkGroupEditor({
  projectId,
  entity,
}: {
  projectId: string;
  entity: TalkGroup | null;
}) {
  const base = entity ?? newTalkGroup(projectId, '', 0);
  const [name, setName] = useState(base.name);
  const [abbreviation, setAbbreviation] = useState(base.abbreviation ?? '');
  const [mode, setMode] = useState<DigitalChannelMode>(base.mode);
  const [digitalId, setDigitalId] = useState(String(base.digitalId));
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave('talk-groups');
  const navigate = useNavigate();

  function buildRow(): TalkGroup {
    const trimmedAbbrev = abbreviation.trim();
    const row: TalkGroup = {
      ...base,
      name: name.trim() || 'Untitled talk group',
      mode,
      digitalId: parseOptionalInt(digitalId) ?? 0,
      comment,
    };
    if (trimmedAbbrev) {
      row.abbreviation = trimmedAbbrev;
    } else {
      delete row.abbreviation;
    }
    return row;
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putTalkGroup(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  const liveDigitalId = parseOptionalInt(digitalId) ?? 0;

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <header className={classes.stickyHeader}>
          <Link to="/library/talk-groups" className={classes.backLink}>
            ← Talk groups
          </Link>
          <div className={classes.headerDivider} aria-hidden />
          <div className={classes.headerIdentity}>
            <div className={classes.headerName}>{name.trim() || 'Untitled talk group'}</div>
            <div className={classes.headerSubtitle}>
              {entity ? 'Edit talk group' : 'New talk group'}
            </div>
          </div>
          <div className={classes.headerActions}>
            <Button variant="secondary" onClick={() => navigate('/library/talk-groups')}>
              Discard
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save talk group
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
              <p className={classes.hint}>
                Full talk group name. May be shortened on export when used as a multi-talkgroup
                channel suffix.
              </p>
              <FormField label="Abbreviation">
                <TextInput
                  variant="plain"
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.currentTarget.value)}
                  aria-label="Abbreviation"
                />
              </FormField>
              <p className={classes.hint}>
                Optional short label used when export shortening needs a shorter TG suffix.
              </p>
              <TalkGroupWireNameExamples
                name={name}
                abbreviation={abbreviation}
                digitalId={liveDigitalId}
              />
              <GradientSegmentedControl
                label="Mode"
                value={mode}
                onChange={setMode}
                data={MODE_OPTIONS}
                scheme="digitalModes"
                fullWidth
              />
              <FormField label="Group ID">
                <TextInput
                  variant="plain"
                  value={digitalId}
                  onChange={(e) => setDigitalId(e.currentTarget.value)}
                  aria-label="Group ID"
                />
              </FormField>
              <FormField label="Comment">
                <TextInput
                  variant="plain"
                  value={comment}
                  onChange={(e) => setComment(e.currentTarget.value)}
                  aria-label="Comment"
                />
              </FormField>
            </div>
          </Panel>

          {entity ? (
            <EntityDeleteButton
              kind="talkGroup"
              entityId={entity.id}
              label={entity.name}
              onDeleted={() => navigate('/library/talk-groups')}
            />
          ) : null}
        </div>

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
