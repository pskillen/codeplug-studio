import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UV5RMINI_UNOFFICIAL_STOCK_COPIES } from '@core/radios/baofeng/uv-5r-mini/firmware.ts';
import { getFirmwareUpdater } from '@integrations/radio-io';

import { DesignSystemV2Provider } from '../../../components/v2/index.ts';
import { INITIAL_FIRMWARE_WIZARD_STATE } from '../firmwareWizardState.ts';
import StockStep, { STOCK_ONE_OF_HEADING, STOCK_PER_VERSION_COPY } from './StockStep.tsx';

const MINI = getFirmwareUpdater('baofeng-uv5rmini')!;

function renderMini() {
  render(
    <DesignSystemV2Provider>
      <StockStep state={INITIAL_FIRMWARE_WIZARD_STATE} dispatch={vi.fn()} updater={MINI} />
    </DesignSystemV2Provider>,
  );
  return screen.getByRole('list', { name: 'Where to get the stock firmware' });
}

describe('StockStep, UV-5R Mini', () => {
  afterEach(() => vi.restoreAllMocks());

  it("offers the user's own copy, then links each unofficial third-party copy by its file name", () => {
    const list = renderMini();
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(
      "Your own copy: If you already have the stock file for your radio's firmware, drop it below.",
    );
    expect(items[0]).toHaveTextContent('Studio checks it against the pinned hash');
    UV5RMINI_UNOFFICIAL_STOCK_COPIES.copies.forEach((c, i) => {
      const item = items[i + 1]!;
      expect(item).toHaveTextContent(
        `Unofficial copy shared by a third party, stock ${c.version}: ${c.fileName} from mega.nz.`,
      );
      expect(item).toHaveTextContent('Studio only links to it and never downloads it for you');
      expect(item).toHaveTextContent(
        'Unofficial, not run by the vendor. Studio checks every file against the pinned hashes before using it.',
      );
      const link = within(item).getByRole('link', { name: c.fileName });
      expect(link).toHaveAttribute('href', c.url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
    expect(list).not.toHaveTextContent(/read of your radio/);
  });

  it('names v0.27 (NRF) first among the files it needs', () => {
    renderMini();
    expect(
      screen.getByText('Drop stock-nrf-v0.27.ufw or stock-nrfb-v0.04.ufw'),
    ).toBeInTheDocument();
  });

  it('says it needs one stock file, the one for the radio, not both', () => {
    renderMini();
    expect(screen.getByText(STOCK_ONE_OF_HEADING)).toBeInTheDocument();
    expect(screen.queryByText('Files Studio needs:')).toBeNull();
    expect(screen.getByText(STOCK_PER_VERSION_COPY, { exact: false })).toBeInTheDocument();
    const files = screen.getByText(STOCK_ONE_OF_HEADING).parentElement!;
    expect(files).toHaveTextContent(
      'stock-nrf-v0.27.ufw (504,832 bytes): for stock firmware v0.27 (NRF)',
    );
    expect(files).toHaveTextContent(
      'stock-nrfb-v0.04.ufw (520,192 bytes): for stock firmware v0.04 (NRFB)',
    );
  });

  it('never fetches a link', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderMini();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('StockStep, RT95 head', () => {
  it('marks the unofficial mirror with the generic unofficial line', () => {
    render(
      <DesignSystemV2Provider>
        <StockStep
          state={INITIAL_FIRMWARE_WIZARD_STATE}
          dispatch={vi.fn()}
          updater={getFirmwareUpdater('retevis-rt95-head')!}
        />
      </DesignSystemV2Provider>,
    );
    const list = screen.getByRole('list', { name: 'Where to get the stock firmware' });
    const mirror = within(list)
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('47.253.5.16'));
    expect(mirror).toBeDefined();
    expect(mirror).toHaveTextContent(
      'Unofficial, not run by the vendor. Studio checks every file against the pinned hashes before using it.',
    );
    expect(within(mirror!).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('47.253.5.16'),
    );
  });
});
