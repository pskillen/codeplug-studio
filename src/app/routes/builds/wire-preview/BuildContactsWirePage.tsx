import BuildEntityWirePage from './BuildEntityWirePage.tsx';
import { useBuildLayout } from '../BuildLayoutContext.tsx';
import { egressIdentityForBuild } from '../../../lib/buildEgressUi.ts';

export default function BuildContactsWirePage() {
  const { build, activeEgress } = useBuildLayout();
  const { formatId } = egressIdentityForBuild(build, activeEgress);
  const showDigitalContactExportNameMode = formatId === 'anytone' || formatId === 'opengd77';

  return (
    <BuildEntityWirePage
      title="Contacts"
      entityKind="contact"
      description="Digital and analog contacts referenced by exported channels."
      showDigitalContactExportNameMode={showDigitalContactExportNameMode}
    />
  );
}
