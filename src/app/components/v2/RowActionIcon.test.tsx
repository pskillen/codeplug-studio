import { IconTrash } from '@tabler/icons-react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import RowActionIcon from './RowActionIcon.tsx';

describe('RowActionIcon', () => {
  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <DesignSystemV2Provider>
        <RowActionIcon icon={<IconTrash />} onClick={onClick} label="Delete" />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stops propagation so a parent row-activate handler does not fire', () => {
    const onClick = vi.fn();
    const onRowActivate = vi.fn();
    render(
      <DesignSystemV2Provider>
        <div onClick={onRowActivate} onKeyDown={onRowActivate} role="button" tabIndex={0}>
          <RowActionIcon icon={<IconTrash />} onClick={onClick} label="Delete" />
        </div>
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onRowActivate).not.toHaveBeenCalled();
  });

  it('disables the button when disabled', () => {
    render(
      <DesignSystemV2Provider>
        <RowActionIcon icon={<IconTrash />} onClick={() => undefined} label="Delete" disabled />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
