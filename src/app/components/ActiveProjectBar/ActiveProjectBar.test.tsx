import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import ActiveProjectBar from './ActiveProjectBar.tsx';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../state/useProjects.ts', () => ({
  useProjects: () => ({
    activeProject: {
      id: 'project-1',
      projectId: 'project-1',
      name: 'Demo project',
    },
  }),
}));

describe('ActiveProjectBar', () => {
  it('calls onNavClick when Switch is clicked', () => {
    const onNavClick = vi.fn();

    render(
      <MemoryRouter>
        <MantineProvider>
          <ActiveProjectBar onNavClick={onNavClick} />
        </MantineProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));

    expect(onNavClick).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
