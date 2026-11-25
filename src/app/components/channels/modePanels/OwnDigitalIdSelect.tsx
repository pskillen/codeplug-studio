import { Link } from 'react-router-dom';
import { Anchor, Select, Stack } from '@mantine/core';
import type { Library, NumericOwnDigitalIdProtocol } from '@core/models/library.ts';
import {
  OWN_ID_FIELD_HINTS,
  OWN_ID_PAGE_PATH,
  ownDigitalIdFromSelectValue,
  ownDigitalIdSelectData,
} from '../../../lib/ownDigitalIdOptions.ts';

/** A channel's own-ID choice: Default, or one of the protocol's Digital IDs. */
export default function OwnDigitalIdSelect({
  label,
  protocol,
  library,
  value,
  onChange,
}: {
  label: string;
  protocol: NumericOwnDigitalIdProtocol;
  library: Library;
  value: string | null | undefined;
  onChange: (ownDigitalIdId: string | null) => void;
}) {
  return (
    <Stack gap={4}>
      <Select
        label={label}
        description={OWN_ID_FIELD_HINTS[protocol]}
        data={ownDigitalIdSelectData(library, protocol, value)}
        value={value ?? ''}
        onChange={(v) => onChange(ownDigitalIdFromSelectValue(v))}
        allowDeselect={false}
      />
      <Anchor component={Link} to={OWN_ID_PAGE_PATH} size="sm">
        Manage Digital IDs
      </Anchor>
    </Stack>
  );
}
