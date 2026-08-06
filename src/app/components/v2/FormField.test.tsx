import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import FormField from './FormField.tsx';

describe('FormField', () => {
  it('renders static value', () => {
    render(
      <DesignSystemV2Provider>
        <FormField label="Name" value="Wrotham" />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Wrotham')).toBeInTheDocument();
  });

  it('shows validation error', () => {
    render(
      <DesignSystemV2Provider>
        <FormField label="TX frequency (MHz)" error="TX frequency can't be blank.">
          <span>child</span>
        </FormField>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText("TX frequency can't be blank.")).toBeInTheDocument();
  });
});
