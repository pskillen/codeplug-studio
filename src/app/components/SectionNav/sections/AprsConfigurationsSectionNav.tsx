import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import EntityListSectionNav from './EntityListSectionNav.tsx';

export default function AprsConfigurationsSectionNav(props: SectionNavProps) {
  return (
    <EntityListSectionNav
      {...props}
      newPath="/library/aprs-configurations/new"
      newLabel="New APRS configuration"
    />
  );
}
