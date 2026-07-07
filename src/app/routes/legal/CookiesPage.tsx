import { Anchor, List, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import CookiePreferenceControl from '../../components/CookieConsentBanner/CookiePreferenceControl.tsx';
import { ListPage, PageSection } from '../../components/ui/index.ts';

export default function CookiesPage() {
  return (
    <ListPage
      title="Cookies & storage"
      description="What Codeplug Studio stores in your browser and why."
    >
      <PageSection title="Essential storage">
        <Text size="sm" mb="sm">
          These are required for the app to work. They are not used for advertising or cross-site
          tracking.
        </Text>
        <List spacing="sm" size="sm">
          <List.Item>
            <strong>IndexedDB</strong> — your projects, library entities, and format builds
          </List.Item>
          <List.Item>
            <strong>localStorage preferences</strong> — active project, map token, list filters,
            optional Google Drive session if you connect
          </List.Item>
          <List.Item>
            <strong>Cookie consent record</strong> — remembers whether you accepted or declined
            analytics
          </List.Item>
        </List>
      </PageSection>

      <PageSection title="Optional analytics cookies">
        <Text size="sm">
          If you accept analytics, Google Analytics 4 may set cookies to measure anonymous page views.
          No codeplug data is included. You can decline and use the app fully — only usage statistics
          are withheld. See the{' '}
          <Anchor component={Link} to="/privacy" size="sm">
            Privacy policy
          </Anchor>{' '}
          for more detail.
        </Text>
      </PageSection>

      <PageSection title="Your preference">
        <Stack gap="sm" id="cookie-preference">
          <CookiePreferenceControl />
        </Stack>
      </PageSection>
    </ListPage>
  );
}
