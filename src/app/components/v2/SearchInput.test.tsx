import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import SearchInput from './SearchInput.tsx';

describe('SearchInput', () => {
  it('renders detected tag pill', () => {
    render(
      <DesignSystemV2Provider>
        <SearchInput value="" detectedTag="DMR" />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('DMR')).toBeInTheDocument();
  });
});
