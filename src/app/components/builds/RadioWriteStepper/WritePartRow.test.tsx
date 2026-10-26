import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import WritePartRow from './WritePartRow.tsx';

describe('WritePartRow', () => {
  it('shows options only while ticked', () => {
    const { rerender } = render(
      <WritePartRow title="Digital contacts" checked={false} onCheckedChange={vi.fn()}>
        <span>Library | RadioID</span>
      </WritePartRow>,
    );
    expect(screen.queryByText('Library | RadioID')).not.toBeInTheDocument();
    rerender(
      <WritePartRow title="Digital contacts" checked onCheckedChange={vi.fn()}>
        <span>Library | RadioID</span>
      </WritePartRow>,
    );
    expect(screen.getByText('Library | RadioID')).toBeInTheDocument();
  });

  it('reports ticks through the checkbox named after the part', () => {
    const onChange = vi.fn();
    render(
      <WritePartRow
        title="Satellite keps"
        summary="24 satellites"
        checked={false}
        onCheckedChange={onChange}
      />,
    );
    expect(screen.getByText('24 satellites')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Satellite keps' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
