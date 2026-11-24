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
      <WarningsList
        warnings={warnings}
        mode="full"
        channelLabel={() => 'GB3XX — Glasgow North'}
      />,
    );
    fireEvent.click(screen.getByText('1 names shortened cleanly'));
    expect(screen.getByText(/GB3XX — Glasgow North/)).toBeTruthy();
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