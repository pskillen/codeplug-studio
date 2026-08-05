import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import { MembershipPanel, MembershipRow } from '../../../components/v2/index.ts';

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

export default function StyleguideV2MembershipPage() {
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');

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
          onAdd={() => undefined}
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
        title="MembershipPanel — reorder-only, no pool"
        description="onAdd omitted: no Add button, no pool affordance — the build's zone-member-order shape."
      >
        <MembershipPanel title="Wire order">
          {members.map((member) => (
            <MembershipRow key={member.id} label={member.label} subtitle={member.subtitle} />
          ))}
        </MembershipPanel>
      </PageSection>
    </Page>
  );
}
