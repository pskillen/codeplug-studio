import { useMemo } from 'react';
import { useHotkeys, useMediaQuery } from '@mantine/hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Channel, Library } from '@core/models/library.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { resolveChannelPrimaryMode } from '@core/domain/modeProfiles.ts';
import { zonesWithEffectiveChannelMembership } from '@core/domain/zoneMembership.ts';
import { channelStatusInBuild, type ChannelBuildStatus } from '@core/domain/channelEligibility.ts';
import { channelHasGeolocation } from '@core/domain/mapProjection.ts';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import {
  compassOctant,
  formatDistanceKmAndMi,
  pathMetricsBetween,
} from '@core/domain/geoDistance.ts';
import { radioTargetFor } from '@core/radio-targets/index.ts';
import CodeplugMap from '../../components/CodeplugMap/CodeplugMap.tsx';
import UseMyLocationButton from '../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import ChannelDeleteButton from '../../components/library/ChannelDeleteButton.tsx';
import ChannelDuplicateButton from '../../components/library/ChannelDuplicateButton.tsx';
import ChannelDirectoryVerifyActions from '../../components/repeaters/ChannelDirectoryVerifyActions.tsx';
import { BandPillForChannel } from '../../components/pills/BandPill.tsx';
import {
  Button,
  DesignSystemV2Provider,
  EditorHeader,
  EmptyState,
  Panel,
  Pill,
} from '../../components/v2/index.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { channelEditPath } from '../../lib/channelPaths.ts';
import { getModeDefinition } from '../../lib/channelModes.ts';
import { formatFrequencyHz, formatMhzNumber } from '../../lib/formatFrequency.ts';
import { formatAprsAssignmentSummary } from '../../lib/aprsBindingHelpers.ts';
import { useOperatorPosition, type OperatorPosition } from '../../state/operatorPosition.tsx';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { DSV2_TOKENS } from '../../theme-v2.ts';
import {
  modeProfileFacts,
  modeProfileRxGroupListId,
  type ChannelFact,
} from './channelView/modeProfileFacts.ts';
import RxGroupListBrief from './channelView/RxGroupListBrief.tsx';
import classes from './ChannelViewPage.module.css';

/** Read-first channel page (#1533): what is set, where it is, and where it is used. */
export default function ChannelViewPage() {
  const { channelId } = useParams();
  const { library, loading, projectId } = useLibrary();
  const channel = library.channels.find((c) => c.id === channelId) ?? null;

  if (loading) {
    return (
      <DesignSystemV2Provider>
        <p className={classes.loading}>Loading…</p>
      </DesignSystemV2Provider>
    );
  }

  if (!channel || !projectId) {
    return (
      <DesignSystemV2Provider>
        <div className={classes.root}>
          <EditorHeader crumb="Channels" crumbTo="/library/channels" title="Channel not found" />
          <div className={classes.body}>
            <EmptyState
              title="Channel not found"
              description="It may have been deleted, or the link belongs to another project."
            />
          </div>
        </div>
      </DesignSystemV2Provider>
    );
  }

  return <ChannelView key={channel.id} channel={channel} library={library} projectId={projectId} />;
}

