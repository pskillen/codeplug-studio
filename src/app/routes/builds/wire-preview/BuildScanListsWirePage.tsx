import BuildEntityWirePage from './BuildEntityWirePage.tsx';
import BuildScanListLayoutEditor from '../../../components/builds/BuildScanListLayoutEditor.tsx';

export default function BuildScanListsWirePage() {
  return (
    <BuildEntityWirePage
      title="Scan lists"
      entityKind="scanList"
      description="Define scan list membership on this build and override wire names for ScanList.CSV export."
      beforeTable={<BuildScanListLayoutEditor />}
    />
  );
}
