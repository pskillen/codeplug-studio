import { Anchor, List, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { ListPage, PageSection } from '../components/ui/index.ts';
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '../lib/githubLinks.ts';

export default function HelpPage() {
  return (
    <ListPage
      title="Help"
      description="Codeplug Studio is a browser-based designer for amateur radio codeplug layouts."
    >
      <PageSection title="Workflow">
        <List spacing="sm" size="sm">
          <List.Item>
            <strong>Projects</strong> — create, switch, rename, and delete projects.
          </List.Item>
          <List.Item>
            <strong>Library</strong> — dedicated list routes per entity kind (channels, zones, talk
            groups, contacts, RX group lists). Channels and zones include the codeplug map.
          </List.Item>
          <List.Item>
            <strong>Repeater directories</strong> — add new channels from ukrepeater.net or
            BrandMeister, or check an existing channel against the directory from the channel
            editor.
          </List.Item>
          <List.Item>
            <strong>Summary</strong> — at-a-glance library inventory, breakdowns, and integrity
            warnings.
          </List.Item>
        </List>
      </PageSection>
      <PageSection title="External data">
        <Stack gap="xs">
          <Text size="sm">
            Studio queries public directories and map services from your browser. See{' '}
            <Anchor component={Link} to="/attributions" size="sm">
              Attributions
            </Anchor>{' '}
            for OpenAIP, ukrepeater.net, BrandMeister, map tiles, and related credits.
          </Text>
        </Stack>
      </PageSection>
      <PageSection title="Feedback">
        <Stack gap="xs">
          <Text size="sm">
            Use{' '}
            <Anchor href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
              GitHub Issues
            </Anchor>{' '}
            for bug reports and feature requests. Include steps to reproduce, what you expected, and
            which page you were on.
          </Text>
          <Text size="sm">
            <Anchor href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
              Project repository
            </Anchor>{' '}
            — source code, release notes, and contributor docs.
          </Text>
        </Stack>
      </PageSection>
    </ListPage>
  );
}
