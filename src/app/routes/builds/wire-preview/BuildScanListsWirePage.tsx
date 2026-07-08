import BuildEntityWirePage from './BuildEntityWirePage.tsx';
import BuildScanListLibraryGuidance from '../../../components/builds/BuildScanListLibraryGuidance.tsx';

export default function BuildScanListsWirePage() {
  return (
    <BuildEntityWirePage
      title="Scan lists"
      entityKind="scanList"
      description="Curate scan list membership in the library; override wire names here for ScanList.CSV export."
      beforeTable={<BuildScanListLibraryGuidance />}
    />
  );
}
