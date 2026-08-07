import { Link, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import { useMemo } from 'react';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import {
  DesignSystemV2Provider,
  EditorHeader,
  StickyFooter,
} from '../../../components/v2/index.ts';
import { UnsavedChangesModal } from '../../../components/ui/index.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../../lib/breakpoints.ts';
import { ZoneEditProvider, useZoneEdit } from './ZoneEditContext.tsx';
import classes from './ZoneEditLayout.module.css';

function ZoneEditChrome() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);
  const {
    previewZone,
    library,
    name,
    members,
    saving,
    validationError,
    error,
    handleSave,
    modalOpen,
    stay,
    leave,
  } = useZoneEdit();
  const displayError = validationError ?? error;

  const effectiveCount = useMemo(
    () => resolveEffectiveZoneChannelIds(previewZone, library.zones).length,
    [previewZone, library.zones],
  );

  const subtitle = `${members.length} direct member${members.length === 1 ? '' : 's'} · ${effectiveCount} effective channel${effectiveCount === 1 ? '' : 's'}`;

  return (
    <div className={classes.root}>
      <EditorHeader
        compact={isMobile}
        crumb="Zones"
        crumbTo="/library/zones"
        title={name.trim() || 'Untitled zone'}
        subtitle={subtitle}
      />

      {displayError ? <p className={classes.error}>{displayError}</p> : null}

      <div
        className={[classes.scrollBody, isMobile ? classes.scrollBodyCompact : '']
          .filter(Boolean)
          .join(' ')}
      >
        <Outlet />
      </div>

      <StickyFooter
        compact={isMobile}
        saveLabel="Save zone"
        onCancel={() => navigate('/library/zones')}
        onSave={handleSave}
        saving={saving}
      />

      <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
    </div>
  );
}

export default function ZoneEditLayout() {
  const { zoneId } = useParams();
  const { library, loading, projectId } = useLibrary();

  if (!zoneId || zoneId === 'new') {
    return <Navigate to="/library/zones/new" replace />;
  }

  if (loading || !projectId) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.root}>
          <p className={classes.loading}>Loading…</p>
        </div>
      </DesignSystemV2Provider>
    );
  }

  const entity = library.zones.find((z) => z.id === zoneId);
  if (!entity) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.root}>
          <EditorHeader crumb="Zones" crumbTo="/library/zones" title="Zone not found" />
          <p className={classes.error}>This zone no longer exists in the library.</p>
          <Link to="/library/zones">Back to zones</Link>
        </div>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <ZoneEditProvider entity={entity} library={library} projectId={projectId}>
        <ZoneEditChrome />
      </ZoneEditProvider>
    </DesignSystemV2Provider>
  );
}
