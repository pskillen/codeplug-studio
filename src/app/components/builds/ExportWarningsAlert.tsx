import { Accordion, Alert, List, Stack, Text } from '@mantine/core';
import {
  formatExportWarnings,
  memberCapGroupIntro,
  memberCapItemLine,
  wireNameShorteningIntro,
  type MemberCapGroup,
  type WireNameShortening,
  type WireNameShorteningGroup,
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

function accordionControlLabel(title: string, count: number): string {
  return `${title} (${count})`;
}

function MemberCapGroupPanel({ group }: { group: MemberCapGroup }) {
  return (
    <Stack gap={4}>
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
  );
}

function ShortenedGroupPanel({ group }: { group: WireNameShorteningGroup }) {
  return (
    <Stack gap={4}>
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
  );
}

export default function ExportWarningsAlert({ warnings }: ExportWarningsAlertProps) {
  if (warnings.length === 0) return null;

  const { general, unlinkedGroup, memberCapGroups, shortenedGroups } =
    formatExportWarnings(warnings);

  const hasFoldable =
    unlinkedGroup != null || memberCapGroups.length > 0 || shortenedGroups.length > 0;

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
        {hasFoldable ? (
          <Accordion multiple variant="separated" defaultValue={[]}>
            {unlinkedGroup != null ? (
              <Accordion.Item value="unlinked">
                <Accordion.Control>
                  {accordionControlLabel(unlinkedGroup.title, unlinkedGroup.items.length)}
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap={4}>
                    {unlinkedGroup.items.map((warning) => (
                      <Text key={warning} size="sm">
                        {warning}
                      </Text>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ) : null}
            {memberCapGroups.map((group) => {
              const value = `member-cap-${group.kind}-${group.cap}-${group.profileLabel ?? ''}`;
              return (
                <Accordion.Item key={value} value={value}>
                  <Accordion.Control>
                    {accordionControlLabel(group.title, group.items.length)}
                  </Accordion.Control>
                  <Accordion.Panel>
                    <MemberCapGroupPanel group={group} />
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
            {shortenedGroups.map((group) => {
              const value = `shortened-${group.entityKind}-${group.maxLen}-${group.profileLabel ?? ''}`;
              return (
                <Accordion.Item key={value} value={value}>
                  <Accordion.Control>
                    {accordionControlLabel(group.title, group.items.length)}
                  </Accordion.Control>
                  <Accordion.Panel>
                    <ShortenedGroupPanel group={group} />
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        ) : null}
      </Stack>
    </Alert>
  );
}
