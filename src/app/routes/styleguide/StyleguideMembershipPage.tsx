import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { StyleguidePageShell, StyleguideSection } from './StyleguidePageShell.tsx';
import {
  AddMembersScreen,
  Button,
  MembershipPanel,
  MembershipPoolRow,
  MembershipRow,
} from '../../components/v2/index.ts';
import {
  DataTableBulkReorderProvider,
  DataTableBulkReorderSortable,
} from '../../lib/dataTable/DataTableBulkReorder.tsx';

interface DemoMember {
  id: string;
  label: string;
  subtitle: string;
}

/**
 * Demo-local wiring showing how a real consumer (#941–#943) drives
 * MembershipRow's drag handle: MembershipRow itself takes `dragHandleProps`
 * as an externally-supplied prop (same pattern as ShuttleRow), so the actual
 * dnd-kit `useSortable` call belongs to whatever list shell wraps it — here,
 * the styleguide page itself. Reuses the same generic
 * DataTableBulkReorderProvider/Sortable + useSortable pattern DataTable v2
 * uses, rather than inventing a second drag mechanism.
 */
function SortableMembershipRow({
  member,
  checked,
  onCheck,
  onRemove,
}: {
  member: DemoMember;
  checked?: boolean;
  onCheck?: () => void;
  onRemove?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : undefined,
      }}
    >
      <MembershipRow
        label={member.label}
        subtitle={member.subtitle}
        checked={checked}
        onCheck={onCheck}
        onRemove={onRemove}
        dragHandleProps={{ setActivatorNodeRef, attributes, listeners, disabled: false }}
      />
    </div>
  );
}

const INITIAL_MEMBERS: DemoMember[] = [
  { id: '1', label: 'GB3DA Stornoway', subtitle: '145.575 MHz' },
  { id: '2', label: 'GB3IV Inverness', subtitle: '145.175 MHz' },
  { id: '3', label: 'GB7GM Glasgow', subtitle: '145.6375 MHz' },
];

const POOL_CANDIDATES = [
  { id: 'p1', label: 'GB3ZA Aberdeen', subtitle: '145.6125 MHz' },
  { id: 'p2', label: 'GB3PZ Perth', subtitle: '145.7125 MHz' },
];

const ADD_SECTIONS = [
  { id: 'channels', label: 'Channels', count: POOL_CANDIDATES.length },
  { id: 'zones', label: 'Zones', count: 0 },
];

