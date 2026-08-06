import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import type { Library, RxGroupList } from '@core/models/library.ts';
import { newRxGroupList } from '@core/domain/factories.ts';
import RxGroupListMemberPicker, {
  RxGroupListAddOverlay,
} from '../../components/library/RxGroupListMemberPicker.tsx';
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
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import classes from './zones/ZoneEditLayout.module.css';

export default function RxGroupListEditor({
  projectId,
  entity,
  library,
}: {
  projectId: string;
  entity: RxGroupList | null;
  library: Library;
}) {
  const base = entity ?? newRxGroupList(projectId, '');
  const [name, setName] = useState(base.name);
  const [members, setMembers] = useState(base.members);
  const [addOpen, setAddOpen] = useState(false);
  const { save, saving, error } = useEntitySave('rx-group-lists');
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  function buildRow(): RxGroupList {
    return { ...base, name: name.trim() || 'Untitled list', members };
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  const subtitle = useMemo(
    () => `${members.length} member${members.length === 1 ? '' : 's'}`,
    [members.length],
  );

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putRxGroupList(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <EditorHeader
          compact={isMobile}
          crumb="RX group lists"
          crumbTo="/library/rx-group-lists"
          title={name.trim() || 'Untitled list'}
          subtitle={subtitle}
        />

        {error ? <p className={classes.error}>{error}</p> : null}

        <div
          className={[classes.createScrollBody, isMobile ? classes.createScrollBodyCompact : '']
            .filter(Boolean)
            .join(' ')}
        >
          <Panel title="Identity">
            <FormField label="Name">
              <TextInput
                variant="plain"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                aria-label="Name"
              />
            </FormField>
          </Panel>

          <RxGroupListMemberPicker
            talkGroups={library.talkGroups}
            digitalContacts={library.digitalContacts}
            library={library}
            members={members}
            onChange={setMembers}
            onAdd={() => setAddOpen(true)}
          />

          {entity ? (
            <EntityDeleteButton
              kind="rxGroupList"
              entityId={entity.id}
              label={entity.name}
              onDeleted={() => navigate('/library/rx-group-lists')}
            />
          ) : null}
        </div>

        <StickyFooter
          compact={isMobile}
          saveLabel="Save list"
          onCancel={() => navigate('/library/rx-group-lists')}
          onSave={handleSave}
          saving={saving}
        />

        <RxGroupListAddOverlay
          open={addOpen}
          listName={name.trim() || 'Untitled list'}
          onCancel={() => setAddOpen(false)}
          onCommit={() => setAddOpen(false)}
          talkGroups={library.talkGroups}
          digitalContacts={library.digitalContacts}
          members={members}
          onChange={setMembers}
        />

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
