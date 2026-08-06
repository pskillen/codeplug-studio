# QuickProjectSwitcher

**Purpose:** mk2 S3 lightweight overlay from the project chip — jump between recent projects without full navigation. Escape hatch to Home (P1) via **Manage all projects**.

## Props

| Prop              | Type                     | Description                                       |
| ----------------- | ------------------------ | ------------------------------------------------- |
| `opened`          | `boolean`                | Popover/drawer visibility                         |
| `onClose`         | `() => void`             | Dismiss                                           |
| `targetRef`       | `RefObject<HTMLElement>` | Desktop popover anchor (project chip)             |
| `mobile`          | `boolean`                | Bottom sheet instead of popover                   |
| `projects`        | `ProjectMeta[]`          | All projects (sorted by `updatedAt`, max 4 shown) |
| `activeProjectId` | `string \| null`         | Highlights current row                            |
| `onSwitchProject` | `(id) => void`           | Switch without leaving route context              |
| `onNewProject`    | `() => void`             | Navigate to Home create flow                      |
| `onManageAll`     | `() => void`             | Navigate to `/`                                   |

## Usage

Wired from `AppLayout` when the project chip is clicked and a project is active.

## Related

- [ProjectChip](../v2/ProjectChip.md)
- [AppShell](../v2/AppShell.md)
- [app-shell feature hub](../../../../docs/features/app-shell/README.md)
