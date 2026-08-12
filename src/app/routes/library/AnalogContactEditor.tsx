import { useMemo, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import type { AnalogContact } from '@core/models/library.ts';
import { newAnalogContact } from '@core/domain/factories.ts';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { UnsavedChangesModal } from '../../components/v2/index.ts';
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
import { referenceCount } from '../../lib/listReferences.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useEntitySave } from './useEntitySave.ts';
import classes from './CompactFormEditor.module.css';

function analogContactUsageSubtitle(entity: AnalogContact | null, channelCount: number): string {
  if (!entity) return 'New analog contact';
  if (channelCount === 0) return 'Analog contact · not used by channels';
  return `Analog contact · used by ${channelCount} channel${channelCount === 1 ? '' : 's'}`;
}

export function AnalogContactEditor({
  projectId,
  entity,
}: {
  projectId: string;
  entity: AnalogContact | null;
}) {
  const base = entity ?? newAnalogContact(projectId, '');
  const [name, setName] = useState(base.name);
  const [code, setCode] = useState(base.code);
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave('analog-contacts');
  const { library } = useLibrary();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  function buildRow(): AnalogContact {
    return {
      ...base,
      name: name.trim() || 'Untitled contact',
      code,
      comment,
    };
  }

  const { permitNavigationOnce, modalOpen, stay, leave, isDirty } =
    useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putAnalogContact(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  const channelUsageCount = useMemo(() => {
    if (!entity) return 0;
    return referenceCount(library, { kind: 'analogContact', id: entity.id });
  }, [entity, library]);

  const headerTitle = name.trim() || 'Untitled contact';
  const headerSubtitle = analogContactUsageSubtitle(entity, channelUsageCount);

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
              <FormField label="CTCSS / DCS tone" mono>
                <TextInput
                  variant="plain"
                  value={code}
                  onChange={(e) => setCode(e.currentTarget.value)}
                  mono
                  aria-label="CTCSS / DCS tone"
                />
              </FormField>
            </div>
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
              kind="analogContact"
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
