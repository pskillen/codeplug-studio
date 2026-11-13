/**
 * Review step sections (#1393, workflow design §2.4). `reviewSectionsFor` returns the generic
 * sections every radio gets (identity, channels, contacts, keps, time) followed by whatever
 * per-radio providers registered for that descriptor. PR 4c registers the D890's (range,
 * receive-only channels, settings, backup).
 *
 * `reviewPauseReasons` says whether Review needs the user at all (#1638): the generic sections are
 * facts only, so only a provider can ask for the pause, for each warning, refusal or choice its
 * sections show. No reason: the stepper writes straight after the read.
 */

import { Fragment, type ReactNode } from 'react';
import { Text } from '@mantine/core';
import type { RadioDescriptor } from '@integrations/radio-io/types.ts';
import { IdentitySection, Section, TimeSection } from './reviewSectionParts.tsx';
import type { AtD890ReviewController } from './d890/atD890ReviewController.ts';
import type { Rt95ReviewController } from './rt95/rt95ReviewController.ts';
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
  /** RT95: optional settings Review controller and/or MM9PDY mod-data summary. */
  rt95?: {
    settings?: Rt95ReviewController;
    modData?: { zones: number; descriptions: number; zoneKey?: { group: number; key: number } };
  };
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
  /**
   * Why Review must stop for the user (#1638): one reason per warning, refusal or choice this
   * provider's sections or notes would show. A provider without it that renders any section
   * makes Review pause (fail closed), so it is never skipped unseen.
   */
  pauseReasons?(ctx: ReviewContext): ReviewPauseReason[];
}

/**
 * Something on Review the user must act on (#1638). Facts (identity, counts, time, the settings
 * the user chose, an offer such as Save backup) are not reasons.
 */
export type ReviewPauseReason =
  /** Write would send nothing (settings alone with Keep, or no override left). */
  | 'nothing-to-write'
  /** AT-D890UV: channels the radio's range makes receive-only. */
  | 'receive-only-channels'
  /** AT-D890UV: Master Id is on, so per-channel IDs have no effect. */
  | 'master-id-on'
  /** AT-D890UV MM9PDY: P1/P2 are not the step keys and the user has not chosen for them. */
  | 'step-keys-nudge'
  /** AT-D890UV: the settings to apply include a language this radio's region forbids. */
  | 'settings-blocked'
  /** AT-D890UV: the radio will switch repeater mode off at start-up. */
  | 'repeater-mode-caution'
  /** AT-D890UV, RT95: not the radio the settings were read from: Apply or Keep. */
  | 'settings-choice'
  /** RT95: an advanced setting (password, remote stun/kill) changes and no backup is held. */
  | 'advanced-settings-no-backup'
  /** RT95 MM9PDY: zones are written but no key opens the zone selector. */
  | 'zone-key-nudge'
  /** A provider with no `pauseReasons` rendered sections: shown rather than skipped unseen. */
  | 'unclassified-sections';

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

/**
 * Every reason Review must stop for the user, from the providers that match this radio. Empty: the
 * Write goes straight from the read to the first frame, in the same session.
 */
export function reviewPauseReasons(
  descriptor: RadioDescriptor,
  ctx: ReviewContext,
): ReviewPauseReason[] {
  const reasons = providers
    .filter((p) => p.matches(descriptor))
    .flatMap((p) => {
      if (p.pauseReasons) return p.pauseReasons(ctx);
      // Fail closed: no declared reasons but something to show means the user must see it.
      const shows = p.sections(ctx, descriptor).some((n) => n != null && n !== false);
      return shows ? (['unclassified-sections'] as ReviewPauseReason[]) : [];
    });
  return [...new Set(reasons)];
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
