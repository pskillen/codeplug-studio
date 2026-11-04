/**
 * Digest rendering: a region too large to keep as bytes (the OpenGD77 User Database) is reported
 * with CRC digests in the table, the JSON export and the markdown debug export.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  buildWriteVerifyResult,
  formatWriteVerifyDebugMarkdown,
} from '@integrations/radio-io/writeVerifyCompare.ts';
import type {
  WriteVerifyDebugContext,
  WriteVerifyMismatch,
} from '@integrations/radio-io/writeVerify.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import WriteVerifyReport from './WriteVerifyReport.tsx';

const base = { regionId: 'user-database', regionLabel: 'User Database' } as const;
const digestMismatch: WriteVerifyMismatch = {
  kind: 'mismatch',
  address: 0x51000,
  ...base,
  expected: new Uint8Array(0),
  actual: new Uint8Array(0),
  expectedDigest: 'crc32:11111111',
  actualDigest: 'crc32:22222222',
};
const digestNotRead: WriteVerifyMismatch = {
  kind: 'not_read',
  address: 0x52000,
  ...base,
  expected: new Uint8Array(0),
  actual: null,
  expectedDigest: 'crc32:33333333',
};

const result = buildWriteVerifyResult({
  model: 'dm1701',
  elapsedMs: 10,
  totalBytesRead: 100,
  staging: { capturedAt: '2026-01-01T00:00:00Z', chunks: [] },
  mismatches: [digestMismatch, digestNotRead],
  regions: [],
  regionGroups: [],
});

const context: WriteVerifyDebugContext = {
  buildId: 'b',
  egressId: 'e',
  formatId: 'f',
  profileId: 'p',
  measuredAt: '2026-01-01T00:00:00Z',
};

describe('WriteVerifyReport digests', () => {
  afterEach(() => vi.restoreAllMocks());

  function renderReport() {
    return render(
      <DesignSystemV2Provider>
        <WriteVerifyReport
          result={result}
          debugContext={context}
          formatDebugMarkdown={formatWriteVerifyDebugMarkdown}
          onClose={() => {}}
          inModal
        />
      </DesignSystemV2Provider>,
    );
  }

  it('shows both digests in the table, and "(not read back)" for a slice that was not read', () => {
    renderReport();
    expect(screen.getByText('crc32:11111111')).toBeInTheDocument();
    expect(screen.getByText('crc32:22222222')).toBeInTheDocument();
    expect(screen.getByText('(not read back)')).toBeInTheDocument();
  });

  it('writes the digests, not empty bytes, into the JSON export', async () => {
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      blob = b as Blob;
      return 'blob:x';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderReport();
    fireEvent.click(screen.getByText('Download JSON'));
    const json = JSON.parse(await blob!.text()) as {
      staging: { mismatches: { expected: string; actual: string | null }[] };
    };
    expect(json.staging.mismatches[0]).toMatchObject({
      expected: 'crc32:11111111',
      actual: 'crc32:22222222',
    });
    expect(json.staging.mismatches[1]).toMatchObject({ expected: 'crc32:33333333', actual: null });
  });
});

describe('formatWriteVerifyDebugMarkdown digests', () => {
  it('lists expected and actual digests for a digest mismatch', () => {
    const md = formatWriteVerifyDebugMarkdown(result, context);
    expect(md).toContain('- **mismatch** @ 0x51000 (User Database)');
    expect(md).toContain('  - expected: crc32:11111111');
    expect(md).toContain('  - actual: crc32:22222222');
  });
});
