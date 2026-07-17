import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import EntityListSectionNav from './EntityListSectionNav.tsx';

export default function RxGroupListsSectionNav(props: SectionNavProps) {
  return (
    <EntityListSectionNav
      {...props}
      newPath="/library/rx-group-lists/new"
      newLabel="New Receive Group List"
    />
  );
}
