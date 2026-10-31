import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '../../../v2/index.ts';
import {
  clearAllOverrides,
  overridesForWrite,
  setOverride,
} from '../../../../state/rt95RadioSettingsSession.ts';
import type { ReviewContext } from '../reviewSections.tsx';
import { rt95ReviewSections } from './Rt95ReviewSections.tsx';
import { createRt95ReviewController } from './rt95ReviewController.ts';
import { buildSyntheticRt95Image } from '@integrations/radio-io/radios/rt95/__fixtures__/syntheticImage.ts';

const BUILD = 'rt95-review-test';

function controller(over: Partial<Parameters<typeof createRt95ReviewController>[0]> = {}) {
  const image = buildSyntheticRt95Image();
  image[0x3202] = 0;
  return createRt95ReviewController({
    buildId: BUILD,
    bandlimit: 1,
    snapshot: { image, bandlimit: 1 },
    target: 'stock',
    getOverrides: () => overridesForWrite(BUILD),
    initialSettingsTicked: true,
    sameRadio: true,
    settingsOnly: false,
    initialChoice: 'apply',
    initialBackup: { status: 'none' },
    onReviewSettings: () => undefined,
    ...over,
  });
}

function renderSections(c: ReturnType<typeof controller>) {
  return render(
    <DesignSystemV2Provider>
      <div>{rt95ReviewSections({ rt95: { settings: c } } as ReviewContext)}</div>
    </DesignSystemV2Provider>,
  );
}

afterEach(() => clearAllOverrides(BUILD));

describe('RT95 Review settings', () => {
  it('lists now → after for stock and MM9PDY when overrides exist', () => {
    act(() => setOverride(BUILD, 'displayMode', 2));
    renderSections(controller());
    expect(screen.getByTestId('rt95-settings-review')).toBeTruthy();
    expect(screen.getByText(/Display Mode/)).toBeTruthy();
  });

  it('shows backup reminder copy', () => {
    renderSections(controller());
    expect(screen.getByText(/Back up the radio before changing advanced settings/)).toBeTruthy();
  });
});
