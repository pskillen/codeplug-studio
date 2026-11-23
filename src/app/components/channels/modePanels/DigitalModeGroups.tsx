import { Group, Stack } from '@mantine/core';
import { type ReactNode, isValidElement, useId } from 'react';
import classes from './ModePanels.module.css';

export type GroupContent = ReactNode | { note: string };

export interface DigitalModeGroupsProps {
  access: GroupContent;
  call: GroupContent;
  listen: GroupContent;
  you: GroupContent;
}

const GROUP_KEYS = ['access', 'call', 'listen', 'you'] as const;
const GROUP_LABELS: Record<(typeof GROUP_KEYS)[number], string> = {
  access: 'Access',
  call: 'Call',
  listen: 'Listen',
  you: 'You',
};

function isNoteContent(c: GroupContent): c is { note: string } {
  return typeof c === 'object' && c !== null && !isValidElement(c) && 'note' in c;
}

function GroupBody({ content }: { content: GroupContent }) {
  if (isNoteContent(content)) {
    if (content.note === '') {
      return null;
    }
    return <p className={classes.note}>{content.note}</p>;
  }
  return <div className={classes.groupFields}>{content}</div>;
}

export function TwoUp({
  compact,
  children,
}: {
  compact: boolean;
  children: ReactNode;
}) {
  if (compact) {
    return <Stack gap={14}>{children}</Stack>;
  }
  return <Group grow>{children}</Group>;
}

export default function DigitalModeGroups({
  access,
  call,
  listen,
  you,
}: DigitalModeGroupsProps) {
  const baseId = useId();
  const byKey: Record<(typeof GROUP_KEYS)[number], GroupContent> = {
    access,
    call,
    listen,
    you,
  };

  return (
  <>
    {GROUP_KEYS.map((key) => {
      const headingId = `${baseId}-${key}`;
      return (
        <div
          key={key}
          className={classes.group}
          role="group"
          aria-labelledby={headingId}
        >
          <h3 id={headingId} className={classes.heading}>
            {GROUP_LABELS[key]}
          </h3>
          <GroupBody content={byKey[key]} />
        </div>
      );
    })}
  </>
  );
}