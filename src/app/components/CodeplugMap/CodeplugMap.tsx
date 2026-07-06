import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Anchor, Group } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import {
  DEFAULT_MAP_FILTER_OPTS,
  applyFilters,
  buildChannelById,
  channelDisplayLabel,
  channelModes,
  dominantMode,
  groupByCoords,
  markerDotSizePx,
  markerLabel,
  primaryMode,
  zoneGeolocatedPoints,
} from '@core/domain/mapProjection.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import { convexHullLatLon, uniqueLatLon, zoneColor, type LatLon } from '@core/domain/geo.ts';
import { collectMapPoints, computeMapView } from '@core/domain/mapView.ts';
import type { Channel, Zone } from '@core/models/library.ts';
import { modeColor, modeLabel } from '../../lib/channelModes.ts';
import { hzToMhzString } from '../../lib/units.ts';
import { useDocumentLayoutReady } from '../../hooks/useDocumentLayoutReady.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import { SETTINGS_MAP_SECTION_ID } from '../../lib/settingsSections.ts';
import MapControls, { type MapControlMode } from './MapControls.tsx';
import MaidenheadGridLayer from './MaidenheadGridLayer.tsx';
import './CodeplugMap.css';

type HullGeometry = 'circle' | 'line' | 'polygon' | 'none';

interface ZoneHullData {
  zone: Zone;
  index: number;
  points: LatLon[];
  missing: { name: string; reason: string }[];
  colors: ReturnType<typeof zoneColor>;
  shapeNote: string;
  geometry: HullGeometry;
  hull?: LatLon[];
}

interface OverlayHullData {
  key: string;
  label: string;
  points: LatLon[];
  colors: ReturnType<typeof zoneColor>;
  shapeNote: string;
  geometry: HullGeometry;
  hull?: LatLon[];
  variant: 'emphasis' | 'muted' | 'provisional';
}

const MUTED_HULL_STROKE = '#868e96';

function geometryFromPoints(
  points: LatLon[],
): Pick<OverlayHullData, 'geometry' | 'hull' | 'shapeNote'> {
  if (points.length === 0) {
    return { geometry: 'none', shapeNote: 'no geolocated members' };
  }
  if (points.length === 1) {
    return { geometry: 'circle', shapeNote: '1 point (circle)' };
  }
  if (points.length === 2) {
    return { geometry: 'line', shapeNote: '2 points (line)' };
  }
  const hull = convexHullLatLon(points);
  return {
    geometry: 'polygon',
    hull,
    shapeNote: `${hull.length} hull verts / ${points.length} sites`,
  };
}

function circleBoundsPoints(center: LatLon, radiusM: number): LatLon[] {
  const [lat, lon] = center;
  const latOffset = radiusM / 111_320;
  const lonScale = Math.cos((lat * Math.PI) / 180);
  const lonOffset = lonScale > 0 ? radiusM / (111_320 * lonScale) : 0;
  return [
    [lat + latOffset, lon],
    [lat - latOffset, lon],
    [lat, lon + lonOffset],
    [lat, lon - lonOffset],
  ];
}

function hullPathOptions(
  variant: OverlayHullData['variant'],
  colors: ReturnType<typeof zoneColor>,
): L.PathOptions {
  if (variant === 'muted') {
    return {
      color: MUTED_HULL_STROKE,
      fillColor: MUTED_HULL_STROKE,
      fillOpacity: 0.25,
      weight: 2,
      opacity: 0.60,
    };
  }
  const base: L.PathOptions = {
    color: colors.stroke,
    fillColor: colors.stroke,
    fillOpacity: 0.18,
    weight: 2,
    opacity: variant === 'provisional' ? 0.9 : 0.85,
  };
  if (variant === 'provisional') {
    base.dashArray = '8, 6';
  }
  return base;
}

