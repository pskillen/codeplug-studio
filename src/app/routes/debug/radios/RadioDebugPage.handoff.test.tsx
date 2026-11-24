import { debugOpenPort, DebugWrongFirmwareError } from '@integrations/radio-io/debugHandoff.ts';
import { OPENGD77_DEBUG_RADIOFOUNDRY_FOUND } from '@integrations/radio-io/radios/opengd77/debugText.ts';
import {
  RADIOFOUNDRY_DEBUG_NO_ANSWER,
  RADIOFOUNDRY_DEBUG_OPENGD77_FOUND,
} from '@integrations/radio-io/radios/radiofoundry/debugText.ts';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import RadioDebugPage from './RadioDebugPage.tsx';
import { debugRadioPath, radioDebugDescriptors } from './descriptors.ts';

const fake = vi.hoisted(() => ({
  openGd77: vi.fn(),
  radioFoundry: vi.fn(),
}));

vi.mock('./opengd77Capture.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./opengd77Capture.ts')>()),
  captureOpenGd77: () => fake.openGd77,
}));
vi.mock('./radioFoundryCapture.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./radioFoundryCapture.ts')>()),
  captureRadioFoundry: () => fake.radioFoundry,
}));

function shell(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio/:firmware" element={<RadioDebugPage />} />
          <Route path="/debug" element={<div>All debug tools</div>} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

function openPath(slug: string) {
  return debugRadioPath(radioDebugDescriptors.find((d) => d.slug === slug)!)!;
}

function makePort(baud = 115_200) {
  const pipe = { close: vi.fn(async () => {}) };
  return debugOpenPort(pipe as never, 'web-serial', baud);
}

beforeEach(() => {
  fake.openGd77.mockReset();
  fake.radioFoundry.mockReset();
  fake.radioFoundry.mockResolvedValue({} as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('wrong-firmware handoff', () => {
  it('OpenGD77 read shows RadioFoundry notice and switches with the same port', async () => {
    const port = makePort();
    fake.openGd77.mockRejectedValue(
      new DebugWrongFirmwareError('radiofoundry', OPENGD77_DEBUG_RADIOFOUNDRY_FOUND, port),
    );
    shell(openPath('md-9600-opengd77'));
    fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await screen.findByTestId('wrong-firmware-notice');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Read radio' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Switch to RadioFoundry and read/ }));
    await waitFor(() => expect(fake.radioFoundry).toHaveBeenCalled(), { timeout: 5_000 });
    expect(fake.radioFoundry.mock.calls[0]![0].port).toBe(port);
  });

  it('RadioFoundry read can hand off to OpenGD77 with the port', async () => {
    const port = makePort();
    fake.radioFoundry.mockRejectedValueOnce(
      new DebugWrongFirmwareError('opengd77', RADIOFOUNDRY_DEBUG_OPENGD77_FOUND, port),
    );
    fake.openGd77.mockResolvedValue({} as never);
    shell(openPath('md-9600-radiofoundry'));
    fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await screen.findByTestId('wrong-firmware-notice');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Read radio' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Switch to OpenGD77 and read/ }));
    await waitFor(() => expect(fake.openGd77).toHaveBeenCalledTimes(1), { timeout: 5_000 });
    expect(fake.openGd77.mock.calls[0]![0].port).toBe(port);
  });

  it('stop and close calls port.close once', async () => {
    const port = makePort();
    fake.openGd77.mockRejectedValue(
      new DebugWrongFirmwareError('radiofoundry', OPENGD77_DEBUG_RADIOFOUNDRY_FOUND, port),
    );
    shell(openPath('md-9600-opengd77'));
    fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await screen.findByTestId('wrong-firmware-notice');
    fireEvent.click(screen.getByRole('button', { name: 'Stop and close the port' }));
    await waitFor(() =>
      expect(screen.queryByTestId('wrong-firmware-notice')).not.toBeInTheDocument(),
    );
    expect(port.pipe.close).toHaveBeenCalledTimes(1);
  });

  it('counts down and closes the port after 60 s unused', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const port = makePort();
    fake.openGd77.mockRejectedValue(
      new DebugWrongFirmwareError('radiofoundry', OPENGD77_DEBUG_RADIOFOUNDRY_FOUND, port),
    );
    shell(openPath('md-9600-opengd77'));
    fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await screen.findByTestId('wrong-firmware-notice');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText(/Closing in 5\d s/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await waitFor(() => expect(port.pipe.close).toHaveBeenCalled());
    expect(screen.getByText(/The port was closed/)).toBeInTheDocument();
  });

  it('DM-32UV unknown answer offers stock switch only', async () => {
    fake.radioFoundry.mockRejectedValue(
      new DebugWrongFirmwareError('unknown', RADIOFOUNDRY_DEBUG_NO_ANSWER),
    );
    shell(openPath('dm-32uv-radiofoundry'));
    fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await screen.findByTestId('wrong-firmware-notice');
    fireEvent.click(screen.getByRole('button', { name: /Switch to Stock/ }));
    await waitFor(() =>
      expect(screen.queryByTestId('wrong-firmware-notice')).not.toBeInTheDocument(),
    );
    expect(fake.radioFoundry).toHaveBeenCalledTimes(1);
    expect(fake.openGd77).not.toHaveBeenCalled();
  });

  it('refuses a port at the wrong baud', async () => {
    fake.openGd77.mockImplementation(async (opts) => {
      if (opts?.port && opts.port.baudRate !== 115_200) {
        await opts.port.close();
        throw new Error(
          'The open port runs at 9600 baud; this radio needs 115200. Read radio again.',
        );
      }
      return {} as never;
    });
    const port = makePort(9_600);
    fake.radioFoundry.mockRejectedValueOnce(
      new DebugWrongFirmwareError('opengd77', RADIOFOUNDRY_DEBUG_OPENGD77_FOUND, port),
    );
    shell(openPath('md-9600-radiofoundry'));
    fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await screen.findByTestId('wrong-firmware-notice');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Read radio' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Switch to OpenGD77 and read/ }));
    await waitFor(() =>
      expect(screen.getByText(/The open port runs at 9600 baud/)).toBeInTheDocument(),
    );
    expect(port.pipe.close).toHaveBeenCalled();
  });
});
