import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import Pill from './Pill.tsx';

describe('Pill', () => {
  it('renders named tones', () => {
    const { container } = render(
      <DesignSystemV2Provider>
        <Pill tone="success">Ready</Pill>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(container.querySelector('span')?.className).toMatch(/success/);
  });

  it('applies semantic color escape hatch', () => {
    render(
      <DesignSystemV2Provider>
        <Pill tone="semantic" color="#e03131" textColor="#fff">
          DMR
        </Pill>
      </DesignSystemV2Provider>,
    );

    const pill = screen.getByText('DMR');
    expect(pill).toHaveStyle({ backgroundColor: '#e03131', color: '#fff' });
  });
});
