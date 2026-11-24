import { debugOpenPort, DebugWrongFirmwareError } from '@integrations/radio-io/debugHandoff.ts';
import { OPENGD77_DEBUG_RADIOFOUNDRY_FOUND } from '@integrations/radio-io/radios/opengd77/debugText.ts';
import { MantineProvider } from '@mantine/core';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WrongFirmwareNotice } from './WrongFirmwareNotice.tsx';

const noopCapture = () => Promise.resolve({} as never);
const noop = () => {};

function shell(ui: ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('WrongFirmwareNotice', () => {
  it('sets minWidth 0 on the Alert body for narrow layouts', () => {
    const port = debugOpenPort({ close: async () => {} } as never, 'web-serial', 115_200);
    shell(
      <WrongFirmwareNotice
        error={new DebugWrongFirmwareError('radiofoundry', OPENGD77_DEBUG_RADIOFOUNDRY_FOUND, port)}
        target={{ firmware: 'radiofoundry', capture: noopCapture }}
        portOpen
        secondsLeft={42}
        onSwitchAndRead={noop}
        onSwitchOnly={noop}
        onClose={noop}
      />,
    );
    const notice = screen.getByTestId('wrong-firmware-notice');
    const body = notice.querySelector('.mantine-Alert-body');
    expect(body).not.toBeNull();
    expect(body).toHaveStyle({ minWidth: '0px' });
  });

  it('does not repeat “Nothing was read.” on the open-port line', () => {
    const port = debugOpenPort({ close: async () => {} } as never, 'web-serial', 115_200);
    shell(
      <WrongFirmwareNotice
        error={new DebugWrongFirmwareError('radiofoundry', OPENGD77_DEBUG_RADIOFOUNDRY_FOUND, port)}
        target={{ firmware: 'radiofoundry', capture: noopCapture }}
        portOpen
        secondsLeft={42}
        onSwitchAndRead={noop}
        onSwitchOnly={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText(/The port is still open/)).toBeInTheDocument();
    const nothingWasRead = screen.getAllByText(/Nothing was read/);
    expect(nothingWasRead).toHaveLength(1);
  });
});
