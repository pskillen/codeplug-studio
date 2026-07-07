import { Anchor, List, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { ListPage, PageSection } from '../../components/ui/index.ts';
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '../../lib/githubLinks.ts';

export default function PrivacyPolicyPage() {
  return (
    <ListPage
      title="Privacy policy"
      description="How Codeplug Studio handles your data in the browser."
    >
      <PageSection title="Summary">
        <Text size="sm">
          Codeplug Studio runs entirely in your browser. Your codeplug projects, library channels, and
          related data are stored locally on your device (IndexedDB and browser storage). We do not
          operate a server that stores your codeplug contents.
        </Text>
      </PageSection>

      <PageSection title="What stays on your device">
        <List spacing="sm" size="sm">
          <List.Item>Project and library data in IndexedDB</List.Item>
          <List.Item>
            UI preferences in localStorage (active project, map settings, list filters, optional
            Google Drive tokens if you connect)
          </List.Item>
          <List.Item>Cookie consent choice (see Cookies page)</List.Item>
        </List>
      </PageSection>

      <PageSection title="Optional analytics">
        <Text size="sm">
          If you accept analytics cookies, we load Google Analytics 4 to measure anonymous page
          navigation (which routes are visited, rough session counts). We do not send project names,
          channel data, callsigns, API tokens, or storage keys to Google. Analytics only runs after
          you opt in. See the{' '}
          <Anchor component={Link} to="/cookies" size="sm">
            Cookies
          </Anchor>{' '}
          page to change your choice.
        </Text>
      </PageSection>

      <PageSection title="Contact">
        <Text size="sm">
          Questions or concerns: open an issue on{' '}
          <Anchor href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
            GitHub
          </Anchor>{' '}
          or see the{' '}
          <Anchor href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
            repository
          </Anchor>
          .
        </Text>
      </PageSection>

      <Text size="xs" c="dimmed" mt="lg">
        This page is informal guidance for a hobby tool — not legal advice.
      </Text>
    </ListPage>
  );
}
