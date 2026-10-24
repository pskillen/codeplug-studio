import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { OPENAIP_API_KEY_GUIDE } from '../../lib/credentialGuides.tsx';
import { DesignSystemV2Provider } from '../v2/index.ts';
import CredentialMissingNotice from './CredentialMissingNotice.tsx';

describe('CredentialMissingNotice', () => {
  it('explains what is needed and links to Settings and the provider', () => {
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <CredentialMissingNotice guide={OPENAIP_API_KEY_GUIDE} action="Searching OpenAIP" />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    expect(
      screen.getByText('Searching OpenAIP needs your own OpenAIP API key.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Free with an OpenAIP account/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set it up in Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.getByRole('link', { name: 'go to OpenAIP' })).toHaveAttribute(
      'href',
      'https://www.openaip.net/',
    );
  });
});
