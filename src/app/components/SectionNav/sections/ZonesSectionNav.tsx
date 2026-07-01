import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import EntityListSectionNav from './EntityListSectionNav.tsx';

export default function ZonesSectionNav(props: SectionNavProps) {
  return <EntityListSectionNav {...props} newPath="/library/zones/new" newLabel="New zone" />;
}
