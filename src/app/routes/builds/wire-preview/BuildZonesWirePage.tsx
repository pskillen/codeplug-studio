import BuildEntityWirePage from './BuildEntityWirePage.tsx';
import BuildZoneExportControls from '../../../components/builds/BuildZoneExportControls.tsx';
import { useBuildLayout } from '../BuildLayoutContext.tsx';

export default function BuildZonesWirePage() {
  const { build } = useBuildLayout();

  return (
    <BuildEntityWirePage
      title="Zones"
      entityKind="zone"
      description="Toggle inclusion and override zone wire names for export. Zones with Don't export as its own zone in the library are marked and omitted from Zones.csv."
      beforeTable={build.formatId === 'dm32' ? <BuildZoneExportControls /> : undefined}
    />
  );
}
