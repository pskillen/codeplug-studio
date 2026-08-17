import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import ExportWarningsAlert from './ExportWarningsAlert.tsx';

function unlinked(message: string): ExportWarning {
  return { kind: 'unlinked', severity: 'problem', message };
}

function generalWarning(message: string): ExportWarning {
  return { kind: 'general', severity: 'problem', message };
}

function shortened(params: {
  entityKind: string;
  original: string;
  exported: string;
  limit?: number;
  profileLabel?: string;
}): ExportWarning {
  return {
    kind: 'wire_name',
    severity: 'info',
    remediation: 'shortened',
    limit: 16,
    profileLabel: 'Anytone AT-D890UV',
    ...params,
  };
}

function stillTooLong(params: {
  entityKind: string;
  original: string;
  exported: string;
  limit?: number;
  profileLabel?: string;
}): ExportWarning {
  return {
    kind: 'wire_name',
    severity: 'problem',
    remediation: 'truncated',
    limit: 16,
    profileLabel: 'Anytone AT-D890UV',
    ...params,
  };
}

function renderAlert(warnings: ExportWarning[]) {
  return render(
    <MantineProvider>
      <ExportWarningsAlert warnings={warnings} />
    </MantineProvider>,
  );
}

describe('ExportWarningsAlert', () => {
  it('folds unlinked problems in the yellow alert and clean shortens in the info section', () => {
    renderAlert([
      unlinked('Including 19 channel(s) not linked to a zone'),
      unlinked('Including 7 talk group(s) not referenced by a channel'),
      shortened({
        entityKind: 'Channel',
        original: 'Aberdeen Approach',
        exported: 'Aber Approach',
      }),
      shortened({
        entityKind: 'Channel',
        original: 'Edinburgh Approach',
        exported: 'Edinb Approach',
      }),
      shortened({
        entityKind: 'Talk group',
        original: 'Australia, New Zealand',
        exported: 'Aus+NZ',
      }),
    ]);

    expect(screen.getByText('Export warnings')).toBeInTheDocument();

    const unlinkedControl = screen.getByRole('button', { name: /Export unlinked items \(2\)/ });
    const channels = screen.getByRole('button', { name: /Channel names shortened \(2\)/ });
    const talkGroups = screen.getByRole('button', { name: /Talk group names shortened \(1\)/ });

    expect(unlinkedControl).toHaveAttribute('aria-expanded', 'false');
    expect(channels).toHaveAttribute('aria-expanded', 'false');
    expect(talkGroups).toHaveAttribute('aria-expanded', 'false');

    expect(screen.getByTestId('export-info-section')).toBeInTheDocument();

    fireEvent.click(channels);
    expect(channels).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/"Aberdeen Approach" → "Aber Approach"/)).toBeInTheDocument();
    expect(screen.getByText(/"Edinburgh Approach" → "Edinb Approach"/)).toBeInTheDocument();
  });

  it('renders clean shortens as info only — no Export warnings alert', () => {
    renderAlert([
      shortened({
        entityKind: 'Channel',
        original: 'Aberdeen Approach',
        exported: 'Aber Approach',
      }),
      shortened({
        entityKind: 'Channel',
        original: 'Edinburgh Approach',
        exported: 'Edinb Approach',
      }),
    ]);

    expect(screen.queryByText('Export warnings')).not.toBeInTheDocument();
    expect(screen.getByTestId('export-info-section')).toBeInTheDocument();

    const channels = screen.getByRole('button', { name: /Channel names shortened \(2\)/ });
    expect(channels).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(channels);
    expect(screen.getByText(/"Aberdeen Approach" → "Aber Approach"/)).toBeInTheDocument();
  });

  it('renders both sections when clean and still-too-long shortens mix', () => {
    renderAlert([
      shortened({
        entityKind: 'Channel',
        original: 'Aberdeen Approach',
        exported: 'Aber Approach',
      }),
      stillTooLong({
        entityKind: 'Channel',
        original: 'This Name Remains Far Too Long After Shortening',
        exported: 'StillTooLongNameX',
      }),
    ]);

    expect(screen.getByText('Export warnings')).toBeInTheDocument();
    const infoSection = screen.getByTestId('export-info-section');
    expect(infoSection).toBeInTheDocument();

    // Two accordion controls both match "Channel names shortened (1)" — one problem, one info
    const channelControls = screen.getAllByRole('button', {
      name: /Channel names shortened \(1\)/,
    });
    expect(channelControls).toHaveLength(2);

    const infoChannels = channelControls.find((el) => infoSection.contains(el))!;
    const problemChannels = channelControls.find((el) => el !== infoChannels)!;

    fireEvent.click(problemChannels);
    expect(screen.getByText(/still too long/)).toBeInTheDocument();

    fireEvent.click(infoChannels);
    expect(screen.getByText(/"Aberdeen Approach" → "Aber Approach"/)).toBeInTheDocument();
  });

  it('keeps non-group general warnings visible without an accordion', () => {
    renderAlert([generalWarning('Build exceeded profile channel cap')]);

    expect(screen.getByText('Export warnings')).toBeInTheDocument();
    expect(screen.getByText('Build exceeded profile channel cap')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('export-info-section')).not.toBeInTheDocument();
  });

  it('expands unlinked items on click', () => {
    renderAlert([
      unlinked('Including 19 channel(s) not linked to a zone'),
      unlinked('Including 22304 digital contact(s) not referenced by a channel'),
    ]);

    const unlinkedControl = screen.getByRole('button', { name: /Export unlinked items \(2\)/ });
    expect(unlinkedControl).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(unlinkedControl);
    expect(unlinkedControl).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Including 19 channel\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/Including 22304 digital contact\(s\)/)).toBeInTheDocument();
  });
});
