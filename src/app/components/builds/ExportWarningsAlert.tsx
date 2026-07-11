import { Alert, List, Stack, Text } from '@mantine/core';
import {
  formatExportWarnings,
  memberCapGroupIntro,
  memberCapItemLine,
  wireNameShorteningIntro,
  type WireNameShortening,
} from './formatExportWarnings.ts';

export interface ExportWarningsAlertProps {
  warnings: string[];
}

function shorteningLine(item: WireNameShortening): string {
  if (item.stillExceedsLimit && item.exported === item.original) {
    return `"${item.original}"`;
  }
  if (item.stillExceedsLimit) {
    return `"${item.original}" → "${item.exported}" (still too long)`;
  }
  return `"${item.original}" → "${item.exported}"`;
}

export default function ExportWarningsAlert({ warnings }: ExportWarningsAlertProps) {
  if (warnings.length === 0) return null;

  const { general, memberCapGroups, shortenedGroups } = formatExportWarnings(warnings);

  return (
    <Alert color="yellow" title="Export warnings">
      <Stack gap="sm">
        {general.length > 0 ? (
          <Stack gap={4}>
            {general.map((warning) => (
              <Text key={warning} size="sm">
                {warning}
              </Text>
            ))}
          </Stack>
        ) : null}
        {memberCapGroups.map((group) => (
          <Stack key={`${group.kind}-${group.cap}-${group.profileLabel ?? ''}`} gap={4}>
            <Text size="sm" fw={600}>
              {group.title}
            </Text>
            <Text size="sm">{memberCapGroupIntro(group)}</Text>
            <List size="sm" spacing={2} withPadding>
              {group.items.map((item) => (
                <List.Item key={`${item.label}-${item.count}-${item.truncatedFrom ?? ''}`}>
                  <Text span size="sm" ff="monospace">
                    {memberCapItemLine(item, group.kind)}
                  </Text>
                </List.Item>
              ))}
            </List>
          </Stack>
        ))}
        {shortenedGroups.map((group) => (
          <Stack key={`${group.entityKind}-${group.maxLen}-${group.profileLabel ?? ''}`} gap={4}>
            <Text size="sm" fw={600}>
              {group.title}
            </Text>
            <Text size="sm">{wireNameShorteningIntro(group)}</Text>
            <List size="sm" spacing={2} withPadding>
              {group.items.map((item) => (
                <List.Item key={`${item.original}-${item.exported}`}>
                  <Text span size="sm" ff="monospace">
                    {shorteningLine(item)}
                  </Text>
                </List.Item>
              ))}
            </List>
          </Stack>
        ))}
      </Stack>
    </Alert>
  );
}