function ChannelView({
  channel,
  library,
  projectId,
}: {
  channel: Channel;
  library: Library;
  projectId: string;
}) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY) ?? false;
  const { position, setPosition } = useOperatorPosition();
  const { builds } = useFormatBuilds();
  const editPath = channelEditPath(channel.id);

  useHotkeys([['e', () => navigate(editPath)]]);

  const callsign = channel.callsign.trim();
  const name = channel.name.trim();
  const modes = channel.modeProfiles.map((p) => p.mode);
  const primary = modes.length > 1 ? resolveChannelPrimaryMode(channel) : null;
  const details = detailFacts(channel, library);

  return (
    <DesignSystemV2Provider>
      <div className={[classes.root, isMobile ? classes.compact : ''].join(' ')}>
        <EditorHeader
          crumb="Channels"
          crumbTo="/library/channels"
          compact={isMobile}
          title={
            callsign ? (
              <>
                <span className={classes.callsign}>{callsign}</span>
                {name ? <span className={classes.titleName}>&nbsp;· {name}</span> : null}
              </>
            ) : (
              name || 'Untitled channel'
            )
          }
        />

        <div className={classes.actions}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(editPath)}
            title="Edit (E)"
            aria-keyshortcuts="E"
          >
            Edit
          </Button>
          <ChannelDuplicateButton projectId={projectId} getSource={() => channel} />
          <ChannelDeleteButton channel={channel} onDeleted={() => navigate('/library/channels')} />
        </div>

        <div className={classes.body}>
          <section className={classes.hero} aria-label="Frequency and modes">
            <FrequencySummary channel={channel} />
            <div className={classes.heroPills}>
              <BandPillForChannel channel={channel} size="sm" />
              {modes.map((mode) => {
                const def = getModeDefinition(mode);
                return (
                  <Pill
                    key={mode}
                    tone="semantic"
                    color={def.color}
                    textColor={
                      mode === 'dstar' || mode === 'dmr' || mode === 'tetra'
                        ? DSV2_TOKENS.colors.pillTextLight
                        : undefined
                    }
                  >
                    {primary === mode ? `${def.label} (primary)` : def.label}
                  </Pill>
                );
              })}
            </div>
            {channel.comment.trim() ? (
              <p className={classes.comment}>{channel.comment.trim()}</p>
            ) : null}
          </section>

          <div className={classes.grid}>
            <div className={classes.column}>
              {channel.modeProfiles.map((profile) => {
                const facts = modeProfileFacts(profile, library);
                const rxGroupListId = modeProfileRxGroupListId(profile);
                const label = getModeDefinition(profile.mode).label;
                return (
                  <Panel key={profile.mode} title={label}>
                    {facts.length > 0 ? <FactList facts={facts} /> : null}
                    {rxGroupListId ? (
                      <RxGroupListBrief listId={rxGroupListId} library={library} />
                    ) : null}
                    {facts.length === 0 && !rxGroupListId ? (
                      <p className={classes.muted}>No {label} settings set.</p>
                    ) : null}
                  </Panel>
                );
              })}

              {details.length > 0 ? (
                <Panel title="Details">
                  <FactList facts={details} />
                </Panel>
              ) : null}

              <ZonesPanel channel={channel} library={library} />
              <BuildsPanel channel={channel} builds={builds} />
            </div>

            <div className={classes.column}>
              <LocationPanel
                channel={channel}
                position={position}
                onPosition={(lat, lon, accuracyMeters) =>
                  setPosition({ lat, lon, accuracyMeters: accuracyMeters ?? null })
                }
                isMobile={isMobile}
                editPath={editPath}
              />

              <Panel
                title="Directory"
                collapsible
                defaultCollapsed
                summary={callsign ? `Check ${callsign} against public directories` : 'No callsign'}
              >
                {/* The dialog persists the patch itself; the library reload re-renders this page. */}
                <ChannelDirectoryVerifyActions channel={channel} onApplyAndSave={() => {}} />
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </DesignSystemV2Provider>
  );
}

function FrequencySummary({ channel }: { channel: Channel }) {
  const rx = channel.rxFrequency;
  const tx = channel.txFrequency;
  if (rx == null && tx == null) {
    return <p className={classes.frequency}>No frequency set</p>;
  }
  if (rx != null && (tx == null || tx === rx)) {
    return (
      <div>
        <p className={classes.frequency}>{formatFrequencyHz(rx)}</p>
        <p className={classes.frequencySub}>{tx == null ? 'Receive only' : 'Simplex'}</p>
      </div>
    );
  }
  const offsetMhz = rx != null && tx != null ? (tx - rx) / 1_000_000 : null;
  return (
    <div>
      <p className={classes.frequency}>
        {rx != null ? formatFrequencyHz(rx) : '—'}
        <span className={classes.frequencyLabel}> RX</span>
      </p>
      <p className={classes.frequencySub}>
        TX {tx != null ? formatFrequencyHz(tx) : '—'}
        {offsetMhz != null
          ? ` · ${offsetMhz > 0 ? '+' : '−'}${formatMhzNumber(Math.abs(offsetMhz))} MHz offset`
          : null}
      </p>
    </div>
  );
}

