import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignSystemV2Provider } from '../../v2/index.ts';

const native = vi.hoisted(() => ({
  keepAwake: vi.fn(async () => {}),
  allowSleep: vi.fn(async () => {}),
}));
vi.mock('@integrations/platform/isNativeApp.ts', () => ({ isNativeApp: () => true }));
vi.mock('@integrations/platform/keepAwake.ts', () => ({ KeepAwake: native }));

import RadioWriteStepper from './RadioWriteStepper.tsx';
import { demoFlowView, demoStepperConfig, noopActions } from './stepperDemo.ts';

function ui(busy: boolean) {
  return (
    <MemoryRouter>
      <DesignSystemV2Provider>
        <RadioWriteStepper
          config={demoStepperConfig()}
          view={demoFlowView({ busy })}
          actions={noopActions(() => vi.fn())}
        />
      </DesignSystemV2Provider>
    </MemoryRouter>
  );
}

describe('RadioWriteStepper keeps the screen awake', () => {
  beforeEach(() => {
    native.keepAwake.mockReset().mockResolvedValue(undefined);
    native.allowSleep.mockReset().mockResolvedValue(undefined);
  });

  it('holds the lock while a read or write is busy and releases it after', async () => {
    const { rerender, unmount } = render(ui(true));
    await waitFor(() => expect(native.keepAwake).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('keep-screen-on-hint')).toBeNull();

    rerender(ui(false));
    expect(native.allowSleep).toHaveBeenCalledTimes(1);

    rerender(ui(true));
    await waitFor(() => expect(native.keepAwake).toHaveBeenCalledTimes(2));
    unmount();
    expect(native.allowSleep).toHaveBeenCalledTimes(2);
  });

  it('shows the hint while busy when the lock cannot be taken', async () => {
    native.keepAwake.mockRejectedValueOnce(new Error('no plugin'));
    render(ui(true));
    expect(await screen.findByTestId('keep-screen-on-hint')).toHaveTextContent(
      'Keep this screen on until it finishes.',
    );
  });
});
