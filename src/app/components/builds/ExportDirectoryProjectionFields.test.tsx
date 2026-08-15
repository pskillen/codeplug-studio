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

    fireEvent.click(screen.getByRole('checkbox', { name: 'Include library digital contacts' }));
    expect(onPatch).toHaveBeenCalledWith({
      cpsDualBankDirectory: {
        includeLibraryContacts: false,
        includeDigitalIdDirectory: false,
      },
    });

    onPatch.mockClear();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include digital ID directory' }));
    expect(onPatch).toHaveBeenCalledWith({
      cpsDualBankDirectory: {
        includeLibraryContacts: true,
        includeDigitalIdDirectory: true,
      },
    });
  });

  it('explains that DM-32 CPS cannot hold the RadioID directory', () => {
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
