import { useLibrary } from '../../../state/useLibrary.ts';
import { DesignSystemV2Provider } from '../../../components/v2/index.ts';
import ZoneEditor from '../ZoneEditor.tsx';
import classes from './ZoneEditLayout.module.css';

export default function ZoneCreatePage() {
  const { library, loading, projectId } = useLibrary();

  if (loading || !projectId) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.root}>
          <p className={classes.headerName}>Loading…</p>
        </div>
      </DesignSystemV2Provider>
    );
  }

  return <ZoneEditor projectId={projectId} library={library} entity={null} />;
}
