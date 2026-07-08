import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import EntityListSectionNav from './EntityListSectionNav.tsx';

export default function ScanListsSectionNav(props: SectionNavProps) {
  return (
    <EntityListSectionNav {...props} newPath="/library/scan-lists/new" newLabel="New scan list" />
  );
}
