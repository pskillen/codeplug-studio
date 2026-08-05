import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import { MembershipRow } from '../../../components/v2/index.ts';

export default function StyleguideV2MembershipPage() {
  return (
    <Page width="default">
      <PageHeader
        title="Membership"
        description={
          <>
            <Link to="/styleguide/v2">← Design system v2</Link> — the members-first list +
            full-screen add takeover family that supersedes ShuttleList.
          </>
        }
      />

      <PageSection
        title="MembershipRow"
        description="Card-style member row; checkbox, remove, and drag handle are implicit by prop presence."
      >
        <MembershipRow
          label="GB3DA Stornoway"
          subtitle="145.575 MHz"
          onCheck={() => undefined}
          checked
          onRemove={() => undefined}
        />
        <MembershipRow
          label="GB3IV Inverness"
          subtitle="145.175 MHz"
          onCheck={() => undefined}
          onRemove={() => undefined}
        />
        <MembershipRow label="Zone member order (reorder-only, no selection/remove)" />
      </PageSection>
    </Page>
  );
}
