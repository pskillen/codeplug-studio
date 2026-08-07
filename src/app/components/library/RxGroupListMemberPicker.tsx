import { useCallback, useMemo, useState } from 'react';
import type {
  DigitalContact,
  EntityRef,
  Library,
  RxGroupListMember,
  TalkGroup,
} from '@core/models/library.ts';
import { rxGroupListMemberKey } from '@core/domain/membershipOrder.ts';
import { sortRxGroupListMembersByMode } from '@core/domain/membershipSort.ts';
import { reorderSelectedKeys } from '@core/domain/zoneOrder.ts';
import { sortByName } from '../../lib/channels.ts';
import {
  applyTimeslotSegment,
  memberOptionMatchesFilter,
  memberSupportsTimeSlotOverride,
  timeslotSegmentValue,
} from '../../lib/rxGroupListMembers.ts';
import {
  AddMembersScreen,
  MembershipPanel,
  MembershipPoolRow,
  Pill,
  SegmentedControl,
} from '../v2/index.ts';
import {
  DataTableBulkReorderProvider,
  DataTableBulkReorderSortable,
} from '../../lib/dataTable/DataTableBulkReorder.tsx';
import MembershipSortMenu from './MembershipSortMenu.tsx';
import SortableMembershipRow, { MembershipRowList } from './SortableMembershipRow.tsx';

export interface RxGroupListMemberPickerProps {
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  library: Library;
  members: RxGroupListMember[];
  onChange: (members: RxGroupListMember[]) => void;
  onAdd?: () => void;
}

interface MemberOption {
  ref: EntityRef;
  name: string;
  digitalId: number;
  key: string;
}

const TIMESLOT_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '1', label: 'TS1' },
  { value: '2', label: 'TS2' },
] as const;

const ADD_SECTIONS = [
  { id: 'talkGroups', label: 'Talk groups' },
  { id: 'digitalContacts', label: 'Digital contacts' },
] as const;

type AddSectionId = (typeof ADD_SECTIONS)[number]['id'];

function buildTalkGroupOptions(talkGroups: TalkGroup[]): MemberOption[] {
  return sortByName(talkGroups).map((t) => ({
    ref: { kind: 'talkGroup' as const, id: t.id },
    name: t.name,
    digitalId: t.digitalId,
    key: rxGroupListMemberKey({ ref: { kind: 'talkGroup', id: t.id } }),
  }));
}

function buildDigitalContactOptions(digitalContacts: DigitalContact[]): MemberOption[] {
  return sortByName(digitalContacts).map((c) => ({
    ref: { kind: 'digitalContact' as const, id: c.id },
    name: c.name,
    digitalId: c.digitalId,
    key: rxGroupListMemberKey({ ref: { kind: 'digitalContact', id: c.id } }),
  }));
}

export function reorderRxGroupListMembersByKeys(
  members: RxGroupListMember[],
  orderedKeys: string[],
): RxGroupListMember[] {
  if (orderedKeys.length !== members.length) return members;
  const byKey = new Map(members.map((member) => [rxGroupListMemberKey(member), member]));
  const next = orderedKeys.map((key) => byKey.get(key));
  if (next.some((row) => row == null)) return members;
  return next as RxGroupListMember[];
}

function kindLabel(kind: EntityRef['kind']): string {
  return kind === 'talkGroup' ? 'Talk group' : 'Digital contact';
}

