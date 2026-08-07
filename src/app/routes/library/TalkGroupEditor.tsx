import { useMemo, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import type { DigitalChannelMode, TalkGroup } from '@core/models/library.ts';
import { newTalkGroup } from '@core/domain/factories.ts';
import TalkGroupWireNameExamples from '../../components/library/TalkGroupWireNameExamples.tsx';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { UnsavedChangesModal } from '../../components/ui/index.ts';
import {
  DesignSystemV2Provider,
  EditorHeader,
  FormField,
  Panel,
  SegmentedControl,
  StickyFooter,
  TextInput,
} from '../../components/v2/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { digitalModeSegmentOptions } from '../../lib/channelModes.ts';
import { referenceCount } from '../../lib/listReferences.ts';
import { parseOptionalInt } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useEntitySave } from './useEntitySave.ts';
import classes from './CompactFormEditor.module.css';

const MODE_OPTIONS = digitalModeSegmentOptions();

function talkGroupUsageSubtitle(entity: TalkGroup | null, channelCount: number): string {
  if (!entity) return 'New talk group';
  if (channelCount === 0) return 'Talk group · not used by channels';
  return `Talk group · used by ${channelCount} channel${channelCount === 1 ? '' : 's'}`;
}

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
  const { library } = useLibrary();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

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

  const { permitNavigationOnce, modalOpen, stay, leave, isDirty } =
    useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putTalkGroup(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  const liveDigitalId = parseOptionalInt(digitalId) ?? 0;
  const channelUsageCount = useMemo(() => {
    if (!entity) return 0;
    return referenceCount(library, { kind: 'talkGroup', id: entity.id });
  }, [entity, library]);

  const headerTitle = name.trim() || 'Untitled talk group';
  const headerSubtitle = talkGroupUsageSubtitle(entity, channelUsageCount);

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <EditorHeader
          crumb="Talk groups"
          crumbTo="/library/talk-groups"
          title={headerTitle}
          subtitle={headerSubtitle}
          compact={isMobile}
        />

        <div className={[classes.scrollBody, isMobile ? classes.scrollBodyCompact : ''].join(' ')}>
          {error ? <p className={classes.error}>{error}</p> : null}

          <Panel>
            <div
              className={[classes.fieldGrid, isMobile ? classes.fieldGridCompact : ''].join(' ')}
            >
              <FormField label="Name">
                <TextInput
                  variant="plain"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  aria-label="Name"
                />
              </FormField>
              <div>
                <p className={classes.segmentLabel}>Mode</p>
                <SegmentedControl
                  options={MODE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                  value={mode}
                  onChange={setMode}
                />
              </div>
            </div>
            <div
              className={[
                classes.fieldGrid,
                isMobile ? classes.fieldGridCompact : '',
                classes.fieldStack,
              ].join(' ')}
              style={{ marginTop: 14 }}
            >
              <FormField label="Talk group ID" mono>
                <TextInput
                  variant="plain"
                  value={digitalId}
                  onChange={(e) => setDigitalId(e.currentTarget.value)}
                  mono
                  aria-label="Talk group ID"
                />
              </FormField>
              <FormField label="Abbreviation">
                <TextInput
                  variant="plain"
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.currentTarget.value)}
                  aria-label="Abbreviation"
                />
              </FormField>
            </div>
            <p className={classes.hint} style={{ marginTop: 8 }}>
              Full talk group name. Abbreviation is used when export shortening needs a shorter TG
              suffix.
            </p>
            <TalkGroupWireNameExamples
              name={name}
              abbreviation={abbreviation}
              digitalId={liveDigitalId}
            />
            <div style={{ marginTop: 14 }}>
              <FormField label="Comment">
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
            <EntityDeleteButton
              kind="talkGroup"
              entityId={entity.id}
              label={entity.name}
              onDeleted={() => navigate('/library/talk-groups')}
            />
          ) : null}
        </div>

        <StickyFooter
          saveLabel="Save talk group"
          dirty={isDirty}
          onCancel={() => navigate('/library/talk-groups')}
          onSave={handleSave}
          saving={saving}
          compact={isMobile}
        />

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
