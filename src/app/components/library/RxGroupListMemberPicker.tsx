import {
  Badge,
  Button,
  Checkbox,
  Group,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type {
  DigitalContact,
  EntityRef,
  Library,
  RxGroupListMember,
  TalkGroup,
} from '@core/models/library.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { sortByName } from '../../lib/channels.ts';
import { entityRefKey } from '../../lib/entityRefs.ts';
import {
  applyTimeslotSegment,
  memberOptionMatchesFilter,
  memberSupportsTimeSlotOverride,
  timeslotSegmentValue,
} from '../../lib/rxGroupListMembers.ts';
import { reorderRxGroupListMembers } from '@core/domain/membershipOrder.ts';

export interface RxGroupListMemberPickerProps {
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  library: Library;
  members: RxGroupListMember[];
  onChange: (members: RxGroupListMember[]) => void;
}

interface MemberOption {
  ref: EntityRef;
  name: string;
  digitalId: number;
  key: string;
}

/** @deprecated Prefer `reorderRxGroupListMembers` from `@core/domain/membershipOrder`. */
export function moveSelectedMemberBlock(
  members: RxGroupListMember[],
  selected: Set<string>,
  direction: 'up' | 'down',
): RxGroupListMember[] {
  return reorderRxGroupListMembers(members, selected, direction);
}

function memberOptions(talkGroups: TalkGroup[], digitalContacts: DigitalContact[]): MemberOption[] {
  const tg = sortByName(talkGroups).map((t) => ({
    ref: { kind: 'talkGroup' as const, id: t.id },
    name: t.name,
    digitalId: t.digitalId,
    key: entityRefKey({ kind: 'talkGroup', id: t.id }),
  }));
  const dc = sortByName(digitalContacts).map((c) => ({
    ref: { kind: 'digitalContact' as const, id: c.id },
    name: c.name,
    digitalId: c.digitalId,
    key: entityRefKey({ kind: 'digitalContact', id: c.id }),
  }));
  return [...tg, ...dc];
}

function MemberKindBadge({ kind }: { kind: EntityRef['kind'] }) {
  if (kind === 'talkGroup') {
    return <Badge size="sm">Talk group</Badge>;
  }
  return (
    <Badge size="sm" color="grape">
      Digital contact
    </Badge>
  );
}

function MemberRowLabel({ option }: { option: MemberOption }) {
  return (
    <Stack gap={0}>
      <Text size="sm">{option.name}</Text>
      <Text size="xs" c="dimmed" ff="monospace">
        {option.digitalId || '—'}
      </Text>
    </Stack>
  );
}

function MemberList({
  items,
  checked,
  onToggle,
  emptyLabel,
}: {
  items: MemberOption[];
  checked: Set<string>;
  onToggle: (key: string) => void;
  emptyLabel: string;
}) {
  if (!items.length) {
    return (
      <Text size="sm" c="dimmed" p="xs">
        {emptyLabel}
      </Text>
    );
  }

  return (
    <Stack gap={4} p="xs">
      {items.map((item) => (
        <Group key={item.key} gap="xs" wrap="nowrap" align="flex-start">
          <Checkbox
            label={<MemberRowLabel option={item} />}
            checked={checked.has(item.key)}
            onChange={() => onToggle(item.key)}
            style={{ flex: 1 }}
          />
          <MemberKindBadge kind={item.ref.kind} />
        </Group>
      ))}
    </Stack>
  );
}

const TIMESLOT_SEGMENTS = [
  { value: 'auto', label: 'Auto' },
  { value: '1', label: 'TS1' },
  { value: '2', label: 'TS2' },
] as const;

function InListMemberList({
  rows,
  library,
  checked,
  onToggle,
  onTimeslotChange,
  emptyLabel,
}: {
  rows: { member: RxGroupListMember; option: MemberOption }[];
  library: Library;
  checked: Set<string>;
  onToggle: (key: string) => void;
  onTimeslotChange: (key: string, value: string) => void;
  emptyLabel: string;
}) {
  if (!rows.length) {
    return (
      <Text size="sm" c="dimmed" p="xs">
        {emptyLabel}
      </Text>
    );
  }

  return (
    <Stack gap={8} p="xs">
      {rows.map(({ member, option }) => {
        const key = entityRefKey(member.ref);
        const showSlot = memberSupportsTimeSlotOverride(member, library);
        return (
          <Stack key={key} gap={4}>
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <Checkbox checked={checked.has(key)} onChange={() => onToggle(key)} mt={4} />
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Group gap="xs" wrap="nowrap" justify="space-between">
                  <MemberRowLabel option={option} />
                  <MemberKindBadge kind={option.ref.kind} />
                </Group>
                {showSlot ? (
                  <SegmentedControl
                    size="xs"
                    data={[...TIMESLOT_SEGMENTS]}
                    value={timeslotSegmentValue(member)}
                    onChange={(value) => onTimeslotChange(key, value)}
                  />
                ) : null}
              </Stack>
            </Group>
          </Stack>
        );
      })}
    </Stack>
  );
}

export default function RxGroupListMemberPicker({
  talkGroups,
  digitalContacts,
  library,
  members,
  onChange,
}: RxGroupListMemberPickerProps) {
  const [availableFilter, setAvailableFilter] = useState('');
  const [inListFilter, setInListFilter] = useState('');
  const [availableSelected, setAvailableSelected] = useState<string[]>([]);
  const [inListSelected, setInListSelected] = useState<string[]>([]);

  const selectedRefKeys = useMemo(
    () => new Set(members.map((member) => entityRefKey(member.ref))),
    [members],
  );
  const allOptions = useMemo(
    () => memberOptions(talkGroups, digitalContacts),
    [talkGroups, digitalContacts],
  );
  const optionByKey = useMemo(() => new Map(allOptions.map((o) => [o.key, o])), [allOptions]);

  const availableFilterLower = availableFilter.trim().toLowerCase();
  const inListFilterLower = inListFilter.trim().toLowerCase();

  const availableMembers = useMemo(
    () =>
      allOptions.filter(
        (o) =>
          !selectedRefKeys.has(o.key) &&
          memberOptionMatchesFilter(o.name, o.digitalId, availableFilterLower),
      ),
    [allOptions, selectedRefKeys, availableFilterLower],
  );

  const inListMembers = useMemo(
    () =>
      members
        .map((member) => {
          const key = entityRefKey(member.ref);
          const option = optionByKey.get(key);
          return {
            member,
            option: option ?? {
              ref: member.ref,
              name: key,
              digitalId: 0,
              key,
            },
          };
        })
        .filter(
          ({ option }) =>
            !inListFilterLower ||
            memberOptionMatchesFilter(option.name, option.digitalId, inListFilterLower),
        ),
    [members, optionByKey, inListFilterLower],
  );

  const toggleAvailable = (key: string) => {
    setAvailableSelected((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  };

  const toggleInList = (key: string) => {
    setInListSelected((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  };

  const addSelected = () => {
    const toAdd = availableSelected
      .map((key) => optionByKey.get(key)?.ref)
      .filter((ref): ref is EntityRef => ref != null && !selectedRefKeys.has(entityRefKey(ref)))
      .map((ref) => ({ ref }));
    if (!toAdd.length) return;
    onChange([...members, ...toAdd]);
    setAvailableSelected([]);
  };

  const removeSelected = () => {
    if (!inListSelected.length) return;
    const remove = new Set(inListSelected);
    onChange(members.filter((member) => !remove.has(entityRefKey(member.ref))));
    setInListSelected([]);
  };

  const moveSelected = (direction: 'up' | 'down') => {
    if (!inListSelected.length) return;
    onChange(moveSelectedMemberBlock(members, new Set(inListSelected), direction));
  };

  const setMemberTimeslot = (refKey: string, value: string) => {
    onChange(
      members.map((member) => {
        if (entityRefKey(member.ref) !== refKey) return member;
        return applyTimeslotSegment(member, value);
      }),
    );
  };

  const canMoveUp = inListSelected.some((key) => {
    const index = members.findIndex((member) => entityRefKey(member.ref) === key);
    return index > 0;
  });
  const canMoveDown = inListSelected.some((key) => {
    const index = members.findIndex((member) => entityRefKey(member.ref) === key);
    return index >= 0 && index < members.length - 1;
  });

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {members.length} member{members.length === 1 ? '' : 's'}
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Stack gap="xs">
          <TextInput
            label="Filter available"
            placeholder="Search by name or DMR ID…"
            value={availableFilter}
            onChange={(e) => setAvailableFilter(e.currentTarget.value)}
          />
          <Text size="sm" fw={500}>
            Available
          </Text>
          <ScrollArea
            h={240}
            type="auto"
            offsetScrollbars
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
            }}
          >
            <MemberList
              items={availableMembers}
              checked={new Set(availableSelected)}
              onToggle={toggleAvailable}
              emptyLabel="No talk groups or contacts available"
            />
          </ScrollArea>
        </Stack>

        <Stack gap="xs" justify="center">
          <Button
            type="button"
            variant="light"
            onClick={addSelected}
            disabled={!availableSelected.length}
            rightSection={<IconArrowRight size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          >
            Add
          </Button>
          <Button
            type="button"
            variant="light"
            onClick={removeSelected}
            disabled={!inListSelected.length}
            leftSection={<IconArrowLeft size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          >
            Remove
          </Button>
        </Stack>

        <Stack gap="xs">
          <TextInput
            label="Filter in list"
            placeholder="Search by name or DMR ID…"
            value={inListFilter}
            onChange={(e) => setInListFilter(e.currentTarget.value)}
          />
          <Text size="sm" fw={500}>
            In list (export order)
          </Text>
          <Text size="xs" c="dimmed">
            Timeslot override applies to this list membership only. Auto lets the channel slot or
            export rules decide.
          </Text>
          <ScrollArea
            h={280}
            type="auto"
            offsetScrollbars
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
            }}
          >
            <InListMemberList
              rows={inListMembers}
              library={library}
              checked={new Set(inListSelected)}
              onToggle={toggleInList}
              onTimeslotChange={setMemberTimeslot}
              emptyLabel="No members in list"
            />
          </ScrollArea>
          <Group gap="xs">
            <Button
              type="button"
              variant="default"
              size="compact-sm"
              onClick={() => moveSelected('up')}
              disabled={!canMoveUp}
            >
              Move up
            </Button>
            <Button
              type="button"
              variant="default"
              size="compact-sm"
              onClick={() => moveSelected('down')}
              disabled={!canMoveDown}
            >
              Move down
            </Button>
          </Group>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
