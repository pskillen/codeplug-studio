import ExportBuildCpsPanel from '../../components/builds/ExportBuildCpsPanel.tsx';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import classes from './BuildExportPage.module.css';

export default function BuildExportSettingsPage() {
  const { build } = useBuildLayout();

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.title}>Export settings</h1>
        <p className={classes.subtitle}>
          Projection defaults for this build — name modes, inclusion, expansion, and behavioural
          overrides. Pathway choice and download actions stay on Export.
        </p>
      </div>
      <ExportBuildCpsPanel build={build} panelMode="settings" />
    </div>
  );
}
