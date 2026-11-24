import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { summariseExportWarnings } from '@core/import-export/exportWarning.ts';
import { Accordion, Alert, List, Stack, Text } from '@mantine/core';
import {
  formatExportWarnings,
  memberCapGroupIntro,
  memberCapItemLine,
  wireNameShorteningIntro,
  type MemberCapGroup,
  type WireNameShortening,
  type WireNameShorteningGroup,
} from '../../builds/formatExportWarnings.ts';
import classes from './WarningsList.module.css';

export type WarningsListMode = 'full' | 'problems' | 'chip' | 'recap';

export interface WarningsListProps {
  warnings: readonly ExportWarning[];
  mode: WarningsListMode;
  /** Display label for a channel id (callsign then name), for wire-name warnings that carry entityId. */
  channelLabel?: (entityId: string) => string | undefined;
  /** Shown in 'full' and 'recap' when there are no warnings at all. Default: "No warnings." */
  emptyText?: string;
  testId?: string;
}

function accordionControlLabel(title: string, count: number): string {
  return `${title} (${count})`;
}

function shorteningLine(
  item: WireNameShortening,
  channelLabel?: (entityId: string) => string | undefined,
): string {
  let original = item.original;
  if (item.entityId && channelLabel) {
  // Wire-name preview shows the exported string; here we show callsign then name when we know the channel id.
    const label = channelLabel(item.entityId);
    if (label) original = label;
  }
  if (item.isCollision) {
    return `"${original}" → "${item.exported}" (collision)`;
  }
  if (item.stillExceedsLimit && item.exported === item.original) {
    return `"${original}"`;
  }
  if (item.stillExceedsLimit) {
    return `"${original}" → "${item.exported}" (still too long)`;
  }
  return `"${original}" → "${item.exported}"`;
}

