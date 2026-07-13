import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import LibrarySectionNavFrame from './LibrarySectionNavFrame.tsx';

/** Singleton APRS settings — library area links only (no list CRUD actions). */
export default function AprsConfigurationSectionNav(props: SectionNavProps) {
  void props;
  return <LibrarySectionNavFrame>{null}</LibrarySectionNavFrame>;
}
