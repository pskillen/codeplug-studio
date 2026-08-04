import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import TextInput from './TextInput.tsx';

describe('TextInput', () => {
  it('renders label and value', () => {
    render(
      <DesignSystemV2Provider>
        <TextInput label="Name" value="Wrotham" readOnly />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByLabelText('Name')).toHaveValue('Wrotham');
  });
});
