import ExportBuildCpsPanel from '../../components/builds/ExportBuildCpsPanel.tsx';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import classes from './BuildExportPage.module.css';

export default function BuildExportPage() {
  const { build } = useBuildLayout();

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.title}>Export</h1>
        <p className={classes.subtitle}>
          Choose a pathway, tune projection settings, then download CPS files or write over Web
          Serial. Settings persist when you switch pathway.
        </p>
      </div>
      <ExportBuildCpsPanel build={build} />
    </div>
  );
}
