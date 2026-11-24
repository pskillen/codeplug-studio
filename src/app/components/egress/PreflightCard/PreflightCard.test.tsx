import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import PreflightCard from './PreflightCard.tsx';

describe('PreflightCard', () => {
  it('shows the serial in full', () => {
    render(
      <MantineProvider>
        <PreflightCard
          status="passed"
          rows={[{ label: 'Serial', value: 'D890UV2401234567', status: 'ok' }]}
        />
      </MantineProvider>,
    );
    expect(screen.getByTestId('preflight-serial')).toHaveTextContent('D890UV2401234567');
  });

  it('shows the refused badge', () => {
    render(
      <MantineProvider>
        <PreflightCard
          status="refused"
          rows={[{ label: 'Storage', value: 'foreign', status: 'bad' }]}
        />
      </MantineProvider>,
    );
    expect(screen.getByTestId('preflight-badge')).toHaveTextContent('cannot write');
  });

  it('tags rows by status', () => {
    render(
      <MantineProvider>
        <PreflightCard
          status="passed"
          rows={[
            { label: 'Model', value: 'DM-32UV', status: 'ok' },
            { label: 'Serial', value: 'not read', status: 'warn' },
          ]}
        />
      </MantineProvider>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
    expect(screen.getByText('warn')).toBeInTheDocument();
  });
});
