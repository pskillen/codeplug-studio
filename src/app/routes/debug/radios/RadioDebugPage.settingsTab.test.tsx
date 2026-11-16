import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import RadioDebugPage from './RadioDebugPage.tsx';
import { radioDebugDescriptors, radioDebugTabs } from './descriptors.ts';

function open(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/debug/radios/${slug}`]}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

const WITH_SETTINGS = [
  'at-d890uv',
  'dm-32uv',
  'dm-1701-opengd77',
  'md-9600-opengd77',
  'rt95',
  'uv-5r-mini',
];
const WITHOUT_SETTINGS = ['uv-21-pro-v2', 'dm-32uv-radiofoundry'];

afterEach(cleanup);

describe('descriptor-driven tab list', () => {
  it('puts Settings straight after Memory only when the descriptor has one', () => {
    expect(radioDebugTabs({ settings: undefined })).toEqual([
      'Overview',
      'Backup',
      'Calibration',
      'Memory',
      'Hex',
      'Compare',
      'Trace',
    ]);
    expect(
      radioDebugTabs({
        settings: () => ({ status: { kind: 'ok' }, summary: '', intro: '', groups: [] }),
      }),
    ).toEqual([
      'Overview',
      'Backup',
      'Calibration',
      'Memory',
      'Settings',
      'Hex',
      'Compare',
      'Trace',
    ]);
  });

  it('gives Settings to the decoded radios and not to the rest', () => {
    const slugs = radioDebugDescriptors.filter((d) => d.settings).map((d) => d.slug);
    expect(slugs.sort()).toEqual([...WITH_SETTINGS].sort());
    for (const slug of WITHOUT_SETTINGS)
      expect(radioDebugDescriptors.find((d) => d.slug === slug)?.settings).toBeUndefined();
  });

  it('gives every radio with a capture its own Memory viewer', () => {
    for (const d of radioDebugDescriptors.filter((item) => item.capture))
      expect(d.Memory, d.slug).toBeDefined();
  });
});

describe('Settings tab on the radio page', () => {
  it.each(WITH_SETTINGS)('%s shows Settings after Memory and asks for a capture', (slug) => {
    open(slug);
    const names = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(names.indexOf('Settings')).toBe(names.indexOf('Memory') + 1);
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.getByText('Open or read a capture to inspect its settings.')).toBeInTheDocument();
  });

  it.each(WITHOUT_SETTINGS)('%s has no Settings tab', (slug) => {
    open(slug);
    expect(screen.queryByRole('tab', { name: 'Settings' })).toBeNull();
  });
});
