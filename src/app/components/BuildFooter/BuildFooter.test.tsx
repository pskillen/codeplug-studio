import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { DEVELOPER_MODE_KEY } from '@integrations/preferences/developerMode.ts';
import BuildFooter from './BuildFooter.tsx';
import DeveloperModeBadge from '../DeveloperModeBadge/DeveloperModeBadge.tsx';

function renderFooter() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <DeveloperModeBadge />
        <BuildFooter />
      </MemoryRouter>
    </MantineProvider>,
  );
}

function tapVersion(times: number) {
  const version = screen.getByTestId('build-version');
  for (let i = 0; i < times; i += 1) fireEvent.click(version);
}

describe('BuildFooter developer-mode gesture', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('turns developer mode on with five taps and says so', () => {
    renderFooter();
    tapVersion(5);
    expect(localStorage.getItem(DEVELOPER_MODE_KEY)).toBe('on');
    expect(screen.getByRole('status')).toHaveTextContent('Developer mode is on');
  });

  it('starts a fresh gesture after the chip turns developer mode off', () => {
    renderFooter();
    tapVersion(5);
    tapVersion(5);
    fireEvent.click(screen.getByRole('button', { name: 'Turn off developer mode' }));
    tapVersion(1);
    expect(localStorage.getItem(DEVELOPER_MODE_KEY)).toBeNull();
    tapVersion(4);
    expect(localStorage.getItem(DEVELOPER_MODE_KEY)).toBe('on');
  });

  it('does not claim developer mode is on when storage refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    renderFooter();
    tapVersion(5);
    expect(localStorage.getItem(DEVELOPER_MODE_KEY)).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Developer mode could not be turned on: this browser blocks storage',
    );
  });

  it('leaves developer mode on after five taps while it is on, pointing at the top bar', () => {
    localStorage.setItem(DEVELOPER_MODE_KEY, 'on');
    renderFooter();
    tapVersion(5);
    expect(localStorage.getItem(DEVELOPER_MODE_KEY)).toBe('on');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Developer mode is on. Turn it off from the top bar',
    );
    tapVersion(5);
    expect(localStorage.getItem(DEVELOPER_MODE_KEY)).toBe('on');
  });
});
