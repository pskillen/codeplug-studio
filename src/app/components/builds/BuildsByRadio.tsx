import { Fragment, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { groupBuildsByRadio, type BuildModelGroup } from '@core/radio-targets/index.ts';
import { FirmwareLabelPill, RadioClassPill } from './RadioModelPills.tsx';
import { buildTransferPaths, searchTokens } from './buildsSearch.ts';
import classes from './BuildsByRadio.module.css';

export interface BuildsByRadioProps {
  builds: readonly RadioBuild[];
  /** Search words to highlight in names and transfer paths. */
  query?: string;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 days ago" style label; "just now" under a minute. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);
  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (abs >= size) return fmt.format(Math.trunc(seconds / size), unit);
  }
  return 'just now';
}

/** Wrap every occurrence of a search token in <mark>. */
function Highlight({ text, tokens }: { text: string; tokens: readonly string[] }) {
  if (tokens.length === 0 || !text) return <>{text}</>;
  const low = text.toLowerCase();
  const on = new Array<boolean>(text.length).fill(false);
  for (const tk of tokens) {
    let i = low.indexOf(tk);
    while (i >= 0) {
      for (let j = i; j < i + tk.length; j += 1) on[j] = true;
      i = low.indexOf(tk, i + 1);
    }
  }
  const parts: { text: string; mark: boolean }[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const last = parts[parts.length - 1];
    if (last && last.mark === on[i]) last.text += text[i];
    else parts.push({ text: text[i], mark: on[i] });
  }
  return (
    <>
      {parts.map((p, i) =>
        p.mark ? <mark key={i}>{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>,
      )}
    </>
  );
}

function BuildRow({
  build,
  firmware,
  tokens,
}: {
  build: RadioBuild;
  firmware: BuildModelGroup<RadioBuild>['firmware'][number]['firmware'] | undefined;
  tokens: readonly string[];
}) {
  const paths = buildTransferPaths(build);
  return (
    <Link to={`/builds/${build.id}/export`} className={classes.build}>
      <span className={classes.buildName}>
        <Highlight text={build.name} tokens={tokens} />
      </span>
      <time
        className={classes.buildTime}
        dateTime={build.updatedAt}
        title={`Updated ${new Date(build.updatedAt).toLocaleString()}`}
      >
        {relativeTime(build.updatedAt)}
      </time>
      <span className={classes.buildMeta}>
        {firmware ? <FirmwareLabelPill firmware={firmware} /> : null}
        {paths ? (
          <span className={classes.buildPaths}>
            <Highlight text={paths} tokens={tokens} />
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function ModelCard({
  group,
  tokens,
}: {
  group: BuildModelGroup<RadioBuild>;
  tokens: readonly string[];
}) {
  const { model } = group;
  return (
    <article className={classes.card} aria-label={`${group.label} builds`}>
      <header className={classes.cardHead}>
        <h3 className={classes.modelName}>{group.label}</h3>
        {model ? <RadioClassPill radioClass={model.radioClass} /> : null}
        <span className={classes.count}>{plural(group.buildCount, 'build', 'builds')}</span>
      </header>
      {/* Firmware groups are already in catalog order (stock first), builds by name. */}
      {group.firmware.flatMap((fw) =>
        fw.builds.map((build) => (
          <BuildRow
            key={build.id}
            build={build}
            firmware={fw.target ? fw.firmware : undefined}
            tokens={tokens}
          />
        )),
      )}
    </article>
  );
}

/**
 * Builds as one card per radio model under a manufacturer heading. Each build is a
 * single link row that opens it. Grouping and ordering come from `groupBuildsByRadio`.
 */
export default function BuildsByRadio({ builds, query = '' }: BuildsByRadioProps) {
  const groups = useMemo(() => groupBuildsByRadio(builds), [builds]);
  const tokens = useMemo(() => searchTokens(query), [query]);

  if (groups.length === 0) return null;

  return (
    <div className={classes.root}>
      {groups.map((mfr) => (
        <section key={mfr.key} className={classes.mfr} aria-label={`${mfr.manufacturer} builds`}>
          <h2 className={classes.mfrHead}>
            {mfr.manufacturer}
            <small>{plural(mfr.buildCount, 'build', 'builds')}</small>
          </h2>
          <div className={classes.grid}>
            {mfr.models.map((model) => (
              <ModelCard key={model.key} group={model} tokens={tokens} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
