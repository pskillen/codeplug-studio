import { Link, useParams } from 'react-router-dom';
import { useLibrary } from '../../state/useLibrary.ts';
import { entitiesForKind, kindBySlug } from './registry.ts';
import ChannelEditor from './ChannelEditor.tsx';
import RxGroupListEditor from './RxGroupListEditor.tsx';
import ZoneEditor from './ZoneEditor.tsx';
import { AnalogContactEditor, DigitalContactEditor, TalkGroupEditor } from './SimpleEditors.tsx';

export default function EntityEditorPage() {
  const { kind: slug, id } = useParams();
  const meta = slug ? kindBySlug(slug) : undefined;
  const { library, loading, projectId } = useLibrary();

  if (!projectId) {
    return (
      <section>
        <h1 style={{ marginTop: 0 }}>Library</h1>
        <p style={{ color: '#52606d' }}>
          Select or create a project on the <Link to="/">Projects</Link> page first.
        </p>
      </section>
    );
  }

  if (!meta) {
    return <NotFound message="Unknown entity type." />;
  }

  if (loading) {
    return <p>Loading…</p>;
  }

  const isNew = id === 'new' || !id;
  const exists = isNew || entitiesForKind(library, meta.kind).some((r) => r.id === id);
  if (!exists) {
    return <NotFound message={`${meta.label} not found.`} />;
  }

  const title = `${isNew ? 'New' : 'Edit'} ${meta.label.toLowerCase()}`;

  return (
    <section>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
        <Link to="/library">← Library</Link>
      </p>
      <h1 style={{ marginTop: 0 }}>{title}</h1>
      {renderEditor()}
    </section>
  );

  function renderEditor() {
    if (!meta) return null;
    const entityId = isNew ? null : (id ?? null);
    switch (meta.kind) {
      case 'channel':
        return (
          <ChannelEditor
            projectId={projectId!}
            library={library}
            entity={entityId ? (library.channels.find((c) => c.id === entityId) ?? null) : null}
          />
        );
      case 'talkGroup':
        return (
          <TalkGroupEditor
            projectId={projectId!}
            entity={entityId ? (library.talkGroups.find((t) => t.id === entityId) ?? null) : null}
          />
        );
      case 'digitalContact':
        return (
          <DigitalContactEditor
            projectId={projectId!}
            entity={
              entityId ? (library.digitalContacts.find((c) => c.id === entityId) ?? null) : null
            }
          />
        );
      case 'analogContact':
        return (
          <AnalogContactEditor
            projectId={projectId!}
            entity={
              entityId ? (library.analogContacts.find((c) => c.id === entityId) ?? null) : null
            }
          />
        );
      case 'rxGroupList':
        return (
          <RxGroupListEditor
            projectId={projectId!}
            library={library}
            entity={entityId ? (library.rxGroupLists.find((r) => r.id === entityId) ?? null) : null}
          />
        );
      case 'zone':
        return (
          <ZoneEditor
            projectId={projectId!}
            library={library}
            entity={entityId ? (library.zones.find((z) => z.id === entityId) ?? null) : null}
          />
        );
    }
  }
}

function NotFound({ message }: { message: string }) {
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Not found</h1>
      <p style={{ color: '#52606d' }}>{message}</p>
      <p>
        <Link to="/library">← Back to library</Link>
      </p>
    </section>
  );
}
