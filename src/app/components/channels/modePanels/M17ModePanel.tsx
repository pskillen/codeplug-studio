import { Anchor, NumberInput, Stack, Switch, TextInput } from '@mantine/core';
import { Link } from 'react-router-dom';
import {
  isM17Can,
  M17_CAN_ERROR,
  M17_DESTINATION_ERROR,
  normalizeM17Destination,
} from '@core/domain/m17Address.ts';
import { defaultOwnDigitalId } from '@core/domain/ownDigitalIds.ts';
import { OWN_ID_FIELD_HINTS, OWN_ID_PAGE_PATH } from '../../../lib/ownDigitalIdOptions.ts';
import DigitalModeGroups from './DigitalModeGroups.tsx';
import type { ModePanelProps, ProfileFor } from './types.ts';

export default function M17ModePanel({
  profile,
  onPatch,
  context,
}: ModePanelProps<ProfileFor<'m17'>>) {
  const { can, destination, playEveryCan } = profile;
  const callsign = defaultOwnDigitalId(context.library.ownDigitalIds, 'm17')?.callsign;
  const canonicalDestination = normalizeM17Destination(destination);

  return (
    <DigitalModeGroups
      access={
        <>
          <NumberInput
            label="CAN"
            description="Channel Access Number, 0–15. Blank uses CAN 0."
            min={0}
            max={15}
            clampBehavior="none"
            value={can ?? ''}
            onChange={(value) =>
              onPatch({ can: value === '' || value === '-' ? null : Number(value) })
            }
            error={can != null && !isM17Can(can) ? M17_CAN_ERROR : undefined}
          />
          <Switch
            label="Play every CAN"
            aria-label="Play every CAN"
            description="Open squelch for any CAN."
            checked={playEveryCan === true}
            onChange={(event) => onPatch({ playEveryCan: event.currentTarget.checked })}
          />
        </>
      }
      call={
        <TextInput
          label="Destination"
          description="Blank calls ALL. For a reflector module, enter its address, e.g. M17-M17 A."
          value={destination}
          onChange={(event) => onPatch({ destination: event.currentTarget.value })}
          onBlur={() => {
            if (canonicalDestination !== null && canonicalDestination !== destination) {
              onPatch({ destination: canonicalDestination });
            }
          }}
          error={canonicalDestination === null ? M17_DESTINATION_ERROR : undefined}
        />
      }
      listen={{ note: playEveryCan ? 'Hears every CAN.' : 'Hears only this CAN.' }}
      you={
        <Stack gap={4}>
          <TextInput
            label="M17 callsign"
            description={OWN_ID_FIELD_HINTS.m17}
            value={callsign ?? ''}
            placeholder="No default M17 callsign set"
            readOnly
          />
          <Anchor component={Link} to={OWN_ID_PAGE_PATH} size="sm">
            Manage Digital IDs
          </Anchor>
        </Stack>
      }
    />
  );
}