function FactList({ facts }: { facts: ChannelFact[] }) {
  if (facts.length === 0) return <p className={classes.muted}>Nothing extra set.</p>;
  return (
    <dl className={classes.facts}>
      {facts.map((fact) => (
        <div key={fact.label} className={classes.fact}>
          <dt>{fact.label}</dt>
          <dd className={fact.mono ? classes.mono : undefined}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Library-level settings, shown only when they differ from the defaults. */
function detailFacts(channel: Channel, library: Library): ChannelFact[] {
  const facts: ChannelFact[] = [];
  if (channel.abbreviation?.trim()) {
    facts.push({ label: 'Abbreviation', value: channel.abbreviation.trim() });
  }
  if (channel.power != null) facts.push({ label: 'Power', value: `${channel.power}%` });
  if (channel.forbidTransmit === 'forbid') facts.push({ label: 'Transmit', value: 'RX only' });
  if (channel.forbidTransmit === 'allow') facts.push({ label: 'Transmit', value: 'Allowed' });
  if (channel.txPermit === 'busyLock') facts.push({ label: 'TX permit', value: 'Busy lock' });
  if (channel.txPermit === 'permitAlways')
    facts.push({ label: 'TX permit', value: 'Permit always' });
  if (channel.scanInclusion === 'skip') facts.push({ label: 'Scan', value: 'Skipped' });
  if (channel.scanInclusion === 'alwaysScan')
    facts.push({ label: 'Scan', value: 'Always scanned' });
  const scanList = channel.scanListId
    ? library.scanLists.find((list) => list.id === channel.scanListId)
    : undefined;
  if (scanList) facts.push({ label: 'Scan list', value: scanList.name });
  if (channel.aprs && library.aprsConfiguration) {
    facts.push({
      label: 'APRS',
      value: formatAprsAssignmentSummary(
        channel.aprs,
        library.aprsConfiguration.channelSlots,
        library.channels,
      ),
    });
  }
  if (channel.hideFromInternalMap) facts.push({ label: 'Map', value: 'Hidden from maps' });
  return facts;
}

function LocationPanel({
  channel,
  position,
  onPosition,
  isMobile,
  editPath,
}: {
  channel: Channel;
  position: OperatorPosition | null;
  onPosition: (lat: number, lon: number, accuracyMeters?: number | null) => void;
  isMobile: boolean;
  editPath: string;
}) {
  const located = channelHasGeolocation(channel) && channel.location != null;
  const channels = useMemo(() => [channel], [channel]);

  if (!located) {
    return (
      <Panel title="Location">
        <p className={classes.muted}>
          {channel.maidenheadLocator
            ? `Locator ${channel.maidenheadLocator}, not placed on the map.`
            : 'No location set.'}{' '}
          <Link to={`${editPath}#location`}>Set a location</Link>
        </p>
      </Panel>
    );
  }

  const location = channel.location!;
  const metrics = position ? pathMetricsBetween(position, location) : null;
  const bearing = metrics ? Math.round(metrics.bearingAB) % 360 : null;

  return (
    <Panel title="Location">
      <div className={classes.map}>
        <CodeplugMap
          channels={channels}
          highlightChannelId={channel.id}
          operatorPosition={position}
          distanceLine={
            position && metrics
              ? { from: position, to: location, label: formatDistanceKmAndMi(metrics.distanceM) }
              : null
          }
          showControls={false}
          defaultShowZones={false}
          height={isMobile ? 'clamp(220px, 35dvh, 300px)' : 'clamp(280px, 40dvh, 420px)'}
        />
      </div>
      {metrics && bearing != null ? (
        <p className={classes.distance}>
          <strong>{formatDistanceKmAndMi(metrics.distanceM)}</strong> from you, bearing{' '}
          <strong>
            {String(bearing).padStart(3, '0')}° {compassOctant(metrics.bearingAB)}
          </strong>
        </p>
      ) : (
        <div className={classes.distanceAction}>
          <UseMyLocationButton onLocation={onPosition} label="How far is this from me?" />
        </div>
      )}
      <FactList
        facts={[
          {
            label: 'Locator',
            value: channel.maidenheadLocator || coordsToLocator(location.lat, location.lon, 6),
            mono: true,
          },
          {
            label: 'Coordinates',
            value: `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`,
            mono: true,
          },
        ]}
      />
    </Panel>
  );
}

function ZonesPanel({ channel, library }: { channel: Channel; library: Library }) {
  const memberships = zonesWithEffectiveChannelMembership(channel.id, library);
  return (
    <Panel title="Zones">
      {memberships.length === 0 ? (
        <p className={classes.muted}>Not in any zone.</p>
      ) : (
        <ul className={classes.linkList}>
          {memberships.map((m) => (
            <li key={m.zone.id}>
              <Link to={`/library/zones/${m.zone.id}`}>{m.zone.name || 'Untitled zone'}</Link>
              {!m.direct && m.viaNestedZoneName ? (
                <span className={classes.muted}> · via {m.viaNestedZoneName}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const BUILD_STATUS_LABEL: Record<Exclude<ChannelBuildStatus['kind'], 'included'>, string> = {
  excluded: 'Excluded in this build',
  'unsupported-mode': 'Radio does not support its mode',
  'out-of-range': 'Outside the radio’s frequency range',
};

function BuildsPanel({ channel, builds }: { channel: Channel; builds: RadioBuild[] }) {
  if (builds.length === 0) {
    return (
      <Panel title="Builds">
        <p className={classes.muted}>No builds in this project yet.</p>
      </Panel>
    );
  }
  return (
    <Panel title="Builds">
      <ul className={classes.linkList}>
        {builds.map((build) => {
          const status = channelStatusInBuild(channel, build);
          const radio = radioTargetFor(build.radioTargetId)?.label;
          return (
            <li key={build.id} className={classes.buildRow}>
              <span>
                <Link to={`/builds/${build.id}/channels`}>{build.name}</Link>
                {radio && radio !== build.name ? (
                  <span className={classes.muted}> · {radio}</span>
                ) : null}
              </span>
              {status.kind === 'included' ? (
                <span className={classes.included}>
                  Included{status.wireName ? ` as ${status.wireName}` : ''}
                </span>
              ) : (
                <span className={classes.muted}>{BUILD_STATUS_LABEL[status.kind]}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
