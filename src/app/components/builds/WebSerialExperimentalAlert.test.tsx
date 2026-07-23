import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WebSerialExperimentalAlert, {
  WEB_SERIAL_EXPERIMENTAL_TITLE,
} from './WebSerialExperimentalAlert.tsx';

describe('WebSerialExperimentalAlert', () => {
  it('states experimental risk and points operators at established CPS', () => {
    render(
      <MantineProvider>
        <WebSerialExperimentalAlert />
      </MantineProvider>,
    );

    expect(screen.getByText(WEB_SERIAL_EXPERIMENTAL_TITLE)).toBeInTheDocument();
    expect(screen.getByText(/under active development/i)).toBeInTheDocument();
    expect(screen.getByText(/riskier than established/i)).toBeInTheDocument();
    expect(screen.getByText(/known-good backup/i)).toBeInTheDocument();
    expect(screen.getByText(/CHIRP/)).toBeInTheDocument();
    expect(screen.getByText(/NeonPlug/)).toBeInTheDocument();
  });
});
