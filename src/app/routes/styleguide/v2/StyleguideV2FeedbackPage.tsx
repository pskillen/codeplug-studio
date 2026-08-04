import { Stack } from '@mantine/core';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import { StatusBanner } from '../../../components/v2/index.ts';

export default function StyleguideV2FeedbackPage() {
  return (
    <Page width="default">
      <PageHeader
        title="Feedback"
        description={
          <>
            <Link to="/styleguide/v2">← Design system v2</Link>
          </>
        }
      />

      <PageSection title="StatusBanner" description="Success, warning, and info tones.">
        <Stack gap="sm">
          <StatusBanner tone="success">
            No dangling references — all relationships resolve.
          </StatusBanner>
          <StatusBanner tone="warning">3 channels reference a missing talk group.</StatusBanner>
          <StatusBanner tone="info">
            Export combines library + build via assemble — re-import may differ.
          </StatusBanner>
        </Stack>
      </PageSection>
    </Page>
  );
}
