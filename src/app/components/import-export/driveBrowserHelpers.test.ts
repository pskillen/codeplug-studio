import { describe, expect, it } from 'vitest';
import { APP_ROOT_FOLDER_NAME, DRIVE_ROOT_FOLDER_ID } from '@integrations/cloud/index.ts';
import {
  appendFolderToPath,
  findYamlFileByName,
  formatBrowsePathLabel,
  pathUpToIndex,
  resolveInitialBrowseState,
} from './driveBrowserHelpers.ts';

describe('driveBrowserHelpers', () => {
  it('resolveInitialBrowseState prefers interchange folder', () => {
    expect(
      resolveInitialBrowseState({
        interchangeFolderId: 'folder-a',
        lastFolderId: 'folder-b',
        lastFolderPath: [{ id: 'folder-b', name: 'Backups' }],
        appRootFolderId: 'app-root',
      }),
    ).toEqual({
      folderId: 'folder-a',
      path: [{ id: 'folder-b', name: 'Backups' }],
    });
  });

  it('resolveInitialBrowseState defaults to the app-owned root folder', () => {
    expect(
      resolveInitialBrowseState({
        appRootFolderId: 'app-root',
      }),
    ).toEqual({
      folderId: 'app-root',
      path: [{ id: 'app-root', name: APP_ROOT_FOLDER_NAME }],
    });
  });

  it('resolveInitialBrowseState falls back to DRIVE_ROOT_FOLDER_ID when unresolved', () => {
    expect(
      resolveInitialBrowseState({
        appRootFolderId: null,
      }),
    ).toEqual({
      folderId: DRIVE_ROOT_FOLDER_ID,
      path: [{ id: DRIVE_ROOT_FOLDER_ID, name: APP_ROOT_FOLDER_NAME }],
    });
  });

  it('appendFolderToPath and pathUpToIndex navigate breadcrumbs', () => {
    const root = [{ id: 'root', name: 'My Drive' }];
    const deeper = appendFolderToPath(root, { id: 'f1', name: 'Exports' });
    expect(pathUpToIndex(deeper, 0)).toEqual(root);
    expect(deeper).toHaveLength(2);
  });

  it('findYamlFileByName matches case-insensitively', () => {
    const match = findYamlFileByName(
      [
        { id: '1', name: 'Demo.YAML', kind: 'yaml' },
        { id: '2', name: 'folder', kind: 'folder' },
      ],
      'demo.yaml',
    );
    expect(match?.id).toBe('1');
  });

  it('formatBrowsePathLabel joins breadcrumb names', () => {
    expect(formatBrowsePathLabel([{ id: 'root', name: 'My Drive' }])).toBe('My Drive');
    expect(
      formatBrowsePathLabel([
        { id: 'root', name: 'My Drive' },
        { id: 'f1', name: 'Codeplugs' },
      ]),
    ).toBe('My Drive / Codeplugs');
  });

  it('formatBrowsePathLabel falls back to the app root name for an empty path', () => {
    expect(formatBrowsePathLabel([])).toBe(APP_ROOT_FOLDER_NAME);
  });
});
