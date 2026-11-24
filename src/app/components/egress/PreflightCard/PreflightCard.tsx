import { Badge, Text } from '@mantine/core';
import type { RadioPreflightIdentity, RadioPreflightRow } from '@integrations/radio-io/types.ts';
import classes from './PreflightCard.module.css';

export interface PreflightCardProps {
  status: 'checking' | 'passed' | 'refused';
  identity?: RadioPreflightIdentity;
  rows: readonly RadioPreflightRow[];
  testId?: string;
}

function badgeLabel(status: PreflightCardProps['status']): string {
  if (status === 'checking') return 'Checking…';
  if (status === 'refused') return 'Pre-flight: cannot write';
  return 'Pre-flight passed';
}

function rowBadge(status: RadioPreflightRow['status'] | undefined): string | null {
  if (status === 'ok') return 'ok';
  if (status === 'warn') return 'warn';
  if (status === 'bad') return 'bad';
  return null;
}

export default function PreflightCard({
  status,
  rows,
  testId = 'preflight-card',
}: PreflightCardProps) {
  const badgeColor = status === 'refused' ? 'red' : status === 'checking' ? 'gray' : 'green';
  return (
    <section className={classes.card} data-testid={testId} aria-label="Pre-flight">
      <div className={classes.header}>
        <Text size="sm" fw={600}>
          This radio
        </Text>
        <Badge color={badgeColor} variant="light" data-testid="preflight-badge">
          {badgeLabel(status)}
        </Badge>
      </div>
      {status === 'checking' ? (
        <Text size="sm" role="status">
          Checking the radio…
        </Text>
      ) : (
        <div className={classes.rows}>
          {rows.map((row) => {
            const tag = rowBadge(row.status);
            return <RowCells key={row.label} label={row.label} value={row.value} tag={tag} />;
          })}
        </div>
      )}
    </section>
  );
}

function RowCells({ label, value, tag }: { label: string; value: string; tag: string | null }) {
  return (
    <>
      <Text size="sm" c="dimmed" component="span">
        {label}
      </Text>
      <Text
        size="sm"
        component="span"
        data-testid={label === 'Serial' ? 'preflight-serial' : undefined}
      >
        {value}
      </Text>
      <Text
        size="xs"
        component="span"
        className={
          tag === 'ok'
            ? classes.badgeOk
            : tag === 'warn'
              ? classes.badgeWarn
              : tag === 'bad'
                ? classes.badgeBad
                : undefined
        }
      >
        {tag ?? ''}
      </Text>
    </>
  );
}
