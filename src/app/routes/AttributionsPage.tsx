import { Anchor, List, Stack, Text } from '@mantine/core';
import { ListPage, PageSection } from '../components/ui/index.ts';
import { ATTRIBUTIONS } from '../lib/attributions.ts';

export default function AttributionsPage() {
  return (
    <ListPage
      title="Attributions"
      description="External data sources and services used by Codeplug Studio. Your API keys and tokens stay in browser storage — requests go directly from your browser where applicable."
    >
      {ATTRIBUTIONS.map((entry) => (
        <PageSection key={entry.id} title={entry.name}>
          <Stack gap="xs">
            <Text size="sm">{entry.description}</Text>
            <Text size="sm">
              <Anchor href={entry.homeUrl} target="_blank" rel="noreferrer">
                {entry.homeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </Anchor>
              {entry.termsUrl && entry.termsUrl !== entry.homeUrl ? (
                <>
                  {' '}
                  ·{' '}
                  <Anchor href={entry.termsUrl} target="_blank" rel="noreferrer">
                    Terms / API
                  </Anchor>
                </>
              ) : null}
            </Text>
            <List spacing={4} size="sm">
              {entry.usedIn.map((use) => (
                <List.Item key={use}>{use}</List.Item>
              ))}
            </List>
          </Stack>
        </PageSection>
      ))}

      <Text size="xs" c="dimmed" mt="md">
        Directory and aviation data are for amateur programming convenience — not authoritative for
        emergency or aviation operations.
      </Text>
    </ListPage>
  );
}