export default function StyleguideMembershipPage() {
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [addScreenOpen, setAddScreenOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState('channels');
  const [staged, setStaged] = useState<string[]>([]);
  const [addSearch, setAddSearch] = useState('');

  const filtered = members.filter((m) => m.label.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  };

  const moveSelected = (direction: 'up' | 'down') => {
    setMembers((prev) => {
      const next = [...prev];
      const indices = next.map((m, i) => (selected.includes(m.id) ? i : -1)).filter((i) => i >= 0);
      const ordered = direction === 'up' ? indices : [...indices].reverse();
      for (const i of ordered) {
        const swapWith = direction === 'up' ? i - 1 : i + 1;
        if (swapWith < 0 || swapWith >= next.length) continue;
        if (selected.includes(next[swapWith]!.id)) continue;
        [next[i], next[swapWith]] = [next[swapWith]!, next[i]!];
      }
      return next;
    });
  };

  const toggleStaged = (id: string) => {
    setStaged((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  };

  const commitStaged = () => {
    const added = POOL_CANDIDATES.filter((c) => staged.includes(c.id));
    setMembers((prev) => [...prev, ...added]);
    setStaged([]);
    setAddScreenOpen(false);
  };

  return (
    <StyleguidePageShell
      title="Membership"
      description="Members-first list and full-screen add takeover (supersedes legacy ShuttleList)."
    >
      <StyleguideSection
        title="MembershipRow"
        description="Card-style member row; checkbox, remove, and drag handle are implicit by prop presence."
      >
        <MembershipRow
          label="GB3DA Stornoway"
          subtitle="145.575 MHz"
          onCheck={() => undefined}
          checked
          onRemove={() => undefined}
        />
        <MembershipRow
          label="GB3IV Inverness"
          subtitle="145.175 MHz"
          onCheck={() => undefined}
          onRemove={() => undefined}
        />
      </StyleguideSection>

      <StyleguideSection
        title="MembershipPanel"
        description="Find filter, permanent Sort…, bulk move/clear toolbar."
      >
        <MembershipPanel
          title="Zone members"
          description={`${members.length} direct`}
          addLabel="Add members"
          onAdd={() => setAddScreenOpen(true)}
          search={{ value: search, onChange: setSearch }}
          onSortClick={() => undefined}
          selectedCount={selected.length}
          onBulkMoveUp={() => moveSelected('up')}
          onBulkMoveDown={() => moveSelected('down')}
          onBulkRemove={() => setSelected([])}
          onClearSelection={() => setSelected([])}
        >
          <DataTableBulkReorderProvider
            sortableKeys={search ? [] : members.map((m) => m.id)}
            orderedKeys={members.map((m) => m.id)}
            selectedKeys={selected}
            disabled={!!search}
            onSetOrder={(nextKeys) => {
              const byId = new Map(members.map((m) => [m.id, m]));
              setMembers(nextKeys.map((id) => byId.get(id)!));
            }}
          >
            <DataTableBulkReorderSortable
              sortableKeys={search ? [] : members.map((m) => m.id)}
              disabled={!!search}
            >
              {filtered.map((member) => (
                <SortableMembershipRow
                  key={member.id}
                  member={member}
                  checked={selected.includes(member.id)}
                  onCheck={() => toggle(member.id)}
                  onRemove={() => setMembers((prev) => prev.filter((m) => m.id !== member.id))}
                />
              ))}
            </DataTableBulkReorderSortable>
          </DataTableBulkReorderProvider>
        </MembershipPanel>
      </StyleguideSection>

      <StyleguideSection
        title="MembershipPoolRow"
        description="Add-candidate rows for AddMembersScreen, including a blocked-but-visible candidate."
      >
        <MembershipPoolRow label="Zone B" subtitle="12 channels" onCheck={() => undefined} />
        <MembershipPoolRow label="Zone C" subtitle="4 channels" checked onCheck={() => undefined} />
        <MembershipPoolRow
          label="Zone A (this zone)"
          disabled
          reason="This zone — cannot nest a zone in itself"
        />
      </StyleguideSection>

      <StyleguideSection
        title="MembershipPanel — reorder-only, no pool"
        description="onAdd omitted: no Add button, no pool affordance — the build's zone-member-order shape."
      >
        <MembershipPanel title="Wire order">
          <DataTableBulkReorderProvider
            sortableKeys={members.map((m) => m.id)}
            orderedKeys={members.map((m) => m.id)}
            selectedKeys={[]}
            onSetOrder={(nextKeys) => {
              const byId = new Map(members.map((m) => [m.id, m]));
              setMembers(nextKeys.map((id) => byId.get(id)!));
            }}
          >
            <DataTableBulkReorderSortable sortableKeys={members.map((m) => m.id)}>
              {members.map((member) => (
                <SortableMembershipRow key={member.id} member={member} />
              ))}
            </DataTableBulkReorderSortable>
          </DataTableBulkReorderProvider>
        </MembershipPanel>
      </StyleguideSection>

      <StyleguideSection
        title="AddMembersScreen"
        description="Full-screen picker takeover triggered by MembershipPanel's + Add members above."
      >
        <Button variant="secondary" size="sm" onClick={() => setAddScreenOpen(true)}>
          Open AddMembersScreen
        </Button>
      </StyleguideSection>

      <AddMembersScreen
        open={addScreenOpen}
        title="Add channels"
        onCancel={() => setAddScreenOpen(false)}
        sections={ADD_SECTIONS}
        activeSectionId={activeSectionId}
        onSectionChange={setActiveSectionId}
        search={{ value: addSearch, onChange: setAddSearch }}
        totalStaged={staged.length}
        onCommit={commitStaged}
      >
        {activeSectionId === 'channels' ? (
          POOL_CANDIDATES.filter((c) =>
            c.label.toLowerCase().includes(addSearch.toLowerCase()),
          ).map((candidate) => (
            <MembershipPoolRow
              key={candidate.id}
              label={candidate.label}
              subtitle={candidate.subtitle}
              checked={staged.includes(candidate.id)}
              onCheck={() => toggleStaged(candidate.id)}
            />
          ))
        ) : (
          <MembershipPoolRow
            label="Zone: Highlands (this zone)"
            disabled
            reason="This zone — cannot nest a zone in itself"
          />
        )}
      </AddMembersScreen>
    </StyleguidePageShell>
  );
}
