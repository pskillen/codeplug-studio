import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import ExportWarningsAlert from './ExportWarningsAlert.tsx';

function renderAlert(warnings: string[]) {
  return render(
    <MantineProvider>
      <ExportWarningsAlert warnings={warnings} />
    </MantineProvider>,
  );
}

describe('ExportWarningsAlert', () => {
  it('folds unlinked and shortened groups collapsed by default with counts', () => {
    renderAlert([
      'Including 19 channel(s) not linked to a zone',
      'Including 7 talk group(s) not referenced by a channel',
      'Channel wire name "Aberdeen Approach" exceeds 16 characters for Anytone AT-D890UV; exported as "Aber Approach"',
      'Channel wire name "Edinburgh Approach" exceeds 16 characters for Anytone AT-D890UV; exported as "Edinb Approach"',
      'Talk group wire name "Australia, New Zealand" exceeds 16 characters for Anytone AT-D890UV; exported as "Aus+NZ"',
    ]);

    expect(screen.getByText('Export warnings')).toBeInTheDocument();

    const unlinked = screen.getByRole('button', { name: /Export unlinked items \(2\)/ });
    const channels = screen.getByRole('button', { name: /Channel names shortened \(2\)/ });
    const talkGroups = screen.getByRole('button', { name: /Talk group names shortened \(1\)/ });

    expect(unlinked).toHaveAttribute('aria-expanded', 'false');
    expect(channels).toHaveAttribute('aria-expanded', 'false');
    expect(talkGroups).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(channels);
    expect(channels).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/"Aberdeen Approach" → "Aber Approach"/)).toBeInTheDocument();
    expect(screen.getByText(/"Edinburgh Approach" → "Edinb Approach"/)).toBeInTheDocument();
  });

  it('keeps non-group general warnings visible without an accordion', () => {
    renderAlert(['Build exceeded profile channel cap']);

    expect(screen.getByText('Build exceeded profile channel cap')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('expands unlinked items on click', () => {
    renderAlert([
      'Including 19 channel(s) not linked to a zone',
      'Including 22304 digital contact(s) not referenced by a channel',
    ]);

    const unlinked = screen.getByRole('button', { name: /Export unlinked items \(2\)/ });
    expect(unlinked).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(unlinked);
    expect(unlinked).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Including 19 channel\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/Including 22304 digital contact\(s\)/)).toBeInTheDocument();
  });
});
