import { Stack } from '@mantine/core';
import type { BuildExportSettings } from '@core/models/formatBuild.ts';
import type {
  AnalogSquelchMode,
  EffectiveForbidTransmit,
  SendTalkerAliasMode,
  TxPermitMode,
} from '@core/models/channelBehaviourDefaults.ts';
import { OverrideField } from '../v2/index.ts';
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
      <OverrideField
        label="Transmit permission"
        description="Build-level default for forbid transmit."
        overridden={forbidEnabled}
        onOverride={() => onPatch({ defaultForbidTransmit: forbidValue })}
        onReset={() => onPatch({ defaultForbidTransmit: undefined })}
      >
        <ForbidTransmitSegment
          value={forbidValue}
          includeDefault={false}
          disabled={disabled || !forbidEnabled}
          onChange={(value) =>
            onPatch({ defaultForbidTransmit: value === 'default' ? 'allow' : value })
          }
        />
      </OverrideField>

      <OverrideField
        label="TX permit"
        overridden={txPermitEnabled}
        onOverride={() => onPatch({ defaultTxPermit: txPermitValue })}
        onReset={() => onPatch({ defaultTxPermit: undefined })}
      >
        <TxPermitSegment
          value={txPermitValue}
          includeDefault={false}
          disabled={disabled || !txPermitEnabled}
          onChange={(value) =>
            onPatch({ defaultTxPermit: value === 'default' ? 'permitAlways' : value })
          }
        />
      </OverrideField>

      <OverrideField
        label="Send talker alias"
        overridden={talkerAliasEnabled}
        onOverride={() => onPatch({ defaultSendTalkerAlias: talkerAliasValue })}
        onReset={() => onPatch({ defaultSendTalkerAlias: undefined })}
      >
        <SendTalkerAliasSegment
          value={talkerAliasValue}
          includeDefault={false}
          disabled={disabled || !talkerAliasEnabled}
          onChange={(value) =>
            onPatch({ defaultSendTalkerAlias: value === 'default' ? 'on' : value })
          }
        />
      </OverrideField>

      <OverrideField
        label="Analog squelch mode"
        overridden={squelchEnabled}
        onOverride={() => onPatch({ defaultAnalogSquelchMode: squelchValue })}
        onReset={() => onPatch({ defaultAnalogSquelchMode: undefined })}
      >
        <AnalogSquelchModeSegment
          value={squelchValue}
          includeDefault={false}
          disabled={disabled || !squelchEnabled}
          onChange={(value) =>
            onPatch({ defaultAnalogSquelchMode: value === 'default' ? 'carrier' : value })
          }
        />
      </OverrideField>
    </Stack>
  );
}
