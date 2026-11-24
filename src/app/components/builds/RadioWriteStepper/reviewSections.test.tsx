import { describe, expect, it } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import type { RadioDescriptor } from '@integrations/radio-io/types.ts';
import {
  registerReviewSectionProvider,
  reviewPauseReasons,
  reviewSectionsFor,
  type ReviewContext,
} from './reviewSections.tsx';
import { IdentitySection } from './reviewSectionParts.tsx';
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

describe('reviewPauseReasons (#1638)', () => {
  it('has no reason for a radio whose Review shows only facts', () => {
    expect(reviewPauseReasons(descriptor, ctx)).toEqual([]);
  });

  it('a build problem pauses Review', () => {
    const warnings: ExportWarning[] = [
      { kind: 'general', severity: 'problem', message: 'truncated name' },
    ];
    expect(reviewPauseReasons(descriptor, { ...ctx, buildWarnings: warnings })).toContain(
      'build-problems',
    );
  });

  it('notes alone never pause Review', () => {
    const warnings: ExportWarning[] = [
      {
        kind: 'wire_name',
        severity: 'info',
        remediation: 'shortened',
        entityKind: 'Channel',
        original: 'A',
        exported: 'B',
        limit: 16,
      },
    ];
    expect(reviewPauseReasons(descriptor, { ...ctx, buildWarnings: warnings })).toEqual([]);
  });

  it('a radio finding that is a problem pauses Review', () => {
    const warnings: ExportWarning[] = [
      { kind: 'general', severity: 'problem', message: 'NXDN not written' },
    ];
    expect(reviewPauseReasons(descriptor, { ...ctx, radioWarnings: warnings })).toContain(
      'radio-findings',
    );
  });

  it('Review lists Build problems and From the radio', () => {
    const buildWarnings: ExportWarning[] = [
      { kind: 'general', severity: 'problem', message: 'build issue' },
    ];
    const radioWarnings: ExportWarning[] = [
      { kind: 'general', severity: 'problem', message: 'radio issue' },
    ];
    const d = { ...descriptor, programHoldSafeMs: 5000 } as RadioDescriptor;
    render(
      <>
        {reviewSectionsFor(d, {
          ...ctx,
          buildWarnings,
          radioWarnings,
        })}
      </>,
    );
    expect(screen.getByText('Build problems')).toBeInTheDocument();
    expect(screen.getByText('From the radio')).toBeInTheDocument();
    expect(screen.getByText('build issue')).toBeInTheDocument();
    expect(screen.getByText('radio issue')).toBeInTheDocument();
  });

  it('Review states the re-read for a radio with a finite program hold', () => {
    const d = { ...descriptor, programHoldSafeMs: 1500 } as RadioDescriptor;
    render(<>{reviewSectionsFor(d, ctx)}</>);
    expect(
      screen.getByText(
        /Studio reads the radio again before writing if this screen stays open longer than 1\.5 s\./,
      ),
    ).toBeInTheDocument();
  });

  it('collects the reasons of matching providers only, once each', () => {
    const offA = registerReviewSectionProvider({
      matches: (d) => d.modelIds.includes('X'),
      sections: () => [],
      pauseReasons: () => ['settings-choice', 'receive-only-channels'],
    });
    const offB = registerReviewSectionProvider({
      matches: (d) => d.modelIds.includes('X'),
      sections: () => [],
      pauseReasons: () => ['settings-choice'],
    });
    const offOther = registerReviewSectionProvider({
      matches: (d) => d.modelIds.includes('Y'),
      sections: () => [],
      pauseReasons: () => ['zone-key-nudge'],
    });
    expect(reviewPauseReasons(descriptor, ctx)).toEqual([
      'settings-choice',
      'receive-only-channels',
    ]);
    offA();
    offB();
    offOther();
  });
});

describe('reviewPauseReasons fails closed (#1638)', () => {
  it('pauses for a provider with no pauseReasons that renders a section', () => {
    const off = registerReviewSectionProvider({
      matches: (d) => d.modelIds.includes('X'),
      sections: () => [<div key="w">A warning</div>],
    });
    expect(reviewPauseReasons(descriptor, ctx)).toEqual(['unclassified-sections']);
    off();
  });

  it('does not pause for a provider with no pauseReasons and nothing to render', () => {
    const off = registerReviewSectionProvider({
      matches: (d) => d.modelIds.includes('X'),
      sections: () => [null, false],
    });
    expect(reviewPauseReasons(descriptor, ctx)).toEqual([]);
    off();
  });
});

describe('reviewSectionsFor', () => {
  it('gives identity, channels and time for a radio with no extras', () => {
    render(<>{reviewSectionsFor(descriptor, ctx)}</>);
    expect(screen.getByText('AT-D890UV')).toBeInTheDocument();
    expect(screen.getByText('SN123456789')).toBeInTheDocument();
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

describe('write estimate', () => {
  const plan = [{ label: 'Upload', weight: 40000 }];
  it('uses the measured throughput when there is one', () => {
    expect(measuredThroughput([{ label: 'Read', weight: 20000 }], 10_000)).toBe(2000);
    expect(estimateWriteSeconds(plan, 2000, 1000)).toBe(20);
  });
  it('never assumes slower than the nominal rate', () => {
    expect(estimateWriteSeconds(plan, 2000)).toBe(40000 / NOMINAL_BYTES_PER_SECOND);
    expect(estimateWriteSeconds(plan, 2000, 100_000)).toBe(0.4);
    expect(estimateWriteSeconds(plan, 200_000, 100_000)).toBe(0.2);
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

describe('IdentitySection firmware notes', () => {
  it('renders each note under Firmware', () => {
    render(
      <IdentitySection
        identity={{
          model: 'M',
          firmware: 'RadioFoundry 1a2b3c4d',
          firmwareNotes: ['One.', 'Two.'],
        }}
      />,
    );
    expect(screen.getAllByTestId('identity-firmware-note').map((n) => n.textContent)).toEqual([
      'One.',
      'Two.',
    ]);
    expect(screen.getByText('RadioFoundry 1a2b3c4d')).toBeTruthy();
  });

  it('renders the same rows as before without notes', () => {
    render(<IdentitySection identity={{ model: 'M', serial: 'SN123456789' }} />);
    expect(screen.queryAllByTestId('identity-firmware-note')).toHaveLength(0);
    expect(screen.getByText('unknown')).toBeTruthy();
    expect(screen.getByText('SN123456789')).toBeTruthy();
  });

  it('does not pause Review for notes', () => {
    expect(
      reviewPauseReasons(descriptor, {
        ...ctx,
        identity: { ...ctx.identity!, firmwareNotes: ['One.'] },
      }),
    ).toEqual([]);
  });
});
