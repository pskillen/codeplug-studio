import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ModeSection, { modeSectionStartsFolded } from './ModeSection.tsx';

function renderModeSection(props: Partial<ComponentProps<typeof ModeSection>> = {}) {
  const onMakeMain = vi.fn();
  render(
    <DesignSystemV2Provider>
      <ModeSection
        mode="dmr"
        isMain={false}
        onMakeMain={onMakeMain}
        summary="CC1 TS2"
        defaultCollapsed={false}
        {...props}
      >
        <span>Mode body</span>
      </ModeSection>
    </DesignSystemV2Provider>,
  );
  return { onMakeMain };
}

describe('modeSectionStartsFolded', () => {
  it('keeps two modes open on desktop', () => {
    expect(
      modeSectionStartsFolded({
        modeCount: 2,
        compact: false,
        isMain: false,
        addedThisEdit: false,
      }),
    ).toBe(false);
    expect(
      modeSectionStartsFolded({ modeCount: 2, compact: false, isMain: true, addedThisEdit: false }),
    ).toBe(false);
  });

  it('folds non-main when there are three or more modes', () => {
    expect(
      modeSectionStartsFolded({
        modeCount: 3,
        compact: false,
        isMain: false,
        addedThisEdit: false,
      }),
    ).toBe(true);
    expect(
      modeSectionStartsFolded({ modeCount: 3, compact: false, isMain: true, addedThisEdit: false }),
    ).toBe(false);
  });

  it('folds non-main on a compact viewport with two modes', () => {
    expect(
      modeSectionStartsFolded({ modeCount: 2, compact: true, isMain: false, addedThisEdit: false }),
    ).toBe(true);
  });

  it('starts modes added during the edit open', () => {
    expect(
      modeSectionStartsFolded({ modeCount: 3, compact: true, isMain: false, addedThisEdit: true }),
    ).toBe(false);
  });
});

describe('ModeSection', () => {
  it('shows Main mode on the main section and Make main on others', () => {
    const { unmount } = render(
      <DesignSystemV2Provider>
        <ModeSection mode="fm" isMain onMakeMain={() => undefined} summary="" defaultCollapsed>
          <span>FM</span>
        </ModeSection>
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Main mode')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make main' })).not.toBeInTheDocument();
    unmount();

    renderModeSection({ isMain: false, mode: 'dmr' });
    expect(screen.getByRole('button', { name: 'Make DMR the main mode' })).toBeInTheDocument();
    expect(screen.queryByText('Main mode')).not.toBeInTheDocument();
  });

  it('calls onMakeMain without unfolding the panel', () => {
    const { onMakeMain } = renderModeSection({
      defaultCollapsed: true,
      summary: 'CC1 TS2',
    });
    expect(screen.queryByText('Mode body')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Make DMR the main mode' }));
    expect(onMakeMain).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Mode body')).not.toBeInTheDocument();
  });

  it('shows the summary while folded, or Nothing set yet when empty', () => {
    renderModeSection({ defaultCollapsed: true, summary: 'CC1 TS2' });
    expect(screen.getByText('CC1 TS2')).toBeInTheDocument();

    render(
      <DesignSystemV2Provider>
        <ModeSection
          mode="fm"
          isMain={false}
          onMakeMain={() => undefined}
          summary=""
          defaultCollapsed
        >
          <span>Body</span>
        </ModeSection>
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Nothing set yet')).toBeInTheDocument();
  });
});
