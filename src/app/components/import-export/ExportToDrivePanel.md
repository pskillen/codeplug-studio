# ExportToDrivePanel

Export the active project to native YAML on Google Drive with folder browser and overwrite confirmation.

## Purpose

Opens `DriveBrowserModal` in save mode, serialises via `exportProjectToYaml`, uploads through `GoogleDrivePort`, and records `ProjectMeta.interchange.googleDrive`.

## Related

- [ExportProjectYamlPanel.md](ExportProjectYamlPanel.md) — local download export
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
