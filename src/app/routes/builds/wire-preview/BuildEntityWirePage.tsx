import type { ReactNode } from 'react';
import BuildWirePreviewListPage from './BuildWirePreviewListPage.tsx';

export interface BuildEntityWirePageProps {
  title: string;
  entityKind: import('@core/services/previewWireRows.ts').WirePreviewEntityKind;
  description?: string;
  showExportNameMode?: boolean;
  showLibraryAbbreviations?: boolean;
  /** @deprecated Overrides edited via modal or bulk edit */
  clickableDefaultWireName?: boolean;
  beforeTable?: ReactNode;
}

/** Thin wrapper — prefer BuildWirePreviewListPage for new routes. */
export default function BuildEntityWirePage(props: BuildEntityWirePageProps) {
  return <BuildWirePreviewListPage {...props} />;
}
