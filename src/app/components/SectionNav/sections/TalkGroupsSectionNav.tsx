import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import EntityListSectionNav from './EntityListSectionNav.tsx';

export default function TalkGroupsSectionNav(props: SectionNavProps) {
  return (
    <EntityListSectionNav {...props} newPath="/library/talk-groups/new" newLabel="New talk group" />
  );
}
