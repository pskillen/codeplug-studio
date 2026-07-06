# ChannelLocationSection

## Purpose

Location block for the channel editor: Maidenhead locator, lat/lon inputs, use-location flag, clear control, and interactive map. Keeps locator and coordinates in sync; parent calls `reconcileChannelLocation` on save.

## Props

| Prop       | Type                                     | Description                                                   |
| ---------- | ---------------------------------------- | ------------------------------------------------------------- |
| `value`    | `ChannelLocationValues`                  | Current locator, coords, useLocation, and `lastEdited` source |
| `onChange` | `(value: ChannelLocationValues) => void` | Called on any field or map change                             |

## Usage

```tsx
import ChannelLocationSection, {
  channelLocationValuesFromChannel,
} from '@app/components/channels/ChannelLocationSection.tsx';
import { reconcileChannelLocation } from '@core/domain/channelLocation.ts';

const [location, setLocation] = useState(() =>
  channelLocationValuesFromChannel(entity ?? newChannel(projectId, '')),
);

<ChannelLocationSection value={location} onChange={setLocation} />;

// On save:
const lat = Number.parseFloat(location.lat);
const lon = Number.parseFloat(location.lon);
const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
const reconciled = reconcileChannelLocation({
  maidenheadLocator: location.maidenheadLocator || null,
  location: hasCoords ? { lat, lon } : null,
  useLocation: location.useLocation,
  lastEdited: location.lastEdited,
});
```

## Behaviour

- Valid locator on blur → derives lat/lon and sets `useLocation: true`.
- Lat/lon or map pick → derives 6-character locator; sets `lastEdited: 'coords'`.
- Lat/lon fields keep **string** draft values while typing so partial decimals (e.g. `55.`) are not dropped.
- Invalid locator on blur → inline error; does not overwrite coordinates.
- **No** “Use my location” button on this page (reference tool / list maps only).
- `clearPosition` resets locator, coords, and `useLocation`.

## Related

- [MapLocationPicker](../MapLocationPicker/MapLocationPicker.md)
- [docs/features/maidenhead.md](../../../docs/features/maidenhead.md)
- [#28](https://github.com/pskillen/codeplug-studio/issues/28)
