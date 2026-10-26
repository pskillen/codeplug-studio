import { describe, expect, it } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import type { RadioDescriptor } from '@integrations/radio-io/types.ts';
import {
  maskSerial,
  registerReviewSectionProvider,
  reviewSectionsFor,
  type ReviewContext,
} from './reviewSections.tsx';
import {
  NOMINAL_BYTES_PER_SECOND,
  estimateWriteSeconds,
  formatEstimate,
  measuredThroughput,
} from './writeEstimate.ts';

function render(ui: ReactElement) {
  return rtlRender(<DesignSystemV2Provider>{ui}</DesignSystemV2Provider>);
}

const descriptor = { modelIds: ['X'], label: 'X' } as unknown as RadioDescriptor;

const ctx: ReviewContext = {
  identity: { model: 'AT-D890UV', serial: 'SN123456789' },
  parts: { codeplug: true, contacts: false, settings: false, keps: false },
  channelCount: 412,
  contactsNote: null,
  kepsCount: null,
  estimateSeconds: 100,
  identityOnly: false,
  restartsAfterWrite: true,
};

describe('reviewSectionsFor', () => {
  it('gives identity, channels and time for a radio with no extras', () => {
    render(<>{reviewSectionsFor(descriptor, ctx)}</>);
    expect(screen.getByText('AT-D890UV')).toBeInTheDocument();
    expect(screen.getByText('…6789')).toBeInTheDocument();
    expect(screen.getByText('412 channels will be written.')).toBeInTheDocument();
    expect(screen.getByText('About 1 min 40 s, then the radio restarts.')).toBeInTheDocument();
  });

  it('says so when the radio reads inside the write', () => {
    render(<>{reviewSectionsFor(descriptor, { ...ctx, identityOnly: true })}</>);
    expect(
      screen.getByText('Studio reads the rest of the radio while writing.'),
    ).toBeInTheDocument();
  });

  it('adds sections from a registered provider', () => {
    const off = registerReviewSectionProvider({
      matches: (d) => d.modelIds.includes('X'),
      sections: () => [<p key="r">Range: Amateur Europe</p>],
    });
    render(<>{reviewSectionsFor(descriptor, ctx)}</>);
    expect(screen.getByText('Range: Amateur Europe')).toBeInTheDocument();
    off();
  });

  it('omits the channels section when the codeplug is not ticked', () => {
    render(
      <>
        {reviewSectionsFor(descriptor, {
          ...ctx,
          parts: { codeplug: false, contacts: false, settings: false, keps: true },
          kepsCount: 24,
        })}
      </>,
    );
    expect(screen.queryByText(/channels will be written/)).toBeNull();
    expect(screen.getByText('24 satellites will be written.')).toBeInTheDocument();
  });
});

describe('maskSerial', () => {
  it('shows only the last four', () => {
    expect(maskSerial('SN123456789')).toBe('…6789');
    expect(maskSerial('12')).toBe('…12');
  });
});

describe('write estimate', () => {
  const plan = [{ label: 'Upload', weight: 40000 }];
  it('uses the measured throughput when there is one', () => {
    expect(measuredThroughput([{ label: 'Read', weight: 20000 }], 10_000)).toBe(2000);
    expect(estimateWriteSeconds(plan, 2000)).toBe(20);
  });
  it('falls back to the nominal rate for a missing or too-short read', () => {
    expect(measuredThroughput(undefined, 10_000)).toBeNull();
    expect(measuredThroughput([{ label: 'Read', weight: 20000 }], 200)).toBeNull();
    expect(estimateWriteSeconds(plan, null)).toBe(40000 / NOMINAL_BYTES_PER_SECOND);
  });
  it('is null without a weighted plan', () => {
    expect(estimateWriteSeconds(undefined, 1000)).toBeNull();
    expect(estimateWriteSeconds([{ label: 'x', weight: 0 }], 1000)).toBeNull();
  });
  it('formats', () => {
    expect(formatEstimate(4)).toBe('Under 10 s');
    expect(formatEstimate(37)).toBe('About 35 s');
    expect(formatEstimate(100)).toBe('About 1 min 40 s');
    expect(formatEstimate(120)).toBe('About 2 min');
  });
});
