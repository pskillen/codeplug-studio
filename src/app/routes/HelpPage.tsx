import { Anchor, List, Stack, Text } from '@mantine/core';
import { ListPage, PageSection } from '../components/ui/index.ts';

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
            <strong>Library</strong> — curate channels, talk groups, contacts, RX group lists, and
            zones in a vendor-neutral inventory.
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
          <List.Item>
            <strong>Map</strong> — plot located channels on a map.
          </List.Item>
        </List>
        <Stack gap="xs" mt="md">
          <Text size="sm">
            <Anchor
              href="https://github.com/pskillen/codeplug-studio"
              target="_blank"
              rel="noreferrer"
            >
              Project repository &amp; docs
            </Anchor>
          </Text>
        </Stack>
      </PageSection>
    </ListPage>
  );
}
