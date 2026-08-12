import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import type { Library, ScanList } from '@core/models/library.ts';
import { newScanList } from '@core/domain/factories.ts';
import ScanListMemberEditor, {
  ScanListAddOverlay,
} from '../../components/library/ScanListMemberEditor.tsx';
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
  const [addOpen, setAddOpen] = useState(false);
  const { save, saving, error } = useEntitySave('scan-lists');
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  function buildRow(): ScanList {
    return { ...base, name: name.trim() || 'Untitled scan list', memberChannelIds };
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  const subtitle = useMemo(
    () => `${memberChannelIds.length} member${memberChannelIds.length === 1 ? '' : 's'}`,
    [memberChannelIds.length],
  );

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putScanList(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <EditorHeader
          compact={isMobile}
          crumb="Scan lists"
          crumbTo="/library/scan-lists"
          title={name.trim() || 'Untitled scan list'}
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

          <ScanListMemberEditor
            channels={library.channels}
            memberChannelIds={memberChannelIds}
            onChange={setMemberChannelIds}
            onAdd={() => setAddOpen(true)}
          />

          {entity ? (
            <EntityDeleteButton
              kind="scanList"
              entityId={entity.id}
              label={entity.name}
              onDeleted={() => navigate('/library/scan-lists')}
            />
          ) : null}
        </div>

        <StickyFooter
          compact={isMobile}
          saveLabel="Save list"
          onCancel={() => navigate('/library/scan-lists')}
          onSave={handleSave}
          saving={saving}
        />

        <ScanListAddOverlay
          open={addOpen}
          listName={name.trim() || 'Untitled scan list'}
          onCancel={() => setAddOpen(false)}
          onCommit={() => setAddOpen(false)}
          channels={library.channels}
          memberChannelIds={memberChannelIds}
          onChange={setMemberChannelIds}
        />

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
