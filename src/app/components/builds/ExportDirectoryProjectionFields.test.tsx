import { MantineProvider } from '@mantine/core';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import ExportDirectoryProjectionFields from './ExportDirectoryProjectionFields.tsx';

describe('ExportDirectoryProjectionFields', () => {
  it('patches dual-bank toggles from checkbox clicks without reading a null currentTarget', () => {
    const { build } = newRadioBuildForProfile('project-1', 'opengd77-1701');
    const onPatch = vi.fn();
    render(
      <MantineProvider>
        <ExportDirectoryProjectionFields
          build={build}
          formatId="opengd77"
          profileId="opengd77-1701"
          saving={false}
          onPatch={onPatch}
        />
      </MantineProvider>,
    );

    expect(screen.getByText(/OpenGD77 CPS has no User Database file/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Include contacts' }));
    expect(onPatch).toHaveBeenCalledWith({
      cpsDualBankDirectory: {
        includeLibraryContacts: false,
        includeDigitalIdDirectory: false,
      },
    });

    onPatch.mockClear();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include ID directory' }));
    expect(onPatch).toHaveBeenCalledWith({
      cpsDualBankDirectory: {
        includeLibraryContacts: true,
        includeDigitalIdDirectory: true,
      },
    });
  });

  it('explains that DM-32 CPS cannot hold the ID directory', () => {
    const { build } = newRadioBuildForProfile('project-1', 'dm32-baofeng-dm32uv');
    render(
      <MantineProvider>
        <ExportDirectoryProjectionFields
          build={build}
          formatId="dm32"
          profileId="dm32-baofeng-dm32uv"
          saving={false}
          onPatch={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(screen.getByText(/does not add rows to that file or DMR-ID.csv/)).toBeInTheDocument();
  });
});

describe('ExportDirectoryProjectionFields — Anytone dual-bank (#1433)', () => {
  it('renders the two checkboxes and the ID database note, with no select', () => {
    const { build } = newRadioBuildForProfile('project-1', 'anytone-at-d890uv');
    render(
      <MantineProvider>
        <ExportDirectoryProjectionFields
          build={build}
          formatId="anytone"
          profileId="anytone-at-d890uv"
          saving={false}
          onPatch={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(
      screen.getByText(/Contacts always go to DMRTalkGroups.CSV as private calls/),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Include contacts' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Include ID directory' })).not.toBeChecked();
    expect(screen.queryByRole('textbox', { name: 'Digital contact projection' })).toBeNull();
  });

  it('shows a legacy single-bank merge setting as both ticked', () => {
    const { build } = newRadioBuildForProfile('project-1', 'anytone-at-d890uv');
    render(
      <MantineProvider>
        <ExportDirectoryProjectionFields
          build={{ ...build, exportSettings: { cpsSingleBankProjectionMode: 'merge' } }}
          formatId="anytone"
          profileId="anytone-at-d890uv"
          saving={false}
          onPatch={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(screen.getByRole('checkbox', { name: 'Include contacts' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Include ID directory' })).toBeChecked();
  });

  it('offers the ID database field choice on the AT-D890UV only, defaulting to essentials', () => {
    const d890 = newRadioBuildForProfile('project-1', 'radio-io-at-d890uv').build;
    const onPatch = vi.fn();
    const { unmount } = render(
      <MantineProvider>
        <ExportDirectoryProjectionFields
          build={{ ...d890, radioTargetId: 'anytone-at-d890uv' }}
          formatId="radio-io"
          profileId="radio-io-at-d890uv"
          saving={false}
          onPatch={onPatch}
        />
      </MantineProvider>,
    );
    expect(screen.getByRole('radio', { name: 'Name, callsign and city' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'All fields' }));
    expect(onPatch).toHaveBeenCalledWith({ idDatabaseFields: 'all' });
    unmount();

    const gd77 = newRadioBuildForProfile('project-1', 'opengd77-1701').build;
    render(
      <MantineProvider>
        <ExportDirectoryProjectionFields
          build={gd77}
          formatId="opengd77"
          profileId="opengd77-1701"
          saving={false}
          onPatch={onPatch}
        />
      </MantineProvider>,
    );
    expect(screen.queryByText('ID database fields')).not.toBeInTheDocument();
  });

  it('hides the ID database field choice when the egress is a CPS file, not Web Serial', () => {
    const { build } = newRadioBuildForProfile('project-1', 'anytone-at-d890uv');
    render(
      <MantineProvider>
        <ExportDirectoryProjectionFields
          build={{ ...build, radioTargetId: 'anytone-at-d890uv' }}
          formatId="anytone"
          profileId="anytone-at-d890uv"
          saving={false}
          onPatch={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(screen.getByRole('checkbox', { name: 'Include contacts' })).toBeInTheDocument();
    expect(screen.queryByText('ID database fields')).not.toBeInTheDocument();
  });
});
