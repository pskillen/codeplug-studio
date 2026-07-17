import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../components/ui/index.ts';
import MembershipListsDemo from './MembershipListsDemo.tsx';

export default function StyleguideMembershipPage() {
  return (
    <Page width="default">
      <PageHeader
        title="Styleguide — membership"
        description={
          <>
            <Link to="/styleguide">← Styleguide</Link> · Roles B (picker) and C (membership list)
          </>
        }
      />

      <PageSection
        title="SelectedItemList & AvailableItemPicker"
        description="Membership shells with rich row renderers — mirrors zone editor channel/zone rows, pills, and scan-list toggle."
      >
        <MembershipListsDemo />
      </PageSection>
    </Page>
  );
}
