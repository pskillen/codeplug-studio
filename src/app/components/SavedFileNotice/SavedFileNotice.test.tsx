import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createFakeNativeSave } from '@integrations/download/__fixtures__/fakeNativeSavePlugins.ts';
import { saveBlobOnDevice } from '@integrations/download/nativeSave.ts';

import SavedFileNotice from './SavedFileNotice.tsx';

describe('SavedFileNotice', () => {
  it('shows nothing until a file is saved on the device', () => {
    render(<SavedFileNotice />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says where a saved file went, and can be dismissed', async () => {
    render(<SavedFileNotice />);

    await act(() => saveBlobOnDevice(new Blob(['x']), 'flash-log.txt', createFakeNativeSave()));

    expect(screen.getByText('Saved to Documents/Codeplug Studio/flash-log.txt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('points at the share sheet when only the app cache could be written', async () => {
    render(<SavedFileNotice />);

    await act(() =>
      saveBlobOnDevice(
        new Blob(['x']),
        'reads.zip',
        createFakeNativeSave({ refuse: ['DOCUMENTS'] }),
      ),
    );

    expect(screen.getByText(/reads\.zip is ready: pick an app in the share sheet/)).toBeTruthy();
  });

  it('says when a save failed', async () => {
    render(<SavedFileNotice />);

    await act(() =>
      saveBlobOnDevice(
        new Blob(['x']),
        'reads.zip',
        createFakeNativeSave({ refuse: ['DOCUMENTS', 'CACHE'] }),
      ),
    );

    expect(screen.getByText("Couldn't save reads.zip: Permission denied: CACHE")).toBeTruthy();
  });
});
