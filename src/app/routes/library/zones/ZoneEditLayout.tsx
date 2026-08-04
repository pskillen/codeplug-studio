import { Link, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  DesignSystemV2Provider,
} from '../../../components/v2/index.ts';
import { UnsavedChangesModal } from '../../../components/ui/index.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import { ZoneEditProvider, useZoneEdit } from './ZoneEditContext.tsx';
import classes from './ZoneEditLayout.module.css';

function ZoneEditChrome() {
  const navigate = useNavigate();
  const { previewZone, saving, validationError, error, handleSave, modalOpen, stay, leave } =
    useZoneEdit();
  const displayError = validationError ?? error;

  return (
    <div className={classes.root}>
      <header className={classes.stickyHeader}>
        <Link to="/library/zones" className={classes.backLink}>
          ← Zones
        </Link>
        <div className={classes.headerDivider} aria-hidden />
        <div className={classes.headerIdentity}>
          <div className={classes.headerName}>{previewZone.name || 'Untitled zone'}</div>
          <div className={classes.headerSubtitle}>Edit zone</div>
        </div>
        <div className={classes.headerActions}>
          <Button variant="secondary" onClick={() => navigate('/library/zones')}>
            Discard
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Save zone
          </Button>
        </div>
      </header>

      {displayError ? <p className={classes.error}>{displayError}</p> : null}

      <div className={classes.content}>
        <Outlet />
      </div>

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
          <p className={classes.headerName}>Loading…</p>
        </div>
      </DesignSystemV2Provider>
    );
  }

  const entity = library.zones.find((z) => z.id === zoneId);
  if (!entity) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.root}>
          <header className={classes.stickyHeader}>
            <Link to="/library/zones" className={classes.backLink}>
              ← Zones
            </Link>
          </header>
          <div className={classes.content}>
            <p className={classes.headerName}>Zone not found</p>
          </div>
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
