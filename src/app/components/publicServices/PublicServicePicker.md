# PublicServicePicker

## Purpose

Library workflow for importing bundled, receive-only public-service monitoring channels (UK fireground, HM Coastguard, Irish Coast Guard, port working channels) into the active project.

## Props

| Prop     | Type | Description                                           |
| -------- | ---- | ----------------------------------------------------- |
| _(none)_ | —    | Reads active project and library from app state hooks |

## Usage

```tsx
import PublicServicePicker from '@app/components/publicServices/PublicServicePicker.tsx';

<PublicServicePicker />;
```

Routed at `/library/channels/add-public-services` via `AddPublicServicesPage`.

## Behaviour

- mk2 layout on `DirectoryIngestPage` — country `Select`, group checkboxes, preview `DataTable`. Encrypted or unpublished services sit in a collapsed **Why some services aren't listed** panel after the groups, so picking a country does not read as “not available”
- Country is pre-selected from `navigator.language` when a dataset exists for that region (`en-GB` → United Kingdom). `en-US` leaves the picker open rather than silently choosing GB
- Groups default to ticked. Dual-mode fireground rows show both FM and DMR pills
- Frequency collisions with a differently named library channel stay selectable and show an advisory
- Name matches (case/whitespace insensitive) are skipped; re-running the same selection is a no-op
- Transmit is forbidden at creation and is not offered as an option
- Optional: one library zone per selected group that adds channels
- Persists via `persistPublicServiceImport` → `putChannel` loop and optional `putZone`s

## Related

- [Public service channels](../../../docs/features/library/public-service-channels/README.md)
- Core: `src/core/domain/publicServices/`, `src/core/services/publicServiceImport.ts`
