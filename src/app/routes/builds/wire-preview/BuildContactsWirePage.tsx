import BuildEntityWirePage from './BuildEntityWirePage.tsx';
import { useBuildLayout } from '../BuildLayoutContext.tsx';

export default function BuildContactsWirePage() {
  const { build } = useBuildLayout();
  const showDigitalContactExportNameMode =
    build.formatId === 'anytone' || build.formatId === 'opengd77';

  return (
    <BuildEntityWirePage
      title="Contacts"
      entityKind="contact"
      description="Digital and analog contacts referenced by exported channels."
      showDigitalContactExportNameMode={showDigitalContactExportNameMode}
    />
  );
}