function ShortenedGroupPanel({
  group,
  channelLabel,
}: {
  group: WireNameShorteningGroup;
  channelLabel?: (entityId: string) => string | undefined;
}) {
  return (
    <Stack gap={4}>
      <Text size="sm">{wireNameShorteningIntro(group)}</Text>
      <List size="sm" spacing={2} withPadding>
        {group.items.map((item, index) => (
          <List.Item key={`${item.original}-${item.exported}-${index}`}>
            <Text span size="sm" ff="monospace">
              {shorteningLine(item, channelLabel)}
            </Text>
          </List.Item>
        ))}
      </List>
    </Stack>
  );
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

function notesSummaryLine(
  formatted: ReturnType<typeof formatExportWarnings>,
  infoCount: number,
): string {
  const shortenCount = formatted.shortenedInfoGroups.reduce((n, g) => n + g.items.length, 0);
  if (
    formatted.generalInfo.length === 0 &&
    formatted.shortenedInfoGroups.length > 0 &&
    shortenCount === infoCount
  ) {
    return `${shortenCount} names shortened cleanly`;
  }
  return `${infoCount} notes`;
}

function ProblemGroups({
  formatted,
  channelLabel,
  inAccordion,
}: {
  formatted: ReturnType<typeof formatExportWarnings>;
  channelLabel?: (entityId: string) => string | undefined;
  inAccordion: boolean;
}) {
  const {
    general,
    unlinkedGroup,
    memberCapGroups,
    shortenedProblemGroups,
  } = formatted;

  const groups = (
    <Stack gap="sm">
      {general.map((warning, index) => (
        <Text key={`general-${index}`} size="sm">
          {warning}
        </Text>
      ))}
      {unlinkedGroup != null ||
      memberCapGroups.length > 0 ||
      shortenedProblemGroups.length > 0 ? (
        <Accordion multiple variant="separated" defaultValue={inAccordion ? [] : undefined}>
          {unlinkedGroup != null ? (
            <Accordion.Item value="unlinked">
              <Accordion.Control>
                {accordionControlLabel(unlinkedGroup.title, unlinkedGroup.items.length)}
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap={4}>
                  {unlinkedGroup.items.map((warning, index) => (
                    <Text key={`unlinked-${index}`} size="sm">
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
          {shortenedProblemGroups.map((group) => {
            const value = `shortened-problem-${group.entityKind}-${group.maxLen}-${group.profileLabel ?? ''}`;
            return (
              <Accordion.Item key={value} value={value}>
                <Accordion.Control>
                  {accordionControlLabel(group.title, group.items.length)}
                </Accordion.Control>
                <Accordion.Panel>
                  <ShortenedGroupPanel group={group} channelLabel={channelLabel} />
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      ) : null}
    </Stack>
  );

  if (inAccordion) return groups;

  return (
    <Alert color="yellow" title="Export warnings">
      {groups}
    </Alert>
  );
}

function NotesSection({
  formatted,
  infoCount,
  channelLabel,
}: {
  formatted: ReturnType<typeof formatExportWarnings>;
  infoCount: number;
  channelLabel?: (entityId: string) => string | undefined;
}) {
  const { generalInfo, shortenedInfoGroups } = formatted;
  if (infoCount === 0) return null;

  const summary = notesSummaryLine(formatted, infoCount);

  return (
    <Accordion multiple variant="separated" defaultValue={[]} data-testid="warnings-list-notes">
      <Accordion.Item value="notes">
        <Accordion.Control c="dimmed">{summary}</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="sm">
            {generalInfo.map((note, index) => (
              <Text key={`note-${index}`} size="sm">
                {note}
              </Text>
            ))}
            {shortenedInfoGroups.map((group) => {
              const value = `shortened-info-${group.entityKind}-${group.maxLen}-${group.profileLabel ?? ''}`;
              return (
                <Stack key={value} gap={4}>
                  <Text size="sm" fw={500}>
                    {accordionControlLabel(group.title, group.items.length)}
                  </Text>
                  <ShortenedGroupPanel group={group} channelLabel={channelLabel} />
                </Stack>
              );
            })}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

function chipSummary(warnings: readonly ExportWarning[]): string {
  const { problems, info } = summariseExportWarnings(warnings);
  if (problems === 0 && info === 0) return 'No warnings.';
  if (problems === 0) return `${info} notes, no problems`;
  return `${problems} problems · ${info} notes`;
}

function hasProblems(formatted: ReturnType<typeof formatExportWarnings>): boolean {
  return (
    formatted.general.length > 0 ||
    formatted.unlinkedGroup != null ||
    formatted.memberCapGroups.length > 0 ||
    formatted.shortenedProblemGroups.length > 0
  );
}

export default function WarningsList({
  warnings,
  mode,
  channelLabel,
  emptyText = 'No warnings.',
  testId = 'warnings-list',
}: WarningsListProps) {
  const formatted = formatExportWarnings([...warnings]);
  const { problems, info } = summariseExportWarnings(warnings);

  if (mode === 'chip') {
    return (
      <Text className={classes.chip} data-testid={testId}>
        {chipSummary(warnings)}
      </Text>
    );
  }

  if (mode === 'problems') {
    if (!hasProblems(formatted)) return null;
    return (
      <Stack gap="sm" data-testid={testId}>
        <ProblemGroups formatted={formatted} channelLabel={channelLabel} inAccordion={false} />
      </Stack>
    );
  }

  if (warnings.length === 0) {
    return (
      <Text size="sm" c="dimmed" data-testid={testId}>
        {emptyText}
      </Text>
    );
  }

  if (mode === 'recap') {
    return (
      <Stack gap="xs" data-testid={testId}>
        <Text className={classes.recapSummary}>{chipSummary(warnings)}</Text>
        <Accordion variant="separated" defaultValue={[]}>
          <Accordion.Item value="details">
            <Accordion.Control>Details</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                {hasProblems(formatted) ? (
                  <ProblemGroups
                    formatted={formatted}
                    channelLabel={channelLabel}
                    inAccordion
                  />
                ) : null}
                <NotesSection formatted={formatted} infoCount={info} channelLabel={channelLabel} />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    );
  }

  // full
  return (
    <Stack gap="sm" data-testid={testId}>
      {hasProblems(formatted) ? (
        <ProblemGroups formatted={formatted} channelLabel={channelLabel} inAccordion={false} />
      ) : null}
      <NotesSection formatted={formatted} infoCount={info} channelLabel={channelLabel} />
    </Stack>
  );
}