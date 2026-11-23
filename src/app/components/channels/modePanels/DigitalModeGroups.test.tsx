import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DigitalModeGroups from './DigitalModeGroups.tsx';

describe('DigitalModeGroups', () => {
  it('renders Access, Call, Listen, You headings in order', () => {
    render(
      <DigitalModeGroups
        access={<span>access field</span>}
        call={<span>call field</span>}
        listen={{ note: 'listen note' }}
        you={{ note: '' }}
      />,
    );
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Access', 'Call', 'Listen', 'You']);
  });

  it('exposes each group with role=group named by its heading', () => {
    render(
      <DigitalModeGroups
        access={<span>access field</span>}
        call={<span>call field</span>}
        listen={{ note: 'listen note' }}
        you={{ note: '' }}
      />,
    );
    expect(screen.getByRole('group', { name: 'Access' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Call' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Listen' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'You' })).toBeInTheDocument();
  });

  it('renders a note paragraph for { note: string }', () => {
    render(
      <DigitalModeGroups
        access={{ note: 'Muted line.' }}
        call={<span>x</span>}
        listen={<span>y</span>}
        you={<span>z</span>}
      />,
    );
    expect(screen.getByText('Muted line.')).toBeInTheDocument();
  });

  it('renders heading only for { note: "" }', () => {
    render(
      <DigitalModeGroups
        access={<span>field</span>}
        call={{ note: '' }}
        listen={<span>y</span>}
        you={<span>z</span>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Call' })).toBeInTheDocument();
    const callGroup = screen.getByRole('group', { name: 'Call' });
    expect(callGroup.querySelector('p')).toBeNull();
  });
});