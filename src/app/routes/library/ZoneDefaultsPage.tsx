import { useMediaQuery } from '@mantine/hooks';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import ZoneBehaviourDefaultsEditor from './ZoneBehaviourDefaultsEditor.tsx';
import classes from './DefaultsSettings.module.css';

export default function ZoneDefaultsPage() {
  const { library, loading, projectId, reload } = useLibrary();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  if (loading || !projectId) {
    return (
      <DesignSystemV2Provider>
        <p className={classes.loading}>Loading zone defaults…</p>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={[classes.page, isMobile ? classes.pageCompact : ''].filter(Boolean).join(' ')}>
        <h1 className={classes.title}>Zone defaults</h1>
        <p className={classes.blurb}>
          Choose whether zone members are included in or excluded from zone-derived scan lists by
          default. Per-member and per-build overrides still win when set.
        </p>
        <ZoneBehaviourDefaultsEditor
          projectId={projectId}
          zoneDefaults={library.zoneDefaults}
          onSaved={reload}
        />
      </div>
    </DesignSystemV2Provider>
  );
}
