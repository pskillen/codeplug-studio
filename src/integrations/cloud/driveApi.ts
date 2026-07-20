import {
  DRIVE_FOLDER_MIME,
  DriveAuthError,
  DriveNameConflictError,
  DriveNetworkError,
  DriveScopeError,
  type DriveFileMetadata,
  type DriveListItem,
} from './driveTypes.ts';

export interface DriveApiClient {
  listChildren(parentId: string, accessToken: string): Promise<DriveListItem[]>;
  createFolder(parentId: string, name: string, accessToken: string): Promise<DriveFileMetadata>;
  readFile(fileId: string, accessToken: string): Promise<string>;
  writeFile(
    params: { parentId: string; fileName: string; content: string; fileId?: string },
    accessToken: string,
  ): Promise<DriveFileMetadata>;
  writeBinaryFile(
    params: {
      parentId: string;
      fileName: string;
      content: Uint8Array;
      mimeType?: string;
      fileId?: string;
    },
    accessToken: string,
  ): Promise<DriveFileMetadata>;
  getFileMetadata(fileId: string, accessToken: string): Promise<DriveFileMetadata>;
  getUserEmail(accessToken: string): Promise<string>;
}

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

function isYamlName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.yaml') || lower.endsWith('.yml');
}

function isZipName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.zip') || lower.endsWith('.neonplug');
}

function buildMultipartBinaryBody(
  boundary: string,
  metadata: string,
  mimeType: string,
  content: Uint8Array,
): Blob {
  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const closing = encoder.encode(`\r\n--${boundary}--\r\n`);
  const fileBytes = new Uint8Array(content);
  return new Blob([preamble, fileBytes, closing]);
}

async function parseDriveError(response: Response): Promise<never> {
  let detail = '';
  try {
    const body = (await response.json()) as { error?: { message?: string; status?: string } };
    detail = body.error?.message ?? '';
    if (response.status === 401 || body.error?.status === 'UNAUTHENTICATED') {
      throw new DriveAuthError(detail || undefined);
    }
    if (response.status === 403) {
      throw new DriveScopeError(detail || undefined);
    }
    if (response.status === 409) {
      throw new DriveNameConflictError(detail || undefined);
    }
  } catch (err) {
    if (
      err instanceof DriveAuthError ||
      err instanceof DriveScopeError ||
      err instanceof DriveNameConflictError
    ) {
      throw err;
    }
  }
  throw new DriveNetworkError(detail || `Drive API error ${response.status}`);
}

async function driveFetch(
  fetchImpl: typeof fetch,
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    const response = await fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      await parseDriveError(response);
    }
    return response;
  } catch (err) {
    if (
      err instanceof DriveAuthError ||
      err instanceof DriveScopeError ||
      err instanceof DriveNameConflictError
    ) {
      throw err;
    }
    throw new DriveNetworkError(err instanceof Error ? err.message : undefined);
  }
}

interface DriveFilesListResponse {
  files?: Array<{ id?: string; name?: string; mimeType?: string; modifiedTime?: string }>;
}

function mapListItem(file: {
  id?: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
}): DriveListItem | null {
  if (!file.id || !file.name) return null;
  if (file.mimeType === DRIVE_FOLDER_MIME) {
    return { id: file.id, name: file.name, kind: 'folder', modifiedTime: file.modifiedTime };
  }
  if (isYamlName(file.name)) {
    return { id: file.id, name: file.name, kind: 'yaml', modifiedTime: file.modifiedTime };
  }
  if (isZipName(file.name)) {
    return { id: file.id, name: file.name, kind: 'zip', modifiedTime: file.modifiedTime };
  }
  return null;
}

export function createDriveApiClient(fetchImpl: typeof fetch = fetch): DriveApiClient {
  return {
    async listChildren(parentId, accessToken) {
      const query = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
      const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime)');
      const url = `${DRIVE_API_BASE}/files?q=${query}&fields=${fields}&orderBy=folder,name`;
      const response = await driveFetch(fetchImpl, url, accessToken);
      const body = (await response.json()) as DriveFilesListResponse;
      return (body.files ?? [])
        .map(mapListItem)
        .filter((entry): entry is DriveListItem => entry !== null);
    },

    async createFolder(parentId, name, accessToken) {
      const response = await driveFetch(fetchImpl, `${DRIVE_API_BASE}/files`, accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          mimeType: DRIVE_FOLDER_MIME,
          parents: [parentId],
        }),
      });
      const body = (await response.json()) as DriveFileMetadata;
      return body;
    },

    async readFile(fileId, accessToken) {
      const response = await driveFetch(
        fetchImpl,
        `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`,
        accessToken,
      );
      return response.text();
    },

    async writeFile({ parentId, fileName, content, fileId }, accessToken) {
      if (fileId) {
        const response = await driveFetch(
          fetchImpl,
          `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
          accessToken,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/yaml' },
            body: content,
          },
        );
        const body = (await response.json()) as DriveFileMetadata;
        return { ...body, name: body.name ?? fileName };
      }

      const boundary = `codeplug_${Date.now()}`;
      const metadata = JSON.stringify({
        name: fileName,
        parents: [parentId],
        mimeType: 'application/yaml',
      });
      const multipartBody = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        metadata,
        `--${boundary}`,
        'Content-Type: application/yaml',
        '',
        content,
        `--${boundary}--`,
        '',
      ].join('\r\n');

      const response = await driveFetch(
        fetchImpl,
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        accessToken,
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: multipartBody,
        },
      );
      return (await response.json()) as DriveFileMetadata;
    },

    async writeBinaryFile(
      { parentId, fileName, content, mimeType = 'application/zip', fileId },
      accessToken,
    ) {
      if (fileId) {
        const response = await driveFetch(
          fetchImpl,
          `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
          accessToken,
          {
            method: 'PATCH',
            headers: { 'Content-Type': mimeType },
            body: new Uint8Array(content),
          },
        );
        const body = (await response.json()) as DriveFileMetadata;
        return { ...body, name: body.name ?? fileName };
      }

      const boundary = `codeplug_${Date.now()}`;
      const metadata = JSON.stringify({
        name: fileName,
        parents: [parentId],
        mimeType,
      });
      const multipartBody = buildMultipartBinaryBody(boundary, metadata, mimeType, content);

      const response = await driveFetch(
        fetchImpl,
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        accessToken,
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: multipartBody,
        },
      );
      return (await response.json()) as DriveFileMetadata;
    },

    async getFileMetadata(fileId, accessToken) {
      const fields = encodeURIComponent('id,name,mimeType,parents,modifiedTime');
      const response = await driveFetch(
        fetchImpl,
        `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=${fields}`,
        accessToken,
      );
      return (await response.json()) as DriveFileMetadata;
    },

    async getUserEmail(accessToken) {
      const response = await driveFetch(
        fetchImpl,
        'https://www.googleapis.com/oauth2/v3/userinfo',
        accessToken,
      );
      const body = (await response.json()) as { email?: string };
      return body.email ?? '';
    },
  };
}

export const driveApi = createDriveApiClient();
