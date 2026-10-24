import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MAPBOX_TOKEN_GUIDE, REPEATERBOOK_TOKEN_GUIDE } from '../../lib/credentialGuides.tsx';
import type { CredentialGuide } from '../../lib/credentialGuides.tsx';
import { DesignSystemV2Provider } from '../v2/index.ts';
import CredentialSetupField from './CredentialSetupField.tsx';

function Harness({ guide, initial = '' }: { guide: CredentialGuide; initial?: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  return (
    <DesignSystemV2Provider>
      <CredentialSetupField
        guide={guide}
        value={value}
        onChange={setValue}
        hasSavedValue={saved.length > 0}
        isDirty={value.trim() !== saved}
        onSave={() => setSaved(value.trim())}
        onClear={() => {
          setValue('');
          setSaved('');
        }}
      />
    </DesignSystemV2Provider>
  );
}

describe('CredentialSetupField', () => {
  it('shows purpose, requirement, and open setup steps when nothing is saved', () => {
    render(<Harness guide={REPEATERBOOK_TOKEN_GUIDE} />);
    expect(screen.getByText('Required for RepeaterBook')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'API Apps and Tokens' })).toHaveAttribute(
      'href',
      'https://www.repeaterbook.com/user/api_apps.php',
    );
    expect(
      screen.getByText(/How to get a RepeaterBook API token/).closest('details'),
    ).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('flags unsaved edits, then confirms the save', () => {
    render(<Harness guide={REPEATERBOOK_TOKEN_GUIDE} />);
    fireEvent.change(screen.getByLabelText(/RepeaterBook API token/), {
      target: { value: 'rbuapp_abc' },
    });
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('warns about a value that does not look like the expected token', () => {
    render(<Harness guide={MAPBOX_TOKEN_GUIDE} />);
    fireEvent.change(screen.getByLabelText(/Mapbox access token/), {
      target: { value: 'sk.secret' },
    });
    expect(screen.getByText(/This is a secret token/)).toBeInTheDocument();
  });

  it('labels optional credentials as optional and collapses steps once saved', () => {
    render(<Harness guide={MAPBOX_TOKEN_GUIDE} initial="pk.abc" />);
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
    expect(
      screen.getByText(/How to get a Mapbox access token/).closest('details'),
    ).not.toHaveAttribute('open');
  });
});
