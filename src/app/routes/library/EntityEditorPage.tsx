import { Anchor } from '@mantine/core';
import { Link, useParams } from 'react-router-dom';
import { useLibrary } from '../../state/useLibrary.ts';
import { FormPage } from '../../components/ui/index.ts';
import { entitiesForKind, kindBySlug } from './registry.ts';
import ChannelEditor from './ChannelEditor.tsx';
import RxGroupListEditor from './RxGroupListEditor.tsx';
import ZoneEditor from './ZoneEditor.tsx';
import { AnalogContactEditor, DigitalContactEditor, TalkGroupEditor } from './SimpleEditors.tsx';

export default function EntityEditorPage() {
  const { kind: slug, id } = useParams();
  const meta = slug ? kindBySlug(slug) : undefined;
  const { library, loading, projectId } = useLibrary();

  if (!meta) {
    return <NotFound message="Unknown entity type." />;
  }

  if (loading) {
    return (
      <FormPage title="Loading…">
        <span />
      </FormPage>
    );
  }

  const isNew = id === 'new' || !id;
  const exists = isNew || entitiesForKind(library, meta.kind).some((r) => r.id === id);
  if (!exists) {
    return <NotFound message={`${meta.label} not found.`} />;
  }

  const title = `${isNew ? 'New' : 'Edit'} ${meta.label.toLowerCase()}`;

  return (
    <FormPage
      title={title}
      description={
        <Anchor component={Link} to="/library" size="sm">
          ← Back to library
        </Anchor>
      }
    >
      {renderEditor()}
    </FormPage>
  );

  function renderEditor() {
    if (!projectId) return null;
    const entityId = isNew ? null : (id ?? null);
    switch (meta!.kind) {
      case 'channel':
        return (
          <ChannelEditor
            projectId={projectId}
            library={library}
            entity={entityId ? (library.channels.find((c) => c.id === entityId) ?? null) : null}
          />
        );
      case 'talkGroup':
        return (
          <TalkGroupEditor
            projectId={projectId}
            entity={entityId ? (library.talkGroups.find((t) => t.id === entityId) ?? null) : null}
          />
        );
      case 'digitalContact':
        return (
          <DigitalContactEditor
            projectId={projectId}
            entity={
              entityId ? (library.digitalContacts.find((c) => c.id === entityId) ?? null) : null
            }
          />
        );
      case 'analogContact':
        return (
          <AnalogContactEditor
            projectId={projectId}
            entity={
              entityId ? (library.analogContacts.find((c) => c.id === entityId) ?? null) : null
            }
          />
        );
      case 'rxGroupList':
        return (
          <RxGroupListEditor
            projectId={projectId}
            library={library}
            entity={entityId ? (library.rxGroupLists.find((r) => r.id === entityId) ?? null) : null}
          />
        );
      case 'zone':
        return (
          <ZoneEditor
            projectId={projectId}
            library={library}
            entity={entityId ? (library.zones.find((z) => z.id === entityId) ?? null) : null}
          />
        );
    }
  }
}

function NotFound({ message }: { message: string }) {
  return (
    <FormPage title="Not found" description={message}>
      <Anchor component={Link} to="/library">
        ← Back to library
      </Anchor>
    </FormPage>
  );
}
