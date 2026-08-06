import { useMediaQuery } from '@mantine/hooks';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import ChannelBehaviourDefaultsEditor from './ChannelBehaviourDefaultsEditor.tsx';
import classes from './DefaultsSettings.module.css';

export default function ChannelDefaultsPage() {
  const { library, loading, projectId, reload } = useLibrary();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  if (loading || !projectId) {
    return (
      <DesignSystemV2Provider>
        <p className={classes.loading}>Loading channel defaults…</p>
      </DesignSystemV2Provider>
    );
  }

  return (
    <DesignSystemV2Provider>
      <div className={[classes.page, isMobile ? classes.pageCompact : ''].filter(Boolean).join(' ')}>
        <h1 className={classes.title}>Channel defaults</h1>
        <p className={classes.blurb}>
          Library-wide behavioural defaults for channels. Per-channel and per-build overrides take
          precedence when set.
        </p>
        <ChannelBehaviourDefaultsEditor
          projectId={projectId}
          channelDefaults={library.channelDefaults}
          onSaved={reload}
        />
      </div>
    </DesignSystemV2Provider>
  );
}
