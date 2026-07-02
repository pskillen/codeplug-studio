import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  DRIVE_ROOT_FOLDER_ID,
  googleDrivePort,
  type DriveFolderCrumb,
  type DriveListItem,
  type GoogleDrivePort,
} from '@integrations/cloud/index.ts';
import {
  loadDriveLastFolderId,
  loadDriveLastFolderPath,
  saveDriveLastFolderId,
  saveDriveLastFolderPath,
} from '@integrations/cloud/drivePrefs.ts';
import {
  appendFolderToPath,
  driveErrorMessage,
  pathUpToIndex,
  resolveInitialBrowseState,
} from './driveBrowserHelpers.ts';

export interface DriveOpenSelection {
  fileId: string;
  fileName: string;
  content: string;
}

export interface DriveSaveTarget {
  folderId: string;
  folderName: string;
  path: DriveFolderCrumb[];
  fileName: string;
  existingFileId?: string;
}

export interface DriveBrowserModalProps {
  opened: boolean;
  onClose: () => void;
  mode: 'open' | 'save';
  interchangeFolderId?: string;
  defaultFileName?: string;
  onSelectFile: (selection: DriveOpenSelection) => void;
  onSaveTarget: (target: DriveSaveTarget) => void;
  port?: GoogleDrivePort;
}

export default function DriveBrowserModal({
  opened,
  onClose,
  mode,
  interchangeFolderId,
  defaultFileName = '',
  onSelectFile,
  onSaveTarget,
  port = googleDrivePort,
}: DriveBrowserModalProps) {
  const [folderId, setFolderId] = useState(DRIVE_ROOT_FOLDER_ID);
  const [path, setPath] = useState<DriveFolderCrumb[]>([
    { id: DRIVE_ROOT_FOLDER_ID, name: 'My Drive' },
  ]);
  const [children, setChildren] = useState<DriveListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [fileName, setFileName] = useState(defaultFileName);
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    if (!opened) return;
    const initial = resolveInitialBrowseState({
      interchangeFolderId,
      lastFolderId: loadDriveLastFolderId(),
      lastFolderPath: loadDriveLastFolderPath(),
    });
    setFolderId(initial.folderId);
    setPath(initial.path);
    setFileName(defaultFileName);
    setError(null);
  }, [opened, interchangeFolderId, defaultFileName]);

  useEffect(() => {
    if (!opened || !port.isConnected()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void port
      .listChildren(folderId)
      .then((items) => {
        if (!cancelled) setChildren(items);
      })
      .catch((err) => {
        if (!cancelled) setError(driveErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, folderId, port]);

  function persistBrowseState(nextFolderId: string, nextPath: DriveFolderCrumb[]) {
    saveDriveLastFolderId(nextFolderId);
    saveDriveLastFolderPath(nextPath);
  }

  function openFolder(folder: DriveListItem) {
    const nextPath = appendFolderToPath(path, { id: folder.id, name: folder.name });
    setFolderId(folder.id);
    setPath(nextPath);
    persistBrowseState(folder.id, nextPath);
  }

  function navigateToCrumb(index: number) {
    const nextPath = pathUpToIndex(path, index);
    const nextFolderId = nextPath[nextPath.length - 1]?.id ?? DRIVE_ROOT_FOLDER_ID;
    setFolderId(nextFolderId);
    setPath(nextPath);
    persistBrowseState(nextFolderId, nextPath);
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    setError(null);
    try {
      await port.createFolder(folderId, name);
      setNewFolderName('');
      const items = await port.listChildren(folderId);
      setChildren(items);
    } catch (err) {
      setError(driveErrorMessage(err));
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleOpenFile(file: DriveListItem) {
    setLoading(true);
    setError(null);
    try {
      const content = await port.readFile(file.id);
      onSelectFile({ fileId: file.id, fileName: file.name, content });
      onClose();
    } catch (err) {
      setError(driveErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleSaveHere() {
    const trimmed = fileName.trim();
    if (!trimmed) {
      setError('Enter a filename.');
      return;
    }
    const folderName = path[path.length - 1]?.name ?? 'My Drive';
    const existing = children.find(
      (child) => child.kind === 'yaml' && child.name.toLowerCase() === trimmed.toLowerCase(),
    );
    onSaveTarget({
      folderId,
      folderName,
      path,
      fileName: trimmed,
      existingFileId: existing?.id,
    });
  }

  const folders = children.filter((child) => child.kind === 'folder');
  const yamlFiles = children.filter((child) => child.kind === 'yaml');

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'open' ? 'Open from Google Drive' : 'Save to Google Drive'}
      size="lg"
      centered
    >
      <Stack gap="sm">
        {!port.isConnected() ? (
          <Alert color="yellow">Connect Google Drive in Settings before browsing files.</Alert>
        ) : null}
        {error ? (
          <Alert color="red">
            {error}
            {error.toLowerCase().includes('auth') ? (
              <Text size="sm" mt="xs">
                Reconnect from Settings if your session expired.
              </Text>
            ) : null}
          </Alert>
        ) : null}
        <Breadcrumbs>
          {path.map((crumb, index) => (
            <Anchor
              key={crumb.id}
              component="button"
              type="button"
              onClick={() => navigateToCrumb(index)}
            >
              {crumb.name}
            </Anchor>
          ))}
        </Breadcrumbs>
        <Group align="flex-end">
          <TextInput
            label="New folder"
            placeholder="Folder name"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button loading={creatingFolder} onClick={() => void handleCreateFolder()}>
            Create folder
          </Button>
        </Group>
        {loading ? <Text size="sm">Loading…</Text> : null}
        {folders.length > 0 ? (
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              Folders
            </Text>
            {folders.map((folder) => (
              <Button
                key={folder.id}
                variant="subtle"
                justify="flex-start"
                onClick={() => openFolder(folder)}
              >
                {folder.name}
              </Button>
            ))}
          </Stack>
        ) : null}
        {mode === 'open' && yamlFiles.length > 0 ? (
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              YAML files
            </Text>
            {yamlFiles.map((file) => (
              <Button
                key={file.id}
                variant="light"
                justify="flex-start"
                onClick={() => void handleOpenFile(file)}
              >
                {file.name}
              </Button>
            ))}
          </Stack>
        ) : null}
        {mode === 'save' ? (
          <>
            <TextInput
              label="Filename"
              value={fileName}
              onChange={(event) => setFileName(event.currentTarget.value)}
            />
            <Button onClick={handleSaveHere}>Save here</Button>
          </>
        ) : null}
        {mode === 'open' && !loading && folders.length === 0 && yamlFiles.length === 0 ? (
          <Text size="sm" c="dimmed">
            This folder is empty.
          </Text>
        ) : null}
      </Stack>
    </Modal>
  );
}
