/**
 * The components behind the Review sections (#1393): the titled section frame, the identity
 * block and the time estimate. Components only, so Fast Refresh works; the registry and the
 * section lists are in `reviewSections.tsx`.
 */

import type { ReactNode } from 'react';
import { Text } from '@mantine/core';
import { maskSerial } from './maskSerial.ts';
import classes from './RadioWriteStepper.module.css';
import type { ReviewContext } from './reviewSections.tsx';
import type { RadioIdentityView } from './types.ts';
import { formatEstimate } from './writeEstimate.ts';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={classes.section} data-testid={`review-section-${title.toLowerCase()}`}>
      <div className={classes.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

export function IdentitySection({ identity }: { identity: RadioIdentityView | null }) {
  if (!identity) return null;
  const rows: [string, string][] = [['Model', identity.model]];
  if (identity.name) rows.push(['Name', identity.name]);
  if (identity.serial) rows.push(['Serial', maskSerial(identity.serial)]);
  rows.push(['Firmware', identity.firmware ?? 'unknown']);
  return (
    <Section title="This radio">
      <dl className={classes.identityGrid} style={{ margin: 0 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt className={classes.identityKey}>{k}</dt>
            <dd style={{ margin: 0 }}>{v}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function TimeSection({ ctx }: { ctx: ReviewContext }) {
  if (ctx.identityOnly) {
    return (
      <Section title="Time">
        <Text size="sm">Studio reads the rest of the radio while writing.</Text>
      </Section>
    );
  }
  if (ctx.estimateSeconds == null) return null;
  return (
    <Section title="Time">
      <Text size="sm">
        {formatEstimate(ctx.estimateSeconds)}
        {ctx.restartsAfterWrite ? ', then the radio restarts.' : '.'}
      </Text>
    </Section>
  );
}
