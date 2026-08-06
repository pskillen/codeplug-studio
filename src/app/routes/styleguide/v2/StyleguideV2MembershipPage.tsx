import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import {
  AddMembersScreen,
  Button,
  MembershipPanel,
  MembershipPoolRow,
  MembershipRow,
} from '../../../components/v2/index.ts';

interface DemoMember {
  id: string;
  label: string;
  subtitle: string;
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

export default function StyleguideV2MembershipPage() {
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
    <Page width="default">
      <PageHeader
        title="Membership"
        description={
          <>
            <Link to="/styleguide/v2">← Design system v2</Link> — the members-first list +
            full-screen add takeover family that supersedes ShuttleList.
          </>
        }
      />

      <PageSection
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
      </PageSection>

      <PageSection
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
          {filtered.map((member) => (
            <MembershipRow
              key={member.id}
              label={member.label}
              subtitle={member.subtitle}
              checked={selected.includes(member.id)}
              onCheck={() => toggle(member.id)}
              onRemove={() => setMembers((prev) => prev.filter((m) => m.id !== member.id))}
            />
          ))}
        </MembershipPanel>
      </PageSection>

      <PageSection
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
      </PageSection>

      <PageSection
        title="MembershipPanel — reorder-only, no pool"
        description="onAdd omitted: no Add button, no pool affordance — the build's zone-member-order shape."
      >
        <MembershipPanel title="Wire order">
          {members.map((member) => (
            <MembershipRow key={member.id} label={member.label} subtitle={member.subtitle} />
          ))}
        </MembershipPanel>
      </PageSection>

      <PageSection
        title="AddMembersScreen"
        description="Full-screen picker takeover triggered by MembershipPanel's + Add members above."
      >
        <Button variant="secondary" size="sm" onClick={() => setAddScreenOpen(true)}>
          Open AddMembersScreen
        </Button>
      </PageSection>

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
    </Page>
  );
}
