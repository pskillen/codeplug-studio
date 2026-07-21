import { useState } from 'react';
import { Anchor, Button, List, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { ListPage, PageSection } from '../components/ui/index.ts';
import { GettingStartedModal } from '../components/onboarding/index.ts';
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL } from '../lib/githubLinks.ts';

export default function HelpPage() {
  const [quickStartOpen, setQuickStartOpen] = useState(false);

  return (
    <>
      <ListPage
        title="Help"
        description="Codeplug Studio is a browser-based designer for amateur radio codeplug layouts."
        actions={
          <Button variant="default" onClick={() => setQuickStartOpen(true)}>
            Quick start
          </Button>
        }
      >
        <PageSection title="Getting started">
          <Text size="sm">
            Use <strong>Quick start</strong> for the library → builds → export path, directories
            under <strong>Add from…</strong>, and how Studio differs from a typical CPS. When you
            have no projects yet, the same guide also appears on the{' '}
            <Anchor component={Link} to="/" size="sm">
              Projects
            </Anchor>{' '}
            page.
          </Text>
        </PageSection>
        <PageSection title="Workflow">
          <List spacing="sm" size="sm">
            <List.Item>
              <strong>Projects</strong> — create, switch, rename, and delete projects. Import an
              existing Studio YAML backup from Projects when you already have one.
            </List.Item>
            <List.Item>
              <strong>Library</strong> — channels, zones, talk groups, contacts, RX group lists, and
              scan lists. Prefer <strong>Channels</strong> → <strong>Add from…</strong>{' '}
              (ukrepeater.net, RepeaterBook, BrandMeister, curated sets, and more) over typing every
              channel by hand.
            </List.Item>
            <List.Item>
              <strong>Export for radio</strong> — assemble a format build for your radio, then
              export CPS files for your vendor CPS to flash. Opening a build lands on Export.
            </List.Item>
            <List.Item>
              <strong>Summary</strong> — library inventory, integrity warnings, and project YAML
              backup (import/export + Drive).
            </List.Item>
            <List.Item>
              <strong>Reference</strong> — optional tools such as the{' '}
              <Anchor component={Link} to="/reference/bands" size="sm">
                band plan
              </Anchor>{' '}
              and{' '}
              <Anchor component={Link} to="/reference/maidenhead" size="sm">
                Maidenhead locator
              </Anchor>
              .
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
              for OpenAIP, ukrepeater.net, IRTS, BrandMeister, RepeaterBook, map tiles, and related
              credits.
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
              for bug reports and feature requests. Include steps to reproduce, what you expected,
              and which page you were on.
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

      <GettingStartedModal opened={quickStartOpen} onClose={() => setQuickStartOpen(false)} />
    </>
  );
}
