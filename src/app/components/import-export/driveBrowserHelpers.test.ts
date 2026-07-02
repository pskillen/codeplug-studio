import { describe, expect, it } from 'vitest';
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
      }),
    ).toEqual({
      folderId: 'folder-a',
      path: [{ id: 'folder-b', name: 'Backups' }],
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
});
