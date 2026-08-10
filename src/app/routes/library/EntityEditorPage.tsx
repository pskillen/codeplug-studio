import { Anchor } from '@mantine/core';
import { useCallback, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useLibrary } from '../../state/useLibrary.ts';
import { FormPage } from '../../components/ui/index.ts';
import { entitiesForKind, kindBySlug } from './registry.ts';
import type { LibraryEntityKind } from '@integrations/persistence/index.ts';
import { listPathForEditorSlug } from './nav.ts';
import ChannelEditor from './ChannelEditor.tsx';
import RxGroupListEditor from './RxGroupListEditor.tsx';
import ScanListEditor from './ScanListEditor.tsx';
import AprsConfigurationEditor from './AprsConfigurationEditor.tsx';
import ZoneEditor from './ZoneEditor.tsx';
import { TalkGroupEditor } from './TalkGroupEditor.tsx';
import { DigitalContactEditor } from './DigitalContactEditor.tsx';
import { AnalogContactEditor } from './AnalogContactEditor.tsx';
import { SatelliteEditor } from './SatelliteEditor.tsx';

const V2_SELF_SHELLED_EDITORS = new Set<LibraryEntityKind>([
  'channel',
  'rxGroupList',
  'talkGroup',
  'digitalContact',
  'analogContact',
  'scanList',
  'satellite',
]);

export default function EntityEditorPage() {
  const { kind: slug, id } = useParams();
  const meta = slug ? kindBySlug(slug) : undefined;
  const { library, loading, projectId } = useLibrary();
  const [channelPageTitle, setChannelPageTitle] = useState<{
    entityId: string | null;
    title: string;
  } | null>(null);

  const isNew = id === 'new' || !id;
  const entityId = isNew ? null : (id ?? null);
  const defaultTitle = meta
    ? meta.kind === 'rxGroupList'
      ? `${isNew ? 'New' : 'Edit'} Receive Group List`
      : `${isNew ? 'New' : 'Edit'} ${meta.label.toLowerCase()}`
    : 'Loading…';
  const pageTitle =
    meta?.kind === 'channel' && channelPageTitle != null && channelPageTitle.entityId === entityId
      ? channelPageTitle.title
      : defaultTitle;

  const handleChannelPageTitle = useCallback(
    (title: string) => {
      setChannelPageTitle((prev) => {
        if (prev?.entityId === entityId && prev.title === title) return prev;
        return { entityId, title };
      });
    },
    [entityId],
  );

  if (!meta) {
    return <NotFound message="Unknown entity type." />;
  }

  if (loading) {
    if (meta.kind === 'channel') {
      return <ChannelEditor projectId={projectId ?? ''} library={library} entity={null} loading />;
    }
    return (
      <FormPage title="Loading…">
        <span />
      </FormPage>
    );
  }

  const exists = isNew || entitiesForKind(library, meta.kind).some((r) => r.id === id);
  if (!exists) {
    return <NotFound message={`${meta.label} not found.`} slug={meta.slug} />;
  }

  const listPath = listPathForEditorSlug(meta.slug);

  if (V2_SELF_SHELLED_EDITORS.has(meta.kind)) {
    return renderEditor();
  }

  return (
    <FormPage
      title={pageTitle}
      description={
        <Anchor component={Link} to={listPath} size="sm">
          ← Back to{' '}
          {meta.kind === 'rxGroupList' ? 'Receive Group Lists' : meta.plural.toLowerCase()}
        </Anchor>
      }
    >
      {renderEditor()}
    </FormPage>
  );

  function renderEditor() {
    if (!projectId) return null;
    switch (meta!.kind) {
      case 'channel':
        return (
          <ChannelEditor
            key={entityId ? library.channels.find((c) => c.id === entityId)?.revision : 'new'}
            projectId={projectId}
            library={library}
            entity={entityId ? (library.channels.find((c) => c.id === entityId) ?? null) : null}
            onPageTitle={handleChannelPageTitle}
          />
        );
      case 'talkGroup':
        return (
          <TalkGroupEditor
            projectId={projectId}
            entity={entityId ? (library.talkGroups.find((t) => t.id === entityId) ?? null) : null}
          />
        );
      case 'digitalContact': {
        const digitalEntity = entityId
          ? (library.digitalContacts.find((c) => c.id === entityId) ?? null)
          : null;
        return (
          <DigitalContactEditor
            key={digitalEntity ? `${digitalEntity.id}:${digitalEntity.revision}` : 'new'}
            projectId={projectId}
            entity={digitalEntity}
          />
        );
      }
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
      case 'scanList':
        return (
          <ScanListEditor
            projectId={projectId}
            library={library}
            entity={entityId ? (library.scanLists.find((s) => s.id === entityId) ?? null) : null}
          />
        );
      case 'aprsConfiguration':
        return (
          <AprsConfigurationEditor
            projectId={projectId}
            library={library}
            entity={library.aprsConfiguration}
          />
        );
      case 'zone':
        if (entityId) {
          return <Navigate to={`/library/zones/${entityId}`} replace />;
        }
        return <ZoneEditor projectId={projectId} library={library} entity={null} />;
      case 'satellite': {
        // Satellite rows are only ever created via the CelesTrak/AMSAT refresh flow on the list
        // page — there is no "new satellite" editor mode.
        const satelliteEntity = entityId
          ? (library.satellites.find((s) => s.id === entityId) ?? null)
          : null;
        if (!satelliteEntity) {
          return <Navigate to="/library/satellite-keps" replace />;
        }
        return (
          <SatelliteEditor
            key={`${satelliteEntity.id}:${satelliteEntity.revision}`}
            entity={satelliteEntity}
          />
        );
      }
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
