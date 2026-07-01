import { Button, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { LibraryEntityKind } from '@integrations/persistence/index.ts';
import type { Library } from '@core/models/library.ts';
import { EmptyState } from '../../components/ui/index.ts';
import { describeEntity, entitiesForKind } from '../../routes/library/registry.ts';

export interface LibraryEntityListProps {
  library: Library;
  kind: LibraryEntityKind;
  slug: string;
  plural: string;
  label: string;
  onDelete: (kind: LibraryEntityKind, id: string, name: string) => void;
}

export default function LibraryEntityList({
  library,
  kind,
  slug,
  plural,
  label,
  onDelete,
}: LibraryEntityListProps) {
  const rows = entitiesForKind(library, kind);

  if (rows.length === 0) {
    return (
      <EmptyState
        message={`No ${plural.toLowerCase()} yet.`}
        action={
          <Button component={Link} to={`/library/${slug}/new`} variant="light" size="compact-sm">
            Add {label.toLowerCase()}
          </Button>
        }
      />
    );
  }

  return (
    <Stack gap="xs">
      {rows.map((row) => (
        <Group
          key={row.id}
          justify="space-between"
          wrap="wrap"
          p="sm"
          style={{
            border: '1px solid var(--mantine-color-dark-4)',
            borderRadius: 'var(--mantine-radius-md)',
          }}
        >
          <Stack gap={2}>
            <Text
              component={Link}
              to={`/library/${slug}/${row.id}`}
              fw={600}
              c="inherit"
              style={{ textDecoration: 'none' }}
            >
              {row.name}
            </Text>
            <Text size="xs" c="dimmed">
              {describeEntity(library, kind, row.id)}
            </Text>
          </Stack>
          <Group gap="xs">
            <Button
              component={Link}
              to={`/library/${slug}/${row.id}`}
              size="compact-sm"
              variant="light"
            >
              Edit
            </Button>
            <Button
              size="compact-sm"
              color="red"
              variant="light"
              onClick={() => onDelete(kind, row.id, row.name)}
            >
              Delete
            </Button>
          </Group>
        </Group>
      ))}
    </Stack>
  );
}
