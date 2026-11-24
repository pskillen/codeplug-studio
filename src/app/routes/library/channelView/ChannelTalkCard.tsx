import { IconChevronDown } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import type { Channel, ChannelModeProfile, Library } from '@core/models/library.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import type { ChannelModeSummary } from '../../../lib/channelModeSummary.ts';
import { modeLabel, modeColor } from '../../../lib/channelModes.ts';
import ModeSummaryChip from '../../../components/channels/ModeSummaryChip.tsx';
import { Pill } from '../../../components/v2/index.ts';
import { DSV2_TOKENS } from '../../../theme-v2.ts';
import { modeTalk, type TalkPart } from './modeTalk.ts';
import { modeProfileRxGroupListId } from './modeProfileFacts.ts';
import RxGroupListBrief from './RxGroupListBrief.tsx';
import classes from '../ChannelViewPage.module.css';

export interface ChannelTalkCardProps {
  profile: ChannelModeProfile;
  channel: Channel;
  library: Library;
  isMain: boolean;
  editPath: string;
  modeCount: number;
}

function modePillTextColor(mode: ChannelModeProfile['mode']): string | undefined {
  return mode === 'dstar' || mode === 'dmr' || mode === 'tetra'
    ? DSV2_TOKENS.colors.pillTextLight
    : undefined;
}

function modeEditorHash(mode: ChannelModeProfile['mode'], modeCount: number): string {
  return modeCount === 1 ? '#mode' : `#mode-${mode}`;
}

function Sentence({ parts }: { parts: TalkPart[] }) {
  return (
    <p className={classes.talkSentence}>
      {parts.map((part, index) =>
        part.strong ? (
          <strong key={index}>{part.text}</strong>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function TalkCardBody({
  profile,
  channel,
  library,
  editPath,
  modeCount,
}: Pick<ChannelTalkCardProps, 'profile' | 'channel' | 'library' | 'editPath' | 'modeCount'>) {
  const talk = modeTalk(profile, channel, library);
  const rxGroupListId = modeProfileRxGroupListId(profile);
  const hash = modeEditorHash(profile.mode, modeCount);

  return (
    <>
      <Sentence parts={talk.sentence} />
      {talk.empty ? (
        <p className={classes.muted}>
          <Link to={`${editPath}${hash}`}>Edit</Link>
        </p>
      ) : null}
      {talk.facts.length > 0 ? (
        <ul className={classes.talkFacts}>
          {talk.facts.map((fact) => (
            <li key={fact.key}>
              <span className={classes.talkFactLabel}>{fact.label}</span>{' '}
              <span className={fact.mono ? classes.mono : undefined}>{fact.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {rxGroupListId ? <RxGroupListBrief listId={rxGroupListId} library={library} /> : null}
    </>
  );
}

function TalkModeHeader({
  label,
  color,
  mode,
  isMain,
}: {
  label: string;
  color: string;
  mode: ChannelModeProfile['mode'];
  isMain: boolean;
}) {
  return (
    <div className={classes.talkCardHeader}>
      <Pill tone="semantic" color={color} textColor={modePillTextColor(mode)}>
        {label}
      </Pill>
      {isMain ? <Pill tone="accent">Main mode</Pill> : null}
    </div>
  );
}

export function ChannelTalkCard({
  profile,
  channel,
  library,
  isMain,
  editPath,
  modeCount,
}: ChannelTalkCardProps) {
  const label = modeLabel(profile.mode);
  const color = modeColor(profile.mode);

  return (
    <section className={classes.talkCard} aria-label={label}>
      <TalkModeHeader label={label} color={color} mode={profile.mode} isMain={isMain} />
      <TalkCardBody
        profile={profile}
        channel={channel}
        library={library}
        editPath={editPath}
        modeCount={modeCount}
      />
    </section>
  );
}

export interface ChannelTalkRowProps extends ChannelTalkCardProps {
  summary: ChannelModeSummary;
}

export function ChannelTalkRow(props: ChannelTalkRowProps) {
  const { summary, isMain, profile, channel, library, editPath, modeCount } = props;

  return (
    <details className={classes.talkRow}>
      <summary className={classes.talkRowSummary}>
        <ModeSummaryChip summary={summary} size="sm" />
        {isMain ? <Pill tone="accent">Main mode</Pill> : null}
        <IconChevronDown
          size={ICON_SIZE_NAV}
          stroke={ICON_STROKE}
          aria-hidden
          className={classes.talkRowChevron}
        />
      </summary>
      <div className={classes.talkRowBody}>
        <TalkCardBody
          profile={profile}
          channel={channel}
          library={library}
          editPath={editPath}
          modeCount={modeCount}
        />
      </div>
    </details>
  );
}
