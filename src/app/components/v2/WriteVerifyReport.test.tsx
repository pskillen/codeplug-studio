import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import WriteVerifyReport from './WriteVerifyReport.tsx';

describe('WriteVerifyReport', () => {
  it('defaults the title to "Write & verify report"', () => {
    render(
      <DesignSystemV2Provider>
        <WriteVerifyReport rows={[]} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Write & verify report')).toBeInTheDocument();
  });

  it('renders summary stat items', () => {
    render(
      <DesignSystemV2Provider>
        <WriteVerifyReport
          rows={[]}
          summary={[
            { value: 42, label: 'Channels written', tone: 'default' },
            { value: 1, label: 'Failed', tone: 'destructive' },
          ]}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Channels written')).toBeInTheDocument();
  });

  it('renders each row as a StatusDot with a detail', () => {
    render(
      <DesignSystemV2Provider>
        <WriteVerifyReport
          rows={[
            { id: '1', tone: 'success', label: 'Channel 1', detail: 'Verified' },
            { id: '2', tone: 'destructive', label: 'Channel 2', detail: 'Rejected' },
          ]}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Channel 1')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Channel 2')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });
});
