import { Text } from '@mantine/core';

export default function BuildFooter() {
  return (
    <Text
      size="sm"
      c="dimmed"
      mt="xl"
      pt="md"
      style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}
    >
      Codeplug Studio · {__BUILD_ENV__} · {__BUILD_VERSION__}
    </Text>
  );
}
