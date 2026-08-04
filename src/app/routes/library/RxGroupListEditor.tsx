import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Library, RxGroupList } from '@core/models/library.ts';
import { newRxGroupList } from '@core/domain/factories.ts';
import RxGroupListMemberPicker from '../../components/library/RxGroupListMemberPicker.tsx';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { UnsavedChangesModal } from '../../components/ui/index.ts';
import {
  Button,
  DesignSystemV2Provider,
  FormField,
  Panel,
  TextInput,
} from '../../components/v2/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
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
  const { save, saving, error } = useEntitySave('rx-group-lists');
  const navigate = useNavigate();

  function buildRow(): RxGroupList {
    return { ...base, name: name.trim() || 'Untitled list', members };
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putRxGroupList(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <header className={classes.stickyHeader}>
          <Link to="/library/rx-group-lists" className={classes.backLink}>
            ← Receive Group Lists
          </Link>
          <div className={classes.headerDivider} aria-hidden />
          <div className={classes.headerIdentity}>
            <div className={classes.headerName}>{name.trim() || 'Untitled list'}</div>
            <div className={classes.headerSubtitle}>
              {entity ? 'Edit receive group list' : 'New receive group list'}
            </div>
          </div>
          <div className={classes.headerActions}>
            <Button variant="secondary" onClick={() => navigate('/library/rx-group-lists')}>
              Discard
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save list
            </Button>
          </div>
        </header>

        {error ? <p className={classes.error}>{error}</p> : null}

        <div className={classes.content}>
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

          <Panel
            title="Members"
            sub="Talk groups and digital contacts in export order. Timeslot override applies to this list membership only."
          >
            <RxGroupListMemberPicker
              talkGroups={library.talkGroups}
              digitalContacts={library.digitalContacts}
              library={library}
              members={members}
              onChange={setMembers}
            />
          </Panel>

          {entity ? (
            <EntityDeleteButton
              kind="rxGroupList"
              entityId={entity.id}
              label={entity.name}
              onDeleted={() => navigate('/library/rx-group-lists')}
            />
          ) : null}
        </div>

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
