import type { ReactNode } from 'react';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { WirePreviewEntityKind } from '@core/services/previewWireRows.ts';
import CommonOverrideSection, {
  type CommonOverrideSectionProps,
} from './overrideModalSections/CommonOverrideSection.tsx';

export interface OverrideModalContext extends Omit<CommonOverrideSectionProps, 'showForceInclude'> {
  build: FormatBuild;
  entityKind: WirePreviewEntityKind;
}

export function resolveOverrideModalSections(context: OverrideModalContext): ReactNode[] {
  const { entityKind, ...commonProps } = context;
  const sections: ReactNode[] = [
    <CommonOverrideSection
      key="common"
      {...commonProps}
      showForceInclude={entityKind === 'zone'}
    />,
  ];
  return sections;
}
