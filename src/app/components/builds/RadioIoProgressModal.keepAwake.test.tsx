import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DesignSystemV2Provider } from '../v2/index.ts';

const native = vi.hoisted(() => ({
  keepAwake: vi.fn(async () => {}),
  allowSleep: vi.fn(async () => {}),
}));
vi.mock('@integrations/platform/isNativeApp.ts', () => ({ isNativeApp: () => true }));
vi.mock('@integrations/platform/keepAwake.ts', () => ({ KeepAwake: native }));

import RadioIoProgressModal from './RadioIoProgressModal.tsx';

function ui(phase: 'transfer' | 'done', opened = true) {
  return (
    <MantineProvider>
      <DesignSystemV2Provider>
        <RadioIoProgressModal
          opened={opened}
          operation="restore"
          phase={phase}
          progress={null}
          onCancel={vi.fn()}
        />
      </DesignSystemV2Provider>
    </MantineProvider>
  );
}

describe('RadioIoProgressModal keeps the screen awake', () => {
  beforeEach(() => {
    native.keepAwake.mockReset().mockResolvedValue(undefined);
    native.allowSleep.mockReset().mockResolvedValue(undefined);
  });

  it('holds the lock while the job runs and releases it when it finishes', async () => {
    const { rerender } = render(ui('transfer'));
    await waitFor(() => expect(native.keepAwake).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('keep-screen-on-hint')).toBeNull();

    rerender(ui('done'));
    expect(native.allowSleep).toHaveBeenCalledTimes(1);
  });

  it('releases when the modal closes (cancel or failure) and on unmount', async () => {
    const { rerender, unmount } = render(ui('transfer'));
    await waitFor(() => expect(native.keepAwake).toHaveBeenCalled());
    rerender(ui('transfer', false));
    expect(native.allowSleep).toHaveBeenCalledTimes(1);

    rerender(ui('transfer'));
    await waitFor(() => expect(native.keepAwake).toHaveBeenCalledTimes(2));
    unmount();
    expect(native.allowSleep).toHaveBeenCalledTimes(2);
  });

  it('shows the hint while running when the lock cannot be taken', async () => {
    native.keepAwake.mockRejectedValueOnce(new Error('no plugin'));
    render(ui('transfer'));
    expect(await screen.findByText('Keep this screen on until it finishes.')).toBeInTheDocument();
  });
});
