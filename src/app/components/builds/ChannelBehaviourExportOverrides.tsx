import { Stack, Switch } from '@mantine/core';
import type { BuildExportSettings } from '@core/models/formatBuild.ts';
import type {
  AnalogSquelchMode,
  EffectiveForbidTransmit,
  SendTalkerAliasMode,
  TxPermitMode,
} from '@core/models/channelBehaviourDefaults.ts';
import ForbidTransmitSegment from '../channels/ForbidTransmitSegment.tsx';
import TxPermitSegment from '../channels/TxPermitSegment.tsx';
import SendTalkerAliasSegment from '../channels/SendTalkerAliasSegment.tsx';
import AnalogSquelchModeSegment from '../channels/AnalogSquelchModeSegment.tsx';

export interface ChannelBehaviourExportOverridesProps {
  exportSettings: BuildExportSettings | undefined;
  disabled?: boolean;
  onPatch: (patch: Partial<BuildExportSettings>) => void;
}

export default function ChannelBehaviourExportOverrides({
  exportSettings,
  disabled = false,
  onPatch,
}: ChannelBehaviourExportOverridesProps) {
  const forbidEnabled = exportSettings?.defaultForbidTransmit !== undefined;
  const txPermitEnabled = exportSettings?.defaultTxPermit !== undefined;
  const talkerAliasEnabled = exportSettings?.defaultSendTalkerAlias !== undefined;
  const squelchEnabled = exportSettings?.defaultAnalogSquelchMode !== undefined;

  const forbidValue: EffectiveForbidTransmit = exportSettings?.defaultForbidTransmit ?? 'allow';
  const txPermitValue: TxPermitMode = exportSettings?.defaultTxPermit ?? 'permitAlways';
  const talkerAliasValue: SendTalkerAliasMode = exportSettings?.defaultSendTalkerAlias ?? 'on';
  const squelchValue: AnalogSquelchMode = exportSettings?.defaultAnalogSquelchMode ?? 'carrier';

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Switch
          label="Override transmit permission"
          description="When enabled, wins over library defaults and per-channel overrides."
          checked={forbidEnabled}
          disabled={disabled}
          onChange={(event) =>
            onPatch({
              defaultForbidTransmit: event.currentTarget.checked ? forbidValue : undefined,
            })
          }
        />
        <ForbidTransmitSegment
          value={forbidValue}
          includeDefault={false}
          disabled={disabled || !forbidEnabled}
          onChange={(value) =>
            onPatch({ defaultForbidTransmit: value === 'default' ? 'allow' : value })
          }
        />
      </Stack>

      <Stack gap="xs">
        <Switch
          label="Override TX permit"
          checked={txPermitEnabled}
          disabled={disabled}
          onChange={(event) =>
            onPatch({
              defaultTxPermit: event.currentTarget.checked ? txPermitValue : undefined,
            })
          }
        />
        <TxPermitSegment
          value={txPermitValue}
          includeDefault={false}
          disabled={disabled || !txPermitEnabled}
          onChange={(value) =>
            onPatch({ defaultTxPermit: value === 'default' ? 'permitAlways' : value })
          }
        />
      </Stack>

      <Stack gap="xs">
        <Switch
          label="Override send talker alias"
          checked={talkerAliasEnabled}
          disabled={disabled}
          onChange={(event) =>
            onPatch({
              defaultSendTalkerAlias: event.currentTarget.checked ? talkerAliasValue : undefined,
            })
          }
        />
        <SendTalkerAliasSegment
          value={talkerAliasValue}
          includeDefault={false}
          disabled={disabled || !talkerAliasEnabled}
          onChange={(value) =>
            onPatch({ defaultSendTalkerAlias: value === 'default' ? 'on' : value })
          }
        />
      </Stack>

      <Stack gap="xs">
        <Switch
          label="Override analog squelch mode"
          checked={squelchEnabled}
          disabled={disabled}
          onChange={(event) =>
            onPatch({
              defaultAnalogSquelchMode: event.currentTarget.checked ? squelchValue : undefined,
            })
          }
        />
        <AnalogSquelchModeSegment
          value={squelchValue}
          includeDefault={false}
          disabled={disabled || !squelchEnabled}
          onChange={(value) =>
            onPatch({ defaultAnalogSquelchMode: value === 'default' ? 'carrier' : value })
          }
        />
      </Stack>
    </Stack>
  );
}
