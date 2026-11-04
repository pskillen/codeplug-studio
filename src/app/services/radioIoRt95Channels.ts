/**
 * RT95 channel write helpers shared by the stock and MM9PDY targets (#1464): the stock name
 * fold, and the warnings for channel settings Studio cannot carry to the radio yet.
 * Pure; `buildRadioWriteProjection` supplies the DTOs and the slot map.
 */

import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { pushGeneralWarning } from '@core/import-export/exportWarning.ts';
import { toRt95Ascii } from '@core/import-export/formatProfiles.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { RadioChannelDto, RadioTone } from '@integrations/radio-io/radioChannelDto.ts';
import { hzToCtcssIndex } from '@integrations/radio-io/radios/rt95/ctcssToneTable.ts';

/**
 * Stock target: fold each radio name to printable ASCII (the same fold the MM9PDY target uses),
 * keeping case. Without it a non-ASCII name is written as UTF-8 lead bytes the radio cannot draw.
 */
export function foldRt95StockNames(
  channels: readonly RadioChannelDto[],
  warnings: ExportWarning[],
): RadioChannelDto[] {
  return channels.map((dto) => {
    if (dto.empty) return dto;
    const name = toRt95Ascii(dto.wireName, { forbidUnderscore: false });
    if (name.replaced) {
      pushGeneralWarning(
        warnings,
        `Channel ${dto.slotIndex}: characters the RT95 cannot show were replaced with "-" in the radio name "${name.text}".`,
      );
    }
    return { ...dto, wireName: name.text };
  });
}

function unsupportedCtcss(tone: RadioTone): number | null {
  return tone.kind === 'ctcss' && hzToCtcssIndex(tone.hz) == null ? tone.hz : null;
}

/**
 * Channels Studio cannot round-trip yet: a 20 kHz channel width is written as 25 kHz, and a CTCSS
 * tone outside the radio's 51-tone list (a "custom" tone in the stock CPS) is written without it.
 * Both are real radio options; full support is backlog.
 */
export function pushRt95ChannelRoundTripWarnings(input: {
  channels: readonly RadioChannelDto[];
  assembled: AssembledBuild;
  numbersBySourceChannelId: ReadonlyMap<string, number[]>;
  warnings: ExportWarning[];
}): void {
  const { channels, assembled, numbersBySourceChannelId, warnings } = input;

  for (const dto of channels) {
    if (dto.empty) continue;
    for (const [label, tone] of [
      ['receive', dto.rxTone],
      ['transmit', dto.txTone],
    ] as const) {
      const hz = unsupportedCtcss(tone);
      if (hz != null) {
        pushGeneralWarning(
          warnings,
          `Channel ${dto.slotIndex}: the ${label} CTCSS tone ${hz} Hz is not in the RT95's tone list (Studio cannot write a custom tone yet), so the channel is written without it.`,
        );
      }
    }
  }

  const numberBySource = new Map<number, (typeof assembled.channels)[number]>();
  for (const row of assembled.channels) {
    for (const n of numbersBySourceChannelId.get(row.entity.id) ?? []) numberBySource.set(n, row);
  }
  for (const dto of channels) {
    if (dto.empty) continue;
    const row = numberBySource.get(dto.slotIndex);
    if (!row) continue;
    const is20k = row.entity.modeProfiles.some((p) => 'bandwidthKHz' in p && p.bandwidthKHz === 20);
    if (is20k) {
      pushGeneralWarning(
        warnings,
        `Channel ${dto.slotIndex}: 20 kHz channel width is not supported by Studio yet and is written as ${dto.bandwidth === 'FM' ? '25' : '12.5'} kHz.`,
      );
    }
  }
}
