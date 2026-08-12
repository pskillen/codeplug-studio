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
  it('folds unlinked problems in the yellow alert and clean shortens in the info section', () => {
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

    expect(screen.getByTestId('export-info-section')).toBeInTheDocument();

    fireEvent.click(channels);
    expect(channels).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/"Aberdeen Approach" → "Aber Approach"/)).toBeInTheDocument();
    expect(screen.getByText(/"Edinburgh Approach" → "Edinb Approach"/)).toBeInTheDocument();
  });

  it('renders clean shortens as info only — no Export warnings alert', () => {
    renderAlert([
      'Channel wire name "Aberdeen Approach" exceeds 16 characters for Anytone AT-D890UV; exported as "Aber Approach"',
      'Channel wire name "Edinburgh Approach" exceeds 16 characters for Anytone AT-D890UV; exported as "Edinb Approach"',
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
      'Channel wire name "Aberdeen Approach" exceeds 16 characters for Anytone AT-D890UV; exported as "Aber Approach"',
      'Channel wire name "This Name Remains Far Too Long After Shortening" exceeds 16 characters for Anytone AT-D890UV; shortened to "StillTooLongNameX" still exceeds limit',
    ]);

    expect(screen.getByText('Export warnings')).toBeInTheDocument();
    const infoSection = screen.getByTestId('export-info-section');
    expect(infoSection).toBeInTheDocument();

    // Two accordion controls both match "Channel names shortened (1)" — one problem, one info
    const channelControls = screen.getAllByRole('button', { name: /Channel names shortened \(1\)/ });
    expect(channelControls).toHaveLength(2);

    const infoChannels = channelControls.find((el) => infoSection.contains(el))!;
    const problemChannels = channelControls.find((el) => el !== infoChannels)!;

    fireEvent.click(problemChannels);
    expect(screen.getByText(/still too long/)).toBeInTheDocument();

    fireEvent.click(infoChannels);
    expect(screen.getByText(/"Aberdeen Approach" → "Aber Approach"/)).toBeInTheDocument();
  });

  it('keeps non-group general warnings visible without an accordion', () => {
    renderAlert(['Build exceeded profile channel cap']);

    expect(screen.getByText('Export warnings')).toBeInTheDocument();
    expect(screen.getByText('Build exceeded profile channel cap')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('export-info-section')).not.toBeInTheDocument();
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
