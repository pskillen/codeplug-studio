import { Text } from '@mantine/core';
import { ListPage } from '../../components/ui/index.ts';

export default function ReferenceIndexPage() {
  return (
    <ListPage
      title="Reference"
      description="Lookup tables and helpers for amateur radio programming — not authoritative for on-air operation."
    >
      <Text c="dimmed" size="sm">
        Choose a reference tool from the sidebar.
      </Text>
    </ListPage>
  );
}
