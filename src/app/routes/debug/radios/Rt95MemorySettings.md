# RT95 memory settings

## Purpose

Read-only grouped view of every RT95 settings field the Write registry knows, decoded from a captured clone image.

## Props and usage

`Rt95SettingsPanel` takes `settings` (from `projectRt95Settings` in `integrations/radio-io/radios/rt95/debugMemorySettings.ts`), `revealed` and `onToggleReveal` (from `useSensitiveReveal`). `Rt95Memory` mounts it.

## Behaviour

One table per registry section (Display, Function setup, VOX, PF keys, DTMF, Advanced) with setting, value, trust and targets; a switch adds address and raw bytes. Search covers label, id, help, group, trust, value, raw bytes and address, and also filters the unclaimed runs. A field whose bytes were not all captured says so and is never filled with a default. The power-on password value and raw bytes show `••` until **Show password** is pressed. Bytes in `0x1980-0x1AFF` and `0x3200-0x327F` that no field claims are listed as unclaimed runs. Tables scroll horizontally at 375 px. Nothing writes or re-reads the radio.

## Related

[Rt95Memory](Rt95Memory.md) · [RT95 debug reference](../../../../../docs/reference/radios/retevis/rt95/debug-memory.md)
