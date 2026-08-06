import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Combobox, { type ComboboxOption } from './Combobox.tsx';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';

const OPTIONS: ComboboxOption<string>[] = [
  { value: 'a', label: 'Aberdeen', sublabel: 'Scotland' },
  { value: 'b', label: 'Aberdeen Airport', sublabel: 'Scotland' },
];

describe('Combobox', () => {
  it('renders the committed chip state when value is set, with a Change link', () => {
    const onClear = vi.fn();
    render(
      <DesignSystemV2Provider>
        <Combobox
          value={{ value: 'a', label: 'Aberdeen' }}
          inputValue=""
          onInputChange={() => undefined}
          options={[]}
          onSelect={() => undefined}
          onClear={onClear}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Aberdeen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('opens the dropdown on focus with a non-empty query and calls onSelect on option click', () => {
    const onSelect = vi.fn();
    render(
      <DesignSystemV2Provider>
        <Combobox
          value={null}
          inputValue="aber"
          onInputChange={() => undefined}
          options={OPTIONS}
          onSelect={onSelect}
        />
      </DesignSystemV2Provider>,
    );
    fireEvent.focus(screen.getByRole('textbox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Aberdeen Airport'));
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1]);
  });

  it('does not show the dropdown when the query is empty', () => {
    render(
      <DesignSystemV2Provider>
        <Combobox
          value={null}
          inputValue=""
          onInputChange={() => undefined}
          options={OPTIONS}
          onSelect={() => undefined}
        />
      </DesignSystemV2Provider>,
    );
    fireEvent.focus(screen.getByRole('textbox'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows emptyMessage when there are no options', () => {
    render(
      <DesignSystemV2Provider>
        <Combobox
          value={null}
          inputValue="zzz"
          onInputChange={() => undefined}
          options={[]}
          onSelect={() => undefined}
          emptyMessage="Nothing found"
        />
      </DesignSystemV2Provider>,
    );
    fireEvent.focus(screen.getByRole('textbox'));
    expect(screen.getByText('Nothing found')).toBeInTheDocument();
  });

  it('closes the dropdown on outside click', () => {
    render(
      <DesignSystemV2Provider>
        <div>
          <Combobox
            value={null}
            inputValue="aber"
            onInputChange={() => undefined}
            options={OPTIONS}
            onSelect={() => undefined}
          />
          <button type="button">outside</button>
        </div>
      </DesignSystemV2Provider>,
    );
    fireEvent.focus(screen.getByRole('textbox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
