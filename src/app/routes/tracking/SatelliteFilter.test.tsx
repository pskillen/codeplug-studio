import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import SatelliteFilter from './SatelliteFilter.tsx';

const OPTIONS = [
  { id: 'sat-1', name: 'ISS' },
  { id: 'sat-2', name: 'AO-91' },
  { id: 'sat-3', name: 'SO-50' },
];

describe('SatelliteFilter', () => {
  it('renders every option when the search box is empty', () => {
    render(
      <DesignSystemV2Provider>
        <SatelliteFilter options={OPTIONS} selectedIds={new Set()} onChange={vi.fn()} />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByLabelText('ISS')).toBeInTheDocument();
    expect(screen.getByLabelText('AO-91')).toBeInTheDocument();
    expect(screen.getByLabelText('SO-50')).toBeInTheDocument();
  });

  it('narrows the checkbox list by name search', () => {
    render(
      <DesignSystemV2Provider>
        <SatelliteFilter options={OPTIONS} selectedIds={new Set()} onChange={vi.fn()} />
      </DesignSystemV2Provider>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Satellites' }), {
      target: { value: 'ao' },
    });

    expect(screen.getByLabelText('AO-91')).toBeInTheDocument();
    expect(screen.queryByLabelText('ISS')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('SO-50')).not.toBeInTheDocument();
  });

  it('adds an id to the selection when its checkbox is toggled on', () => {
    const onChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <SatelliteFilter options={OPTIONS} selectedIds={new Set()} onChange={onChange} />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByLabelText('ISS'));

    expect(onChange).toHaveBeenCalledWith(new Set(['sat-1']));
  });

  it('removes an id from the selection when its checkbox is toggled off', () => {
    const onChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <SatelliteFilter
          options={OPTIONS}
          selectedIds={new Set(['sat-1', 'sat-2'])}
          onChange={onChange}
        />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByLabelText('ISS'));

    expect(onChange).toHaveBeenCalledWith(new Set(['sat-2']));
  });

  it('clears the selection via the clear-filter button', () => {
    const onChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <SatelliteFilter options={OPTIONS} selectedIds={new Set(['sat-1'])} onChange={onChange} />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /clear filter/i }));

    expect(onChange).toHaveBeenCalledWith(new Set());
  });
});
