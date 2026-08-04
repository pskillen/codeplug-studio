import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Library, ScanList } from '@core/models/library.ts';
import { newScanList } from '@core/domain/factories.ts';
import ScanListMemberEditor from '../../components/library/ScanListMemberEditor.tsx';
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

export default function ScanListEditor({
  projectId,
  entity,
  library,
}: {
  projectId: string;
  entity: ScanList | null;
  library: Library;
}) {
  const base = entity ?? newScanList(projectId, '');
  const [name, setName] = useState(base.name);
  const [memberChannelIds, setMemberChannelIds] = useState(base.memberChannelIds);
  const { save, saving, error } = useEntitySave('scan-lists');
  const navigate = useNavigate();

  function buildRow(): ScanList {
    return { ...base, name: name.trim() || 'Untitled scan list', memberChannelIds };
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putScanList(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <header className={classes.stickyHeader}>
          <Link to="/library/scan-lists" className={classes.backLink}>
            ← Scan lists
          </Link>
          <div className={classes.headerDivider} aria-hidden />
          <div className={classes.headerIdentity}>
            <div className={classes.headerName}>{name.trim() || 'Untitled scan list'}</div>
            <div className={classes.headerSubtitle}>
              {entity ? 'Edit scan list' : 'New scan list'}
            </div>
          </div>
          <div className={classes.headerActions}>
            <Button variant="secondary" onClick={() => navigate('/library/scan-lists')}>
              Discard
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save scan list
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

          <Panel title="Members" sub="Channels in export order for this scan list.">
            <ScanListMemberEditor
              channels={library.channels}
              memberChannelIds={memberChannelIds}
              onChange={setMemberChannelIds}
            />
          </Panel>

          {entity ? (
            <EntityDeleteButton
              kind="scanList"
              entityId={entity.id}
              label={entity.name}
              onDeleted={() => navigate('/library/scan-lists')}
            />
          ) : null}
        </div>

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
