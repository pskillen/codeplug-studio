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
import { convexHullLatLon, zoneColor, type LatLon } from '@core/domain/geo.ts';
import { collectMapPoints, computeMapView } from '@core/domain/mapView.ts';
import type { Channel, Zone } from '@core/models/library.ts';
import { modeColor, modeLabel } from '../../lib/channelModes.ts';
import { hzToMhzString } from '../../lib/units.ts';
import { useDocumentLayoutReady } from '../../hooks/useDocumentLayoutReady.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import { SETTINGS_MAP_SECTION_ID } from '../../lib/settingsSections.ts';
import MapControls from './MapControls.tsx';
import MaidenheadGridLayer from './MaidenheadGridLayer.tsx';
import './CodeplugMap.css';

interface ZoneHullData {
  zone: Zone;
  index: number;
  points: LatLon[];
  missing: { name: string; reason: string }[];
  colors: ReturnType<typeof zoneColor>;
  shapeNote: string;
  geometry: 'circle' | 'line' | 'polygon' | 'none';
  hull?: LatLon[];
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
): L.DivIcon {
  const size = markerDotSizePx(stackCount);
  const merged = stackCount > 1;
  return L.divIcon({
    className: 'channel-marker-wrap',
    html: `<div class="channel-marker">
      <div class="channel-marker-dot${merged ? ' merged' : ''}${highlighted ? ' highlighted' : ''}" style="background:${color};width:${size}px;height:${size}px"></div>
      <div class="channel-marker-label">${escapeHtml(label)}</div>
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
  operatorPosition,
}: {
  groups: Channel[][];
  zoneHulls: ZoneHullData[];
  showZoneHulls: boolean;
  operatorPosition?: { lat: number; lon: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    const zonePoints = showZoneHulls ? zoneHulls.flatMap((zh) => zh.points) : [];
    const extraPoints =
      operatorPosition != null &&
      Number.isFinite(operatorPosition.lat) &&
      Number.isFinite(operatorPosition.lon)
        ? ([[operatorPosition.lat, operatorPosition.lon]] as LatLon[])
        : [];
    const points = collectMapPoints(groups, zonePoints, showZoneHulls, extraPoints);
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
  }, [map, groups, zoneHulls, showZoneHulls, operatorPosition]);

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

export interface CodeplugMapProps {
  channels: Channel[];
  zones?: Zone[];
  allChannels?: Channel[];
  height?: number | string;
  showControls?: boolean;
  defaultShowZones?: boolean;
  defaultShowLabels?: boolean;
  highlightChannelId?: string;
  operatorPosition?: { lat: number; lon: number } | null;
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
  highlightChannelId,
  operatorPosition = null,
  onChannelClick,
  onZoneClick,
}: CodeplugMapProps) {
  const mapLayoutReady = useDocumentLayoutReady();
  const { maidenheadGrid } = useMapSettings();
  const [showLabels, setShowLabels] = useState(defaultShowLabels);
  const [showZoneHulls, setShowZoneHulls] = useState(defaultShowZones);

  const channelPool = allChannels ?? channels;
  const filterOpts = DEFAULT_MAP_FILTER_OPTS;

  const { plotted } = useMemo(() => applyFilters(channels, filterOpts), [channels, filterOpts]);

  const plottedById = useMemo(() => buildChannelById(plotted), [plotted]);

  const groups = useMemo(() => groupByCoords(plotted, true), [plotted]);

  const zoneHulls: ZoneHullData[] = useMemo(() => {
    if (!zones.length || !showZoneHulls || !plottedById.size) return [];

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

      if (points.length === 0) {
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

      if (points.length === 1) {
        return {
          zone,
          index,
          points,
          missing,
          colors,
          shapeNote: '1 point (circle)',
          geometry: 'circle' as const,
        };
      }

      if (points.length === 2) {
        return {
          zone,
          index,
          points,
          missing,
          colors,
          shapeNote: '2 points (line)',
          geometry: 'line' as const,
        };
      }

      const hull = convexHullLatLon(points);
      return {
        zone,
        index,
        points,
        missing,
        colors,
        shapeNote: `${hull.length} hull verts / ${points.length} sites`,
        geometry: 'polygon' as const,
        hull,
      };
    });
  }, [zones, showZoneHulls, plottedById, channelPool, filterOpts]);

  const mapStyle = typeof height === 'number' ? { height: `${height}px` } : { height };

  return (
    <div className="codeplug-map-wrap">
      <Group justify="space-between" align="center" wrap="wrap" className="codeplug-map-toolbar">
        {showControls ? (
          <MapControls
            showLabels={showLabels}
            onShowLabelsChange={setShowLabels}
            showZones={showZoneHulls}
            onShowZonesChange={setShowZoneHulls}
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
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MaidenheadGridLayer mode={maidenheadGrid} />

            {showZoneHulls
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

                  if (zh.geometry === 'circle') {
                    return (
                      <Circle
                        key={zh.zone.id}
                        center={zh.points[0]}
                        radius={2500}
                        pathOptions={{
                          color: zh.colors.stroke,
                          fillColor: zh.colors.stroke,
                          fillOpacity: 0.18,
                          weight: 2,
                        }}
                      >
                        <Tooltip sticky direction="center" className="zone-tooltip">
                          {zh.zone.name}
                        </Tooltip>
                        <Popup>{popupContent}</Popup>
                      </Circle>
                    );
                  }

                  if (zh.geometry === 'line') {
                    return (
                      <Polyline
                        key={zh.zone.id}
                        positions={zh.points}
                        pathOptions={{ color: zh.colors.stroke, weight: 3, opacity: 0.85 }}
                      >
                        <Tooltip sticky direction="center" className="zone-tooltip">
                          {zh.zone.name}
                        </Tooltip>
                        <Popup>{popupContent}</Popup>
                      </Polyline>
                    );
                  }

                  return (
                    <Polygon
                      key={zh.zone.id}
                      positions={zh.hull!}
                      pathOptions={{
                        color: zh.colors.stroke,
                        fillColor: zh.colors.stroke,
                        fillOpacity: 0.18,
                        weight: 2,
                      }}
                    >
                      <Tooltip sticky direction="center" className="zone-tooltip">
                        {zh.zone.name}
                      </Tooltip>
                      <Popup>{popupContent}</Popup>
                    </Polygon>
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

              return (
                <Marker
                  key={`${ch.id}-${position[0]}-${position[1]}`}
                  position={position}
                  icon={channelDivIcon(color, label, stackCount, highlighted)}
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

            {groups.length > 0 ||
            operatorPosition != null ||
            (showZoneHulls && zoneHulls.some((zh) => zh.geometry !== 'none')) ? (
              <FitMapBounds
                groups={groups}
                zoneHulls={zoneHulls}
                showZoneHulls={showZoneHulls}
                operatorPosition={operatorPosition}
              />
            ) : null}
          </MapContainer>
        ) : null}
      </div>
    </div>
  );
}
