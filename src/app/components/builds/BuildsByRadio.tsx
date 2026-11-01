import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import {
  egressSummary,
  groupBuildsByRadio,
  radioTargetForModelFirmware,
  type BuildModelGroup,
} from '@core/radio-targets/index.ts';
import { Button } from '../v2/index.ts';
import { FirmwareKindPill, RadioClassPill } from './RadioModelPills.tsx';
import classes from './BuildsByRadio.module.css';

export interface BuildsByRadioProps {
  builds: readonly RadioBuild[];
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function newBuildHref(targetId: string): string {
  return `/builds/new?target=${encodeURIComponent(targetId)}`;
}

function Caret({ open }: { open: boolean }) {
  return open ? (
    <IconChevronDown size={14} stroke={2} aria-hidden />
  ) : (
    <IconChevronRight size={14} stroke={2} aria-hidden />
  );
}

function BuildRow({ build, summary }: { build: RadioBuild; summary: string }) {
  const updated = new Date(build.updatedAt).toLocaleString();
  return (
    <div className={classes.build}>
      <div className={classes.buildName}>
        <Link to={`/builds/${build.id}/export`} className={classes.buildLink}>
          {build.name}
        </Link>
        <small className={classes.buildSummary}>{summary}</small>
      </div>
      <div className={classes.buildUpdated}>Updated {updated}</div>
      <Link to={`/builds/${build.id}/export`} className={classes.open}>
        Open
      </Link>
    </div>
  );
}

function ModelCard({
  group,
  collapsed,
  onToggle,
}: {
  group: BuildModelGroup<RadioBuild>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { model } = group;
  // A model with a single exportable firmware gets a header "+ New" for that target;
  // multi-firmware models get a "+ Another <firmware> build" row per firmware group.
  const modelTargets = model
    ? model.firmware
        .map((fw) => radioTargetForModelFirmware(model.id, fw.id))
        .filter((t) => t != null)
    : [];
  const headerTarget = modelTargets.length === 1 ? modelTargets[0] : undefined;
  const onlyFirmware = group.firmware.length === 1 ? group.firmware[0] : undefined;
  const showFirmwareHeaders = group.firmware.length > 1 || onlyFirmware?.firmware.kind !== 'stock';

  return (
    <div className={classes.model}>
      <div className={classes.modelHead}>
        <button
          type="button"
          className={classes.toggle}
          aria-expanded={!collapsed}
          aria-label={`${group.label} builds`}
          onClick={onToggle}
        >
          <Caret open={!collapsed} />
          <span className={classes.modelName}>{group.label}</span>
        </button>
        {model ? <RadioClassPill radioClass={model.radioClass} /> : null}
        {onlyFirmware && !showFirmwareHeaders ? (
          <FirmwareKindPill kind={onlyFirmware.firmware.kind} />
        ) : null}
        <span className={classes.muted}>
          ·{' '}
          {group.firmware.length > 1
            ? `${plural(group.buildCount, 'build', 'builds')} on ${group.firmware.length} firmwares`
            : plural(group.buildCount, 'build', 'builds')}
        </span>
        <span className={classes.spacer} />
        {headerTarget ? (
          <Link to={newBuildHref(headerTarget.id)} className={classes.add}>
            + New
          </Link>
        ) : null}
      </div>

      {collapsed
        ? null
        : group.firmware.map((fw) => (
            <div key={fw.key} className={classes.fw}>
              {showFirmwareHeaders ? (
                <div className={classes.fwHead}>
                  <span className={classes.fwLabel}>{fw.firmware.label}</span>
                  <FirmwareKindPill kind={fw.firmware.kind} />
                  <span className={classes.muted}>
                    · {plural(fw.builds.length, 'build', 'builds')}
                  </span>
                </div>
              ) : null}
              {fw.builds.map((build) => (
                <BuildRow
                  key={build.id}
                  build={build}
                  summary={fw.target ? egressSummary(fw.target) : build.radioTargetId}
                />
              ))}
              {fw.target && !headerTarget ? (
                <Link to={newBuildHref(fw.target.id)} className={classes.addRow}>
                  + Another {fw.firmware.label} build
                </Link>
              ) : null}
            </div>
          ))}
    </div>
  );
}

/**
 * Builds grouped manufacturer → model → firmware → instances, with collapsible
 * manufacturers and models. Grouping is derived from each build's `radioTargetId`.
 */
export default function BuildsByRadio({ builds }: BuildsByRadioProps) {
  const groups = useMemo(() => groupBuildsByRadio(builds), [builds]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  const allKeys = useMemo(
    () => groups.flatMap((g) => [g.key, ...g.models.map((m) => m.key)]),
    [groups],
  );
  const allCollapsed = allKeys.length > 0 && allKeys.every((k) => collapsed.has(k));

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (groups.length === 0) return null;

  return (
    <div className={classes.root}>
      <div className={classes.bar}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allKeys))}
        >
          {allCollapsed ? 'Expand all' : 'Collapse all'}
        </Button>
      </div>
      {groups.map((mfr) => {
        const mfrCollapsed = collapsed.has(mfr.key);
        return (
          <section key={mfr.key} className={classes.mfr}>
            <button
              type="button"
              className={classes.mfrHead}
              aria-expanded={!mfrCollapsed}
              aria-label={`${mfr.manufacturer} builds`}
              onClick={() => toggle(mfr.key)}
            >
              <Caret open={!mfrCollapsed} />
              <b>{mfr.manufacturer}</b>
              <span className={classes.muted}>
                {plural(mfr.buildCount, 'build', 'builds')}
                {mfrCollapsed ? ` · ${mfr.models.map((m) => m.label).join(', ')}` : ''}
              </span>
            </button>
            {mfrCollapsed
              ? null
              : mfr.models.map((model) => (
                  <ModelCard
                    key={model.key}
                    group={model}
                    collapsed={collapsed.has(model.key)}
                    onToggle={() => toggle(model.key)}
                  />
                ))}
          </section>
        );
      })}
    </div>
  );
}
