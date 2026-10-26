/**
 * Review step sections (#1393, workflow design §2.4). `reviewSectionsFor` returns the generic
 * sections every radio gets (identity, channels, contacts, keps, time) followed by whatever
 * per-radio providers registered for that descriptor. PR 4c registers the D890's (range,
 * receive-only channels, settings, backup).
 */

import type { ReactNode } from 'react';
import { Text } from '@mantine/core';
import type { RadioDescriptor } from '@integrations/radio-io/types.ts';
import { IdentitySection, Section, TimeSection } from './reviewSectionParts.tsx';
import type { RadioIdentityView } from './types.ts';
import type { WriteParts } from './writeParts.ts';

export { maskSerial } from './maskSerial.ts';

export interface ReviewContext {
  identity: RadioIdentityView | null;
  parts: WriteParts;
  channelCount: number;
  contactsNote: string | null;
  kepsCount: number | null;
  estimateSeconds: number | null;
  /** The radio's read happens inside upload(): Review has the ident only. */
  identityOnly: boolean;
  /** The radio restarts after the write. */
  restartsAfterWrite: boolean;
}

export interface ReviewSectionProvider {
  /** Which radios this provider applies to. */
  matches(descriptor: RadioDescriptor): boolean;
  /** Extra sections, shown after the generic identity and channel sections and before time. */
  sections(ctx: ReviewContext, descriptor: RadioDescriptor): ReactNode[];
}

const providers: ReviewSectionProvider[] = [];

/** Register a per-radio provider. Returns an unregister function (tests). */
export function registerReviewSectionProvider(provider: ReviewSectionProvider): () => void {
  providers.push(provider);
  return () => {
    const i = providers.indexOf(provider);
    if (i >= 0) providers.splice(i, 1);
  };
}

/** Sections every radio gets, in order. */
export function genericReviewSections(ctx: ReviewContext): ReactNode[] {
  const out: ReactNode[] = [<IdentitySection key="identity" identity={ctx.identity} />];
  if (ctx.parts.codeplug) {
    out.push(
      <Section key="channels" title="Channels">
        <Text size="sm">
          {ctx.channelCount === 1
            ? '1 channel will be written.'
            : `${ctx.channelCount} channels will be written.`}
        </Text>
      </Section>,
    );
  }
  if (ctx.parts.contacts && ctx.contactsNote) {
    out.push(
      <Section key="contacts" title="Contacts">
        <Text size="sm">{ctx.contactsNote}</Text>
      </Section>,
    );
  }
  if (ctx.parts.keps && ctx.kepsCount != null) {
    out.push(
      <Section key="keps" title="Satellite keps">
        <Text size="sm">
          {ctx.kepsCount === 1
            ? '1 satellite will be written.'
            : `${ctx.kepsCount} satellites will be written.`}
        </Text>
      </Section>,
    );
  }
  return out;
}

/** Generic sections, then registered per-radio sections, then time. */
export function reviewSectionsFor(descriptor: RadioDescriptor, ctx: ReviewContext): ReactNode[] {
  const extra = providers
    .filter((p) => p.matches(descriptor))
    .flatMap((p) => p.sections(ctx, descriptor));
  return [
    ...genericReviewSections(ctx),
    ...extra.map((node, i) => <div key={`extra-${i}`}>{node}</div>),
    <TimeSection key="time" ctx={ctx} />,
  ];
}
