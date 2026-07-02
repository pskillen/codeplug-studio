import { Anchor } from '@mantine/core';
import { Link, useParams } from 'react-router-dom';
import { useLibrary } from '../../state/useLibrary.ts';
import { FormPage } from '../../components/ui/index.ts';
import { entitiesForKind, kindBySlug } from './registry.ts';
import { listPathForEditorSlug } from './nav.ts';
import ChannelEditor from './ChannelEditor.tsx';
import RxGroupListEditor from './RxGroupListEditor.tsx';
import ZoneEditor from './ZoneEditor.tsx';
import TalkGroupEditor from './TalkGroupEditor.tsx';
import { AnalogContactEditor, DigitalContactEditor } from './SimpleEditors.tsx';

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
    return <NotFound message={`${meta.label} not found.`} slug={meta.slug} />;
  }

  const title = `${isNew ? 'New' : 'Edit'} ${meta.label.toLowerCase()}`;

  const listPath = listPathForEditorSlug(meta.slug);

  return (
    <FormPage
      title={title}
      description={
        <Anchor component={Link} to={listPath} size="sm">
          ← Back to {meta.plural.toLowerCase()}
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
            key={entityId ? library.channels.find((c) => c.id === entityId)?.revision : 'new'}
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

function NotFound({ message, slug }: { message: string; slug?: string }) {
  const listPath = slug ? listPathForEditorSlug(slug) : '/library/channels';
  return (
    <FormPage title="Not found" description={message}>
      <Anchor component={Link} to={listPath}>
        ← Back to list
      </Anchor>
    </FormPage>
  );
}
