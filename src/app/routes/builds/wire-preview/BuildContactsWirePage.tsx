import BuildEntityWirePage from './BuildEntityWirePage.tsx';
import { useBuildLayout } from '../BuildLayoutContext.tsx';
import { radioTargetHasCompatibleFormat } from '@core/radio-targets/index.ts';

export default function BuildContactsWirePage() {
  const { build } = useBuildLayout();
  const showDigitalContactExportNameMode =
    radioTargetHasCompatibleFormat(build.radioTargetId, 'anytone') ||
    radioTargetHasCompatibleFormat(build.radioTargetId, 'opengd77');

  return (
    <BuildEntityWirePage
      title="Contacts"
      entityKind="contact"
      description="Digital and analog contacts referenced by exported channels."
      showDigitalContactExportNameMode={showDigitalContactExportNameMode}
    />
  );
}
