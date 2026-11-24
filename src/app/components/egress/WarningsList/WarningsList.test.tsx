import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { pushKepsExcludedWarning } from '@core/import-export/exportWarning.ts';
import WarningsList from './WarningsList.tsx';

function wrap(ui: ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function cleanShorten(i: number): ExportWarning {
  return {
    kind: 'wire_name',
    severity: 'info',
    remediation: 'shortened',
    entityKind: 'Channel',
    original: `Name ${i}`,
    exported: `N${i}`,
    limit: 16,
  };
}

function unlinked(message: string): ExportWarning {
  return { kind: 'unlinked', severity: 'problem', message };
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

describe('WarningsList', () => {
  it('full shows problems open with counts and folds clean shortens behind one line', () => {
    const warnings: ExportWarning[] = [
      {
        kind: 'wire_name',
        severity: 'problem',
        remediation: 'truncated',
        entityKind: 'Channel',
        original: 'Long',
        exported: 'Lon',
        limit: 16,
      },
      cleanShorten(1),
      cleanShorten(2),
    ];
    wrap(<WarningsList warnings={warnings} mode="full" />);
    expect(screen.getByText('Export warnings')).toBeTruthy();
    expect(screen.getByText('2 names shortened cleanly')).toBeTruthy();
    fireEvent.click(screen.getByText('2 names shortened cleanly'));
    expect(screen.getByText('Channel names shortened (2)')).toBeTruthy();
  });

  it('problems mode renders nothing when there are only notes', () => {
    wrap(<WarningsList warnings={[cleanShorten(1)]} mode="problems" testId="problems-only" />);
    expect(screen.queryByTestId('problems-only')).toBeNull();
  });

  it('chip mode counts problems and notes', () => {
    wrap(
      <WarningsList
        warnings={[
          {
            kind: 'wire_name',
            severity: 'problem',
            remediation: 'truncated',
            entityKind: 'Channel',
            original: 'A',
            exported: 'B',
            limit: 16,
          },
          cleanShorten(1),
        ]}
        mode="chip"
      />,
    );
    expect(screen.getByText('1 problems · 1 notes')).toBeTruthy();
  });

  it('recap folds everything under one line', () => {
    wrap(<WarningsList warnings={[cleanShorten(1)]} mode="recap" />);
    expect(screen.getByText('1 notes, no problems')).toBeTruthy();
    expect(screen.getByText('Details')).toBeTruthy();
  });

  it('a channel with an entityId shows callsign then name on the original side', () => {
    const warnings: ExportWarning[] = [
      {
        kind: 'wire_name',
        severity: 'info',
        remediation: 'shortened',
        entityKind: 'Channel',
        original: 'Wire Only',
        exported: 'Short',
        limit: 16,
        entityId: 'ch-1',
      },
    ];
    wrap(
      <WarningsList warnings={warnings} mode="full" channelLabel={() => 'GB3XX — Glasgow North'} />,
    );
    fireEvent.click(screen.getByText('1 names shortened cleanly'));
    expect(screen.getByText(/GB3XX — Glasgow North/)).toBeTruthy();
  });

  it('folds unlinked problems in the yellow alert and clean shortens in the info section', () => {
    const warnings: ExportWarning[] = [
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
    ];
    wrap(<WarningsList warnings={warnings} mode="full" />);

    expect(screen.getByText('Export warnings')).toBeTruthy();
    const unlinkedControl = screen.getByRole('button', { name: /Export unlinked items \(2\)/ });
    expect(unlinkedControl).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('warnings-list-notes')).toBeInTheDocument();
    fireEvent.click(screen.getByText('3 names shortened cleanly'));
    expect(screen.getByText(/"Aberdeen Approach" → "Aber Approach"/)).toBeTruthy();
  });

  it('renders clean shortens as info only — no Export warnings alert', () => {
    wrap(
      <WarningsList
        warnings={[
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
        ]}
        mode="full"
      />,
    );

    expect(screen.queryByText('Export warnings')).toBeNull();
    expect(screen.getByTestId('warnings-list-notes')).toBeTruthy();
    fireEvent.click(screen.getByText('2 names shortened cleanly'));
    expect(screen.getByText(/"Aberdeen Approach" → "Aber Approach"/)).toBeTruthy();
  });

  it('renders both sections when clean and still-too-long shortens mix', () => {
    wrap(
      <WarningsList
        warnings={[
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
        ]}
        mode="full"
      />,
    );

    expect(screen.getByText('Export warnings')).toBeTruthy();
    expect(screen.getByTestId('warnings-list-notes')).toBeTruthy();
    const problemChannels = screen.getByRole('button', { name: /Channel names shortened \(1\)/ });
    fireEvent.click(problemChannels);
    expect(screen.getByText(/still too long/)).toBeTruthy();
    fireEvent.click(screen.getByText('1 names shortened cleanly'));
    expect(screen.getByText(/"Aberdeen Approach" → "Aber Approach"/)).toBeTruthy();
  });

  it('keeps non-group general warnings visible without an accordion', () => {
    wrap(
      <WarningsList
        warnings={[
          {
            kind: 'general',
            severity: 'problem',
            message: 'Build exceeded profile channel cap',
          },
        ]}
        mode="full"
      />,
    );

    expect(screen.getByText('Export warnings')).toBeTruthy();
    expect(screen.getByText('Build exceeded profile channel cap')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('warnings-list-notes')).toBeNull();
  });

  it('expands unlinked problem groups in full mode', () => {
    const warnings: ExportWarning[] = [
      {
        kind: 'unlinked',
        severity: 'problem',
        message: 'Including 19 channel(s) not linked to a zone',
      },
    ];
    wrap(<WarningsList warnings={warnings} mode="full" />);
    const unlinked = screen.getByRole('button', { name: /Export unlinked items \(1\)/ });
    expect(unlinked).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(unlinked);
    expect(unlinked).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Including 19 channel\(s\)/)).toBeInTheDocument();
  });

  it('expands unlinked items on click', () => {
    wrap(
      <WarningsList
        warnings={[
          unlinked('Including 19 channel(s) not linked to a zone'),
          unlinked('Including 22304 digital contact(s) not referenced by a channel'),
        ]}
        mode="full"
      />,
    );

    const unlinkedControl = screen.getByRole('button', { name: /Export unlinked items \(2\)/ });
    expect(unlinkedControl).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(unlinkedControl);
    expect(unlinkedControl).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Including 19 channel\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/Including 22304 digital contact\(s\)/)).toBeInTheDocument();
  });

  it('keps_excluded is a folded note', () => {
    const warnings: ExportWarning[] = [];
    pushKepsExcludedWarning(warnings, {
      satelliteId: 'AO-91',
      transmitterId: null,
      reason: 'wrong mode',
    });
    wrap(<WarningsList warnings={warnings} mode="full" />);
    expect(screen.getByText('1 notes')).toBeTruthy();
    fireEvent.click(screen.getByText('1 notes'));
    expect(screen.getByText('Skipped AO-91: wrong mode')).toBeTruthy();
  });
});
