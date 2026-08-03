import { Anchor, List, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { ListPage, PageSection } from '../../components/ui/index.ts';
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '../../lib/githubLinks.ts';

export default function PrivacyPolicyPage() {
  return (
    <ListPage
      title="Privacy policy"
      description="How Codeplug Studio handles your data on this device."
    >
      <PageSection title="Summary">
        <Text size="sm">
          Codeplug Studio keeps your library on this device — in the browser or in the Android
          companion app. Programming a radio over USB does not upload your codeplug. Nothing is sent
          off the device unless you start it (for example Google Drive, a remote directory lookup,
          or analytics you accepted). We do not operate a server that stores your codeplug contents.
        </Text>
      </PageSection>

      <PageSection title="Android companion">
        <Text size="sm">
          The Android phone app is the same Codeplug Studio product you use in a browser, wrapped so
          you can carry your library and program a radio over USB. It is not a separate service with
          different data rules. What you store on the phone stays on the phone unless you choose to
          send it elsewhere.
        </Text>
      </PageSection>

      <PageSection title="What stays on your device">
        <List spacing="sm" size="sm">
          <List.Item>
            Project and library data in on-device storage (browser or phone app)
          </List.Item>
          <List.Item>
            UI preferences (active project, map settings, list filters, optional Google Drive tokens
            if you connect)
          </List.Item>
          <List.Item>Cookie consent choice (see the Cookies page)</List.Item>
        </List>
      </PageSection>

      <PageSection title="Programming the radio over USB">
        <Text size="sm">
          When you read or write a radio from the Android app over a USB cable (with an OTG adapter
          where needed), the codeplug bytes stay between the phone and the radio. That exchange does
          not upload your codeplug to Codeplug Studio servers.
        </Text>
      </PageSection>

      <PageSection title="When something does leave your device">
        <Text size="sm" mb="sm">
          Data leaves this device only when you ask for it. Typical cases:
        </Text>
        <List spacing="sm" size="sm">
          <List.Item>
            Looking up a remote repeater or RadioID-style directory — you start the search
          </List.Item>
          <List.Item>
            Saving or loading with Google Drive — you connect and choose to sync
          </List.Item>
          <List.Item>
            Anonymous page-view analytics — only if you accepted analytics cookies
          </List.Item>
        </List>
      </PageSection>

      <PageSection title="Optional analytics">
        <Text size="sm">
          If you accept analytics cookies, we load Google Analytics 4 to measure anonymous page
          navigation (which routes are visited, rough session counts). This applies on the website
          and in the Android companion app. We do not send project names, channel data, callsigns,
          API tokens, or storage keys to Google. Analytics only runs after you opt in. See the{' '}
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
