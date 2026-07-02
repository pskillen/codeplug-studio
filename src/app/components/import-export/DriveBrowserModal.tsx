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
  formatBrowsePathLabel,
  pathUpToIndex,
  resolveInitialBrowseState,
} from './driveBrowserHelpers.ts';
import GoogleDriveButton from './GoogleDriveButton.tsx';

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
  saving?: boolean;
  onSelectFile: (selection: DriveOpenSelection) => void;
  onSaveTarget: (target: DriveSaveTarget) => void;
  port?: GoogleDrivePort;
}

interface DriveBrowserBodyProps {
  mode: 'open' | 'save';
  interchangeFolderId?: string;
  defaultFileName: string;
  saving: boolean;
  onClose: () => void;
  onSelectFile: (selection: DriveOpenSelection) => void;
  onSaveTarget: (target: DriveSaveTarget) => void;
  port: GoogleDrivePort;
}

function DriveBrowserBody({
  mode,
  interchangeFolderId,
  defaultFileName,
  saving,
  onClose,
  onSelectFile,
  onSaveTarget,
  port,
}: DriveBrowserBodyProps) {
  const initial = resolveInitialBrowseState({
    interchangeFolderId,
    lastFolderId: loadDriveLastFolderId(),
    lastFolderPath: loadDriveLastFolderPath(),
  });
  const [folderId, setFolderId] = useState(initial.folderId);
  const [path, setPath] = useState<DriveFolderCrumb[]>(initial.path);
  const [children, setChildren] = useState<DriveListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [fileName, setFileName] = useState(defaultFileName);
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    if (!port.isConnected()) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await port.listChildren(folderId);
        if (!cancelled) setChildren(items);
      } catch (err) {
        if (!cancelled) setError(driveErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [folderId, port]);

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
      <Stack gap={4} pb="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          Optional
        </Text>
        <Group align="flex-end" gap="xs">
          <TextInput
            aria-label="New folder name"
            placeholder="New folder name"
            size="xs"
            value={newFolderName}
            disabled={saving || creatingFolder}
            onChange={(event) => setNewFolderName(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            size="xs"
            variant="subtle"
            loading={creatingFolder}
            disabled={saving}
            onClick={() => void handleCreateFolder()}
          >
            Create folder
          </Button>
        </Group>
      </Stack>
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
      {mode === 'open' && !loading && folders.length === 0 && yamlFiles.length === 0 ? (
        <Text size="sm" c="dimmed">
          This folder is empty.
        </Text>
      ) : null}
      {mode === 'save' ? (
        <Stack
          gap="xs"
          pt="xs"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <TextInput
            label="Filename"
            description={`Save to ${formatBrowsePathLabel(path)}`}
            value={fileName}
            disabled={saving}
            onChange={(event) => setFileName(event.currentTarget.value)}
          />
          <GoogleDriveButton loading={saving} disabled={saving} onClick={handleSaveHere}>
            Save here
          </GoogleDriveButton>
        </Stack>
      ) : null}
    </Stack>
  );
}

export default function DriveBrowserModal({
  opened,
  onClose,
  mode,
  interchangeFolderId,
  defaultFileName = '',
  saving = false,
  onSelectFile,
  onSaveTarget,
  port = googleDrivePort,
}: DriveBrowserModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'open' ? 'Open from Google Drive' : 'Save to Google Drive'}
      size="lg"
      centered
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
    >
      {opened ? (
        <DriveBrowserBody
          key={`${mode}-${interchangeFolderId ?? 'root'}-${defaultFileName}`}
          mode={mode}
          interchangeFolderId={interchangeFolderId}
          defaultFileName={defaultFileName}
          saving={saving}
          onClose={onClose}
          onSelectFile={onSelectFile}
          onSaveTarget={onSaveTarget}
          port={port}
        />
      ) : null}
    </Modal>
  );
}
