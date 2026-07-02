import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDriveApiClient } from './driveApi.ts';
import { DRIVE_FOLDER_MIME } from './driveTypes.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('driveApi', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists folders and yaml files in a parent', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        files: [
          { id: 'f1', name: 'Backups', mimeType: DRIVE_FOLDER_MIME },
          { id: 'y1', name: 'demo.yaml', mimeType: 'application/yaml' },
          { id: 'x1', name: 'notes.txt', mimeType: 'text/plain' },
        ],
      }),
    );
    const api = createDriveApiClient(fetchMock);
    const items = await api.listChildren('parent-1', 'token');
    expect(items).toEqual([
      { id: 'f1', name: 'Backups', kind: 'folder' },
      { id: 'y1', name: 'demo.yaml', kind: 'yaml' },
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('parent-1');
  });

  it('creates a folder', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'new-folder', name: 'Exports', mimeType: DRIVE_FOLDER_MIME }),
    );
    const api = createDriveApiClient(fetchMock);
    const folder = await api.createFolder('root', 'Exports', 'token');
    expect(folder.id).toBe('new-folder');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
  });

  it('reads file media', async () => {
    fetchMock.mockResolvedValueOnce(new Response('yaml: true', { status: 200 }));
    const api = createDriveApiClient(fetchMock);
    const text = await api.readFile('file-1', 'token');
    expect(text).toBe('yaml: true');
  });

  it('writes a new file with multipart upload', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'file-new', name: 'demo.yaml', mimeType: 'application/yaml' }),
    );
    const api = createDriveApiClient(fetchMock);
    const meta = await api.writeFile(
      { parentId: 'folder-1', fileName: 'demo.yaml', content: 'project: {}' },
      'token',
    );
    expect(meta.id).toBe('file-new');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('uploadType=multipart');
  });

  it('updates an existing file with media upload', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'file-1', name: 'demo.yaml', mimeType: 'application/yaml' }),
    );
    const api = createDriveApiClient(fetchMock);
    await api.writeFile(
      { parentId: 'folder-1', fileName: 'demo.yaml', content: 'updated', fileId: 'file-1' },
      'token',
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('file-1');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH');
  });

  it('maps auth errors', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'Invalid Credentials', status: 'UNAUTHENTICATED' } }, 401),
    );
    const api = createDriveApiClient(fetchMock);
    await expect(api.listChildren('root', 'bad')).rejects.toMatchObject({ name: 'DriveAuthError' });
  });
});
