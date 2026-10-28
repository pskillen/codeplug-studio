# ChannelDescriptionsCard

## Purpose

Shows each channel's **description** as the radio will receive it (wire value after the export boundary rules) on
Build → Channels, with an inline override. Rendered only for egress profiles that write a per-channel description
(today the RT95 MM9PDY profile); the length comes from the profile, not from the component.

## Props

| Prop     | Type                                          | Description                                           |
| -------- | --------------------------------------------- | ----------------------------------------------------- |
| `egress` | `Pick<EgressPath, 'formatId' \| 'profileId'>` | Egress the preview is projected for                   |
| `limit`  | `number`                                      | Description length from the profile (input maxLength) |

## Usage

```tsx
{
  descriptionLimit != null && activeEgress ? (
    <ChannelDescriptionsCard egress={activeEgress} limit={descriptionLimit} />
  ) : null;
}
```

## Behaviour

- Rows come from the same Write projection the radio write uses (`buildRadioWriteProjection`), so the preview and
  Write agree. Only channels that get a radio number are listed.
- Editing writes `BuildEntityOverride.wireDescription` on the channel override. An empty value means "no
  description"; **Reset** removes the override so the description follows the channel Name again.
- Nothing is shown when the build has no numbered channels.

## Related

- [Modded firmware hub](../../../../docs/features/modded-firmware/README.md)
- [RT95 MM9PDY data](../../../../docs/reference/radios/retevis/rt95/mm9pdy-data.md)