function operatorDivIcon(): L.DivIcon {
  return L.divIcon({
    className: 'operator-marker-wrap',
    html: `<div class="operator-marker">
      <div class="operator-marker-dot"></div>
      <div class="operator-marker-label">You</div>
    </div>`,
    iconAnchor: [0, 0],
  });
}

function referenceDivIcon(): L.DivIcon {
  return L.divIcon({
    className: 'reference-marker-wrap',
    html: `<div class="reference-marker">
      <div class="reference-marker-dot"></div>
      <div class="reference-marker-label">Centre</div>
    </div>`,
    iconAnchor: [0, 0],
  });
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function channelDivIcon(
  color: string,
  label: string,
  stackCount: number,
  highlighted: boolean,
  dimmed: boolean,
): L.DivIcon {
  const size = markerDotSizePx(stackCount);
  const merged = stackCount > 1;
  const dimClass = dimmed ? ' dimmed' : '';
  return L.divIcon({
    className: 'channel-marker-wrap',
    html: `<div class="channel-marker">
      <div class="channel-marker-dot${merged ? ' merged' : ''}${highlighted ? ' highlighted' : ''}${dimClass}" style="background:${color};width:${size}px;height:${size}px"></div>
      <div class="channel-marker-label${dimClass}">${escapeHtml(label)}</div>
    </div>`,
    iconAnchor: [0, 0],
  });
}

function ChannelTooltipLines({ group }: { group: Channel[] }) {
  return (
    <>
      {group.map((ch) => (
        <div key={ch.id}>{channelDisplayLabel(ch, true)}</div>
      ))}
    </>
  );
}

function formatFreqPair(rx: number | null, tx: number | null): string {
  if (rx == null && tx == null) return '';
  const rxStr = rx != null ? hzToMhzString(rx) : '—';
  const txStr = tx != null ? hzToMhzString(tx) : '—';
  return `${rxStr} / ${txStr} MHz`;
}

function modeSummary(channel: Channel): string {
  return channelModes(channel)
    .map((m) => modeLabel(m))
    .join('+');
}

function ChannelPopup({
  group,
  onChannelClick,
}: {
  group: Channel[];
  onChannelClick?: (channelId: string) => void;
}) {
  const title =
    group.length === 1
      ? channelDisplayLabel(group[0], true)
      : `${group.length} channels at this location`;

  return (
    <div style={{ minWidth: 180, maxWidth: 280 }}>
      {group.length > 1 ? (
        <>
          <strong>{title}</strong>
          <br />
        </>
      ) : null}
      {group.map((ch) => {
        const freq = formatFreqPair(ch.rxFrequency, ch.txFrequency);
        return (
          <div key={ch.id} style={{ marginBottom: '0.5rem' }}>
            <strong>{channelDisplayLabel(ch, true)}</strong>
            <br />
            <span style={{ opacity: 0.85 }}>
              {modeSummary(ch)}
              {freq ? ` · ${freq}` : ''}
            </span>
            {onChannelClick ? (
              <>
                <br />
                <button
                  type="button"
                  style={{
                    marginTop: 4,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--mantine-color-blue-4)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onClick={() => onChannelClick(ch.id)}
                >
                  Edit channel
                </button>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FitMapBounds({
  groups,
  zoneHulls,
  showZoneHulls,
  hullPoints,
  operatorPosition,
  referencePosition,
  referenceRadiusM,
}: {
  groups: Channel[][];
  zoneHulls: ZoneHullData[];
  showZoneHulls: boolean;
  hullPoints?: LatLon[];
  operatorPosition?: { lat: number; lon: number } | null;
  referencePosition?: { lat: number; lon: number } | null;
  referenceRadiusM?: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    const zonePoints = hullPoints ?? (showZoneHulls ? zoneHulls.flatMap((zh) => zh.points) : []);
    const includeZones = zonePoints.length > 0;
    const extraPoints: LatLon[] = [];
    if (
      operatorPosition != null &&
      Number.isFinite(operatorPosition.lat) &&
      Number.isFinite(operatorPosition.lon)
    ) {
      extraPoints.push([operatorPosition.lat, operatorPosition.lon]);
    }
    if (
      referencePosition != null &&
      Number.isFinite(referencePosition.lat) &&
      Number.isFinite(referencePosition.lon)
    ) {
      const centre: LatLon = [referencePosition.lat, referencePosition.lon];
      extraPoints.push(centre);
      if (referenceRadiusM != null && referenceRadiusM > 0) {
        extraPoints.push(...circleBoundsPoints(centre, referenceRadiusM));
      }
    }
    const points = collectMapPoints(groups, zonePoints, includeZones, extraPoints);
    const action = computeMapView(points, {
      padding: [48, 48],
      maxZoom: 11,
      singlePointZoom: 11,
    });

    if (!action) return;

    if (action.type === 'setView') {
      map.setView(action.center, action.zoom);
      return;
    }

    map.fitBounds(L.latLngBounds(action.southWest, action.northEast), {
      padding: action.padding,
      maxZoom: action.maxZoom,
    });
  }, [
    map,
    groups,
    zoneHulls,
    showZoneHulls,
    hullPoints,
    operatorPosition,
    referencePosition,
    referenceRadiusM,
  ]);

  return null;
}

function MapResizeFix() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const parent = container.parentElement;
    if (!parent) return;

    const refresh = () => {
      if (document.readyState !== 'complete') return;
      map.invalidateSize();
    };

    const onLoad = () => refresh();
    if (document.readyState === 'complete') {
      requestAnimationFrame(refresh);
    } else {
      window.addEventListener('load', onLoad, { once: true });
    }

    const observer = new ResizeObserver(() => refresh());
    observer.observe(parent);

    return () => {
      window.removeEventListener('load', onLoad);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

export type { MapControlMode } from './MapControls.tsx';

export interface CodeplugMapProps {
  channels: Channel[];
  zones?: Zone[];
  allChannels?: Channel[];
  height?: number | string;
  showControls?: boolean;
  defaultShowZones?: boolean;
  defaultShowLabels?: boolean;
  mapControlMode?: MapControlMode;
  emphasisZoneId?: string | null;
  provisionalZone?: { channelIds: string[]; label?: string } | null;
  highlightChannelId?: string;
  operatorPosition?: { lat: number; lon: number } | null;
  referencePosition?: { lat: number; lon: number } | null;
  referenceRadiusM?: number | null;
  dimmedChannelIds?: readonly string[];
  /** When set, auto-fit bounds use only these channel markers (plus emphasis hull). */
  fitBoundsChannelIds?: readonly string[];
  onMapClick?: (lat: number, lon: number) => void;
  onChannelClick?: (channelId: string) => void;
  onZoneClick?: (zoneId: string) => void;
}

export default function CodeplugMap({
  channels,
  zones = [],
  allChannels,
  height = 400,
  showControls = true,
  defaultShowZones = true,
  defaultShowLabels = false,
  mapControlMode = 'standard',
  emphasisZoneId = null,
  provisionalZone = null,
  highlightChannelId,
  operatorPosition = null,
  referencePosition = null,
  referenceRadiusM = null,
  dimmedChannelIds = [],
  fitBoundsChannelIds,
  onMapClick,
  onChannelClick,
  onZoneClick,
}: CodeplugMapProps) {
  const mapLayoutReady = useDocumentLayoutReady();
  const { maidenheadGrid } = useMapSettings();
  const [showLabels, setShowLabels] = useState(defaultShowLabels);
  const [showZoneHulls, setShowZoneHulls] = useState(defaultShowZones);
  const [showThisZone, setShowThisZone] = useState(true);
  const [showOtherZones, setShowOtherZones] = useState(true);

  const dimmedIdSet = useMemo(() => new Set(dimmedChannelIds), [dimmedChannelIds]);
  const isEmphasisMode = mapControlMode !== 'standard';

  const channelPool = allChannels ?? channels;
  const filterOpts = DEFAULT_MAP_FILTER_OPTS;

  const { plotted } = useMemo(() => applyFilters(channels, filterOpts), [channels, filterOpts]);

  const plottedById = useMemo(() => buildChannelById(plotted), [plotted]);

  const groups = useMemo(() => groupByCoords(plotted, true), [plotted]);

  const zoneHulls: ZoneHullData[] = useMemo(() => {
    if (!zones.length || !plottedById.size) return [];
    const hullsVisible = isEmphasisMode ? showThisZone || showOtherZones : showZoneHulls;
    if (!hullsVisible) return [];

    return zones.map((zone, index) => {
      const { points, missing } = zoneGeolocatedPoints(
        zone,
        zones,
        plottedById,
        channelPool,
        filterOpts,
      );
      const colors = zoneColor(index);
      const memberCount = resolveEffectiveZoneChannelIds(zone, zones).length;
      const geo = geometryFromPoints(points);

      if (geo.geometry === 'none') {
        return {
          zone,
          index,
          points,
          missing,
          colors,
          shapeNote: `no geolocated members (${memberCount} in zone)`,
          geometry: 'none' as const,
        };
      }

      return {
        zone,
        index,
        points,
        missing,
        colors,
        shapeNote: geo.shapeNote,
        geometry: geo.geometry,
        hull: geo.hull,
      };
    });
  }, [
    zones,
    showZoneHulls,
    showThisZone,
    showOtherZones,
    isEmphasisMode,
    plottedById,
    channelPool,
    filterOpts,
  ]);

  const provisionalHull: OverlayHullData | null = useMemo(() => {
    if (!provisionalZone?.channelIds.length) return null;
    const points: LatLon[] = [];
    for (const channelId of provisionalZone.channelIds) {
      const ch = channelPool.find((row) => row.id === channelId);
      if (ch?.location != null && ch.useLocation) {
        points.push([ch.location.lat, ch.location.lon]);
      }
    }
    const unique = uniqueLatLon(points);
    const geo = geometryFromPoints(unique);
    if (geo.geometry === 'none') return null;
    return {
      key: 'provisional-zone',
      label: provisionalZone.label ?? 'New zone',
      points: unique,
      colors: zoneColor(0),
      shapeNote: geo.shapeNote,
      geometry: geo.geometry,
      hull: geo.hull,
      variant: 'provisional',
    };
  }, [provisionalZone, channelPool]);

  const overlayHulls: OverlayHullData[] = useMemo(() => {
    if (!isEmphasisMode) return [];

    const overlays: OverlayHullData[] = [];

    if (showThisZone && emphasisZoneId) {
      const zh = zoneHulls.find((row) => row.zone.id === emphasisZoneId);
      if (zh && zh.geometry !== 'none') {
        overlays.push({
          key: zh.zone.id,
          label: zh.zone.name,
          points: zh.points,
          colors: zh.colors,
          shapeNote: zh.shapeNote,
          geometry: zh.geometry,
          hull: zh.hull,
          variant: 'emphasis',
        });
      }
    }

    if (showThisZone && provisionalHull) {
      overlays.push(provisionalHull);
    }

    if (showOtherZones) {
      for (const zh of zoneHulls) {
        if (emphasisZoneId && zh.zone.id === emphasisZoneId) continue;
        if (zh.geometry === 'none') continue;
        overlays.push({
          key: zh.zone.id,
          label: zh.zone.name,
          points: zh.points,
          colors: zh.colors,
          shapeNote: zh.shapeNote,
          geometry: zh.geometry,
          hull: zh.hull,
          variant: 'muted',
        });
      }
    }

    return overlays;
  }, [isEmphasisMode, showThisZone, showOtherZones, emphasisZoneId, zoneHulls, provisionalHull]);

  const mapStyle = typeof height === 'number' ? { height: `${height}px` } : { height };

  const boundsHullPoints = useMemo(() => {
    if (isEmphasisMode) {
      if (fitBoundsChannelIds != null) {
        return overlayHulls
          .filter((hull) => hull.variant === 'emphasis' || hull.variant === 'provisional')
          .flatMap((hull) => hull.points);
      }
      return overlayHulls.flatMap((hull) => hull.points);
    }
    if (!showZoneHulls) return [];
    return zoneHulls.flatMap((zh) => zh.points);
  }, [isEmphasisMode, overlayHulls, showZoneHulls, zoneHulls, fitBoundsChannelIds]);

  const boundsGroups = useMemo(() => {
    if (!fitBoundsChannelIds?.length) return groups;
    const idSet = new Set(fitBoundsChannelIds);
    return groups.filter((group) => group.some((ch) => idSet.has(ch.id)));
  }, [groups, fitBoundsChannelIds]);

  function renderHullShape(
    key: string,
    label: string,
    geometry: HullGeometry,
    points: LatLon[],
    hull: LatLon[] | undefined,
    pathOptions: L.PathOptions,
    popupContent?: React.ReactNode,
  ) {
    if (geometry === 'none') return null;

    if (geometry === 'circle') {
      return (
        <Circle key={key} center={points[0]} radius={2500} pathOptions={pathOptions}>
          <Tooltip sticky direction="center" className="zone-tooltip">
            {label}
          </Tooltip>
          {popupContent ? <Popup>{popupContent}</Popup> : null}
        </Circle>
      );
    }

    if (geometry === 'line') {
      return (
        <Polyline key={key} positions={points} pathOptions={pathOptions}>
          <Tooltip sticky direction="center" className="zone-tooltip">
            {label}
          </Tooltip>
          {popupContent ? <Popup>{popupContent}</Popup> : null}
        </Polyline>
      );
    }

    return (
      <Polygon key={key} positions={hull!} pathOptions={pathOptions}>
        <Tooltip sticky direction="center" className="zone-tooltip">
          {label}
        </Tooltip>
        {popupContent ? <Popup>{popupContent}</Popup> : null}
      </Polygon>
    );
  }

  return (
    <div className="codeplug-map-wrap">
      <Group justify="space-between" align="center" wrap="wrap" className="codeplug-map-toolbar">
        {showControls ? (
          <MapControls
            mode={mapControlMode}
            showLabels={showLabels}
            onShowLabelsChange={setShowLabels}
            showZones={showZoneHulls}
            onShowZonesChange={setShowZoneHulls}
            showThisZone={showThisZone}
            onShowThisZoneChange={setShowThisZone}
            showOtherZones={showOtherZones}
            onShowOtherZonesChange={setShowOtherZones}
          />
        ) : (
          <span />
        )}
        <Anchor
          component={Link}
          to="/settings"
          state={{ scrollTo: SETTINGS_MAP_SECTION_ID }}
          size="xs"
          c="dimmed"
        >
          Map settings
        </Anchor>
      </Group>

      <div className="codeplug-map" style={mapStyle}>
        {mapLayoutReady ? (
          <MapContainer
            center={[56.5, -4.0]}
            zoom={6}
            preferCanvas
            style={{ height: '100%', width: '100%' }}
          >
            <MapResizeFix />
            {onMapClick ? <MapClickHandler onMapClick={onMapClick} /> : null}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MaidenheadGridLayer mode={maidenheadGrid} />

            {referencePosition != null &&
            Number.isFinite(referencePosition.lat) &&
            Number.isFinite(referencePosition.lon) &&
            referenceRadiusM != null &&
            referenceRadiusM > 0 ? (
              <Circle
                center={[referencePosition.lat, referencePosition.lon]}
                radius={referenceRadiusM}
                pathOptions={{
                  color: '#228be6',
                  fillColor: '#228be6',
                  fillOpacity: 0.08,
                  weight: 2,
                  opacity: 0.75,
                }}
              />
            ) : null}

            {isEmphasisMode
              ? overlayHulls.map((hull) =>
                  renderHullShape(
                    hull.key,
                    hull.label,
                    hull.geometry,
                    hull.points,
                    hull.hull,
                    hullPathOptions(hull.variant, hull.colors),
                  ),
                )
              : showZoneHulls
                ? zoneHulls.map((zh) => {
                    if (zh.geometry === 'none') return null;
                    const popupContent = (
                      <div>
                        <strong>{zh.zone.name}</strong>
                        <br />
                        {resolveEffectiveZoneChannelIds(zh.zone, zones).length} zone members ·{' '}
                        {zh.shapeNote}
                        {zh.missing.length ? (
                          <>
                            <br />
                            <span style={{ opacity: 0.75 }}>
                              {zh.missing.length} member(s) without coords
                            </span>
                          </>
                        ) : null}
                        {onZoneClick ? (
                          <>
                            <br />
                            <button
                              type="button"
                              style={{
                                marginTop: 4,
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                color: 'var(--mantine-color-blue-4)',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                              onClick={() => onZoneClick(zh.zone.id)}
                            >
                              Edit zone
                            </button>
                          </>
                        ) : null}
                      </div>
                    );
                    return renderHullShape(
                      zh.zone.id,
                      zh.zone.name,
                      zh.geometry,
                      zh.points,
                      zh.hull,
                      hullPathOptions('emphasis', zh.colors),
                      popupContent,
                    );
                  })
                : null}

            {groups.map((group) => {
              const ch = group[0];
              const stackCount = group.length;
              const mode = stackCount > 1 ? dominantMode(group) : primaryMode(ch);
              const color = mode != null ? modeColor(mode) : modeColor('other');
              const label = markerLabel(group, showLabels);
              const position: LatLon = [ch.location!.lat, ch.location!.lon];
              const highlighted =
                highlightChannelId != null && group.some((c) => c.id === highlightChannelId);
              const dimmed = group.some((c) => dimmedIdSet.has(c.id));

              return (
                <Marker
                  key={`${ch.id}-${position[0]}-${position[1]}`}
                  position={position}
                  icon={channelDivIcon(color, label, stackCount, highlighted, dimmed)}
                >
                  <Tooltip sticky direction="top" className="channel-tooltip">
                    <ChannelTooltipLines group={group} />
                  </Tooltip>
                  <Popup>
                    <ChannelPopup group={group} onChannelClick={onChannelClick} />
                  </Popup>
                </Marker>
              );
            })}

            {referencePosition != null &&
            Number.isFinite(referencePosition.lat) &&
            Number.isFinite(referencePosition.lon) ? (
              <Marker
                position={[referencePosition.lat, referencePosition.lon]}
                icon={referenceDivIcon()}
              >
                <Popup>Reference centre</Popup>
              </Marker>
            ) : null}

            {operatorPosition != null &&
            Number.isFinite(operatorPosition.lat) &&
            Number.isFinite(operatorPosition.lon) ? (
              <Marker
                position={[operatorPosition.lat, operatorPosition.lon]}
                icon={operatorDivIcon()}
              >
                <Popup>You are here</Popup>
              </Marker>
            ) : null}

            {boundsGroups.length > 0 ||
            operatorPosition != null ||
            referencePosition != null ||
            boundsHullPoints.length > 0 ? (
              <FitMapBounds
                groups={boundsGroups}
                zoneHulls={zoneHulls}
                showZoneHulls={!isEmphasisMode && showZoneHulls}
                hullPoints={isEmphasisMode ? boundsHullPoints : undefined}
                operatorPosition={operatorPosition}
                referencePosition={referencePosition}
                referenceRadiusM={referenceRadiusM}
              />
            ) : null}
          </MapContainer>
        ) : null}
      </div>
    </div>
  );
}
