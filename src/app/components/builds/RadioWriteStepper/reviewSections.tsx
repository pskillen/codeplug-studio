/**
 * Review step sections (#1393, workflow design §2.4). `reviewSectionsFor` returns the generic
 * sections every radio gets (identity, channels, contacts, keps, time) followed by whatever
 * per-radio providers registered for that descriptor. PR 4c registers the D890's (range,
 * receive-only channels, settings, backup).
 */

import { Fragment, type ReactNode } from 'react';
import { Text } from '@mantine/core';
import type { RadioDescriptor } from '@integrations/radio-io/types.ts';
import { IdentitySection, Section, TimeSection } from './reviewSectionParts.tsx';
import type { AtD890ReviewController } from './d890/atD890ReviewController.ts';
import type { RadioIdentityView } from './types.ts';
import type { WriteParts } from './writeParts.ts';

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
  /** AT-D890UV only: this Review's range, receive-only channels and live choices. */
  atD890?: AtD890ReviewController;
  /** RT95 MM9PDY only: the memory check passed, and what the MMD1 table will hold. */
  rt95?: { zones: number; descriptions: number };
}

export interface ReviewSectionProvider {
  /** Which radios this provider applies to. */
  matches(descriptor: RadioDescriptor): boolean;
  /** Extra rows for the "This radio" block, after Firmware. */
  identityRows?(ctx: ReviewContext): [string, string][];
  /** Extra content under the Channels line (warnings, lists). */
  channelNotes?(ctx: ReviewContext): ReactNode[];
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
export function genericReviewSections(
  ctx: ReviewContext,
  hooks: {
    identityRows?: [string, string][];
    channelNotes?: ReactNode[];
  } = {},
): ReactNode[] {
  const out: ReactNode[] = [
    <IdentitySection key="identity" identity={ctx.identity} extraRows={hooks.identityRows} />,
  ];
  if (ctx.parts.codeplug) {
    out.push(
      <Section key="channels" title="Channels">
        <Text size="sm">
          {ctx.channelCount === 1
            ? '1 channel will be written.'
            : `${ctx.channelCount} channels will be written.`}
        </Text>
        {hooks.channelNotes?.map((n, i) => (
          <Fragment key={i}>{n}</Fragment>
        ))}
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
  const active = providers.filter((p) => p.matches(descriptor));
  const extra = active.flatMap((p) => p.sections(ctx, descriptor));
  return [
    ...genericReviewSections(ctx, {
      identityRows: active.flatMap((p) => p.identityRows?.(ctx) ?? []),
      channelNotes: active.flatMap((p) => p.channelNotes?.(ctx) ?? []),
    }),
    ...extra.map((node, i) => <div key={`extra-${i}`}>{node}</div>),
    <TimeSection key="time" ctx={ctx} />,
  ];
}