export default function RxGroupListMemberPicker({
  talkGroups,
  digitalContacts,
  library,
  members,
  onChange,
  onAdd,
}: RxGroupListMemberPickerProps) {
  const [inListFilter, setInListFilter] = useState('');
  const [inListSelected, setInListSelected] = useState<string[]>([]);

  const talkGroupsById = useMemo(
    () => new Map(talkGroups.map((row) => [row.id, row])),
    [talkGroups],
  );
  const digitalContactsById = useMemo(
    () => new Map(digitalContacts.map((row) => [row.id, row])),
    [digitalContacts],
  );

  const allOptions = useMemo(
    () => [...buildTalkGroupOptions(talkGroups), ...buildDigitalContactOptions(digitalContacts)],
    [talkGroups, digitalContacts],
  );
  const optionByKey = useMemo(() => new Map(allOptions.map((o) => [o.key, o])), [allOptions]);
  const memberKeys = useMemo(() => members.map(rxGroupListMemberKey), [members]);
  const inListFilterLower = inListFilter.trim().toLowerCase();
  const filterActive = inListFilterLower.length > 0;

  const filteredInListKeys = useMemo(() => {
    if (!filterActive) return memberKeys;
    return memberKeys.filter((key) => {
      const option = optionByKey.get(key);
      if (!option) return true;
      return memberOptionMatchesFilter(option.name, option.digitalId, inListFilterLower);
    });
  }, [filterActive, memberKeys, optionByKey, inListFilterLower]);

  const toggleInList = useCallback((key: string) => {
    setInListSelected((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }, []);

  const removeKeys = useCallback(
    (keys: string[]) => {
      if (!keys.length) return;
      const remove = new Set(keys);
      onChange(members.filter((member) => !remove.has(rxGroupListMemberKey(member))));
      setInListSelected((prev) => prev.filter((key) => !remove.has(key)));
    },
    [members, onChange],
  );

  const moveSelected = useCallback(
    (direction: 'up' | 'down') => {
      if (!inListSelected.length || filterActive) return;
      onChange(
        reorderRxGroupListMembersByKeys(
          members,
          reorderSelectedKeys(memberKeys, new Set(inListSelected), direction),
        ),
      );
    },
    [filterActive, inListSelected, memberKeys, members, onChange],
  );

  const setMemberTimeslot = useCallback(
    (refKey: string, value: string) => {
      onChange(
        members.map((member) => {
          if (rxGroupListMemberKey(member) !== refKey) return member;
          return applyTimeslotSegment(member, value);
        }),
      );
    },
    [members, onChange],
  );

  return (
    <MembershipPanel
      title="Members"
      description={`${members.length} member${members.length === 1 ? '' : 's'} — export order. Timeslot override applies to this list membership only.`}
      addLabel="Add members"
      onAdd={onAdd}
      search={{
        value: inListFilter,
        onChange: setInListFilter,
        placeholder: 'Filter by name or DMR ID…',
      }}
      selectedCount={inListSelected.length}
      onBulkMoveUp={() => moveSelected('up')}
      onBulkMoveDown={() => moveSelected('down')}
      onBulkRemove={() => removeKeys(inListSelected)}
      onClearSelection={() => setInListSelected([])}
      isEmpty={filteredInListKeys.length === 0}
      emptyMessage="No members in list"
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <MembershipSortMenu
          modes={['name', 'callsign']}
          disabled={!members.length || filterActive}
          label="Sort members…"
          onSort={(mode) =>
            onChange(
              sortRxGroupListMembersByMode(members, talkGroupsById, digitalContactsById, mode),
            )
          }
        />
      </div>
      <DataTableBulkReorderProvider
        sortableKeys={filterActive ? [] : memberKeys}
        orderedKeys={memberKeys}
        selectedKeys={inListSelected}
        disabled={filterActive}
        onSetOrder={(nextKeys) => {
          if (filterActive) return;
          onChange(reorderRxGroupListMembersByKeys(members, nextKeys));
        }}
      >
        <DataTableBulkReorderSortable
          sortableKeys={filterActive ? [] : memberKeys}
          disabled={filterActive}
        >
          <MembershipRowList>
            {filteredInListKeys.map((itemKey) => {
              const member = members.find((row) => rxGroupListMemberKey(row) === itemKey);
              const option = optionByKey.get(itemKey);
              if (!member || !option) return null;
              const showSlot = memberSupportsTimeSlotOverride(member, library);
              return (
                <SortableMembershipRow
                  key={itemKey}
                  itemKey={itemKey}
                  disabled={filterActive}
                  label={option.name}
                  subtitle={String(option.digitalId || '—')}
                  pills={<Pill tone="neutral">{kindLabel(option.ref.kind)}</Pill>}
                  checked={inListSelected.includes(itemKey)}
                  onCheck={() => toggleInList(itemKey)}
                  onRemove={() => removeKeys([itemKey])}
                  trailing={
                    showSlot ? (
                      <SegmentedControl
                        options={[...TIMESLOT_OPTIONS]}
                        value={timeslotSegmentValue(member)}
                        onChange={(value) => setMemberTimeslot(itemKey, value)}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </MembershipRowList>
        </DataTableBulkReorderSortable>
      </DataTableBulkReorderProvider>
    </MembershipPanel>
  );
}

export function RxGroupListAddOverlay({
  open,
  listName,
  onCancel,
  onCommit,
  talkGroups,
  digitalContacts,
  members,
  onChange,
}: {
  open: boolean;
  listName: string;
  onCancel: () => void;
  onCommit: () => void;
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  members: RxGroupListMember[];
  onChange: (members: RxGroupListMember[]) => void;
}) {
  const [activeSectionId, setActiveSectionId] = useState<AddSectionId>('talkGroups');
  const [search, setSearch] = useState('');
  const [staged, setStaged] = useState<string[]>([]);

  const selectedRefKeys = useMemo(
    () => new Set(members.map((member) => rxGroupListMemberKey(member))),
    [members],
  );

  const filterLower = search.trim().toLowerCase();
  const availableTalkGroups = useMemo(
    () =>
      buildTalkGroupOptions(talkGroups).filter(
        (o) =>
          !selectedRefKeys.has(o.key) &&
          memberOptionMatchesFilter(o.name, o.digitalId, filterLower),
      ),
    [talkGroups, selectedRefKeys, filterLower],
  );
  const availableDigitalContacts = useMemo(
    () =>
      buildDigitalContactOptions(digitalContacts).filter(
        (o) =>
          !selectedRefKeys.has(o.key) &&
          memberOptionMatchesFilter(o.name, o.digitalId, filterLower),
      ),
    [digitalContacts, selectedRefKeys, filterLower],
  );

  const sections = ADD_SECTIONS.map((section) => ({
    ...section,
    count:
      section.id === 'talkGroups' ? availableTalkGroups.length : availableDigitalContacts.length,
  }));

  const toggleStaged = (key: string) => {
    setStaged((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const commit = () => {
    const optionByKey = new Map(
      [...buildTalkGroupOptions(talkGroups), ...buildDigitalContactOptions(digitalContacts)].map(
        (o) => [o.key, o],
      ),
    );
    const toAdd = staged
      .map((key) => optionByKey.get(key)?.ref)
      .filter(
        (ref): ref is EntityRef =>
          ref != null && !selectedRefKeys.has(rxGroupListMemberKey({ ref })),
      )
      .map((ref) => ({ ref }));
    if (!toAdd.length) return;
    onChange([...members, ...toAdd]);
    setStaged([]);
    setSearch('');
    onCommit();
  };

  const poolRows =
    activeSectionId === 'talkGroups'
      ? availableTalkGroups.map((option) => (
          <MembershipPoolRow
            key={option.key}
            checked={staged.includes(option.key)}
            onCheck={() => toggleStaged(option.key)}
            label={option.name}
            subtitle={`TG ${option.digitalId || '—'}`}
          />
        ))
      : availableDigitalContacts.map((option) => (
          <MembershipPoolRow
            key={option.key}
            checked={staged.includes(option.key)}
            onCheck={() => toggleStaged(option.key)}
            label={option.name}
            subtitle={`ID ${option.digitalId || '—'}`}
          />
        ));

  return (
    <AddMembersScreen
      open={open}
      title={`Add to ${listName}`}
      onCancel={() => {
        setStaged([]);
        setSearch('');
        onCancel();
      }}
      sections={sections}
      activeSectionId={activeSectionId}
      onSectionChange={(id) => setActiveSectionId(id as AddSectionId)}
      search={{ value: search, onChange: setSearch, placeholder: 'Find…' }}
      totalStaged={staged.length}
      onCommit={commit}
    >
      {poolRows.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--dsv2-text-tertiary)', margin: 0 }}>
          No candidates available
        </p>
      ) : (
        poolRows
      )}
    </AddMembersScreen>
  );
}
