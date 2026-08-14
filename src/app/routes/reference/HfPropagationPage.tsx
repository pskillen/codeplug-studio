import { Group, Input, NumberInput, Select, Slider, Stack, Text } from '@mantine/core';
import { IconCalendar } from '@tabler/icons-react';
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { peakGainElevationDeg } from '@core/domain/hfPropagation/antennaPatterns.ts';
import { computeIonosphericLayers } from '@core/domain/hfPropagation/ionosphericProfile.ts';
import { colorForLayer, IONOSPHERIC_LAYER_IDS } from '@core/domain/hfPropagation/layerColor.ts';
import {
  criticalFrequencyMhz,
  maximumUsableFrequencyMhz,
} from '@core/domain/hfPropagation/mufCalculation.ts';
import type {
  AntennaConfig,
  AntennaPatternFamily,
  IonosphericLayerId,
  RayPathResult,
  SolarActivityPreset,
} from '@core/domain/hfPropagation/types.ts';
import { MODE_LABELS } from '../../components/HfPropagationGlobe/buildGlobeData.ts';
import UseMyLocationButton from '../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import { useDebouncedOptionalNumberField } from '../../hooks/useDebouncedOptionalNumberField.ts';
import {
  DesignSystemV2Provider,
  FormField,
  Panel,
  SegmentedControl,
  ToggleSwitch,
} from '../../components/v2/index.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import {
  formatDatetimeLocalValue,
  formatUkDateTime,
  parseUkDateTime,
} from './hfPropagationDateTime.ts';
import SlicePlanePicker, { DEFAULT_RANGE_M, type SlicePlaneResult } from './SlicePlanePicker.tsx';
import { usePropagationRayTrace } from './usePropagationRayTrace.ts';
import classes from './HfPropagationPage.module.css';

const HfPropagationGlobe = lazy(
  () => import('../../components/HfPropagationGlobe/HfPropagationGlobe.tsx'),
);
const PropagationTopDownMap = lazy(
  () => import('../../components/PropagationTopDownMap/PropagationTopDownMap.tsx'),
);

type PropagationView = 'globe' | 'top-down' | 'vertical-slice';

const VIEW_OPTIONS: { value: PropagationView; label: string }[] = [
  { value: 'globe', label: '3D Globe' },
  { value: 'top-down', label: 'Top-down' },
  { value: 'vertical-slice', label: 'Vertical slice' },
];

/**
 * Real-world antenna types offered in the picker, mapped onto the four
 * `AntennaPatternFamily` values that drive later ray-trace phases (#1166).
 * Several antenna types share a pattern family (e.g. a horizontal dipole and
 * a small transmitting loop are both broadside-null "bidirectional
 * transverse" radiators) — the Select's `value` stays per-antenna-type so
 * the dropdown reads naturally, while `family` (looked up via
 * `ANTENNA_TYPE_OPTIONS`) drives which extra controls are shown.
 */
type AntennaType =
  | 'vertical-whip'
  | 'horizontal-dipole'
  | 'efhw'
  | 'longwire'
  | 'yagi-uda'
  | 'small-transmitting-loop';

const ANTENNA_TYPE_OPTIONS: {
  value: AntennaType;
  label: string;
  family: AntennaPatternFamily;
}[] = [
  { value: 'vertical-whip', label: 'Vertical whip', family: 'omnidirectional-vertical' },
  { value: 'horizontal-dipole', label: 'Horizontal dipole', family: 'bidirectional-transverse' },
  { value: 'efhw', label: 'EFHW', family: 'multi-lobe-conical' },
  { value: 'longwire', label: 'Longwire', family: 'multi-lobe-conical' },
  { value: 'yagi-uda', label: 'Yagi-Uda', family: 'directional-lobe' },
  {
    value: 'small-transmitting-loop',
    label: 'Small transmitting loop',
    family: 'bidirectional-transverse',
  },
];

const SOLAR_PRESET_OPTIONS: { value: SolarActivityPreset; label: string }[] = [
  { value: 'quiet', label: 'Quiet' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'solar-max', label: 'Solar Max' },
  { value: 'storm', label: 'Storm' },
];

const MIN_FREQUENCY_MHZ = 3.0;
const MAX_FREQUENCY_MHZ = 30.0;
const MIN_POWER_W = 1;
const MAX_POWER_W = 1500;
const MIN_HEIGHT_M = 1;
const MAX_HEIGHT_M = 30;
const MIN_WIRE_LENGTH_WAVELENGTHS = 0.5;
const MAX_WIRE_LENGTH_WAVELENGTHS = 5;
const MIN_EXAGGERATION = 1;
const MAX_EXAGGERATION = 10;
const DEFAULT_EXAGGERATION = 2.5;

/** Fields shown/hidden per antenna pattern family — see `AntennaConfig` (core domain scaffold). */
function fieldsShownForFamily(family: AntennaPatternFamily) {
  return {
    height: family === 'omnidirectional-vertical' || family === 'bidirectional-transverse',
    azimuth:
      family === 'bidirectional-transverse' ||
      family === 'directional-lobe' ||
      family === 'multi-lobe-conical',
    wireLength: family === 'multi-lobe-conical',
  };
}

/** Neutral placeholder until the operator enters a site or uses geolocation (Gulf of Guinea). */
const DEFAULT_TX_LAT_DEG = 0;
const DEFAULT_TX_LON_DEG = 0;

function layerToggleAriaLabel(id: IonosphericLayerId): string {
  return `${id} layer`;
}

function dominantRay(rays: RayPathResult[]): RayPathResult | null {
  if (rays.length === 0) return null;
  const preferred = rays.filter(
    (ray) => ray.mode === 'skywave' || ray.mode === 'nvis' || ray.mode === 'groundwave',
  );
  const pool = preferred.length > 0 ? preferred : rays;
  return pool.reduce((best, ray) =>
    ray.relativeSignalStrength > best.relativeSignalStrength ? ray : best,
  );
}

const ALL_LAYERS_VISIBLE: Record<IonosphericLayerId, boolean> = {
  D: true,
  E: true,
  F1: true,
  F2: true,
};

export default function HfPropagationPage() {
  const dateTimePickerRef = useRef<HTMLInputElement>(null);
  const { mapboxToken } = useMapSettings();
  const [view, setView] = useState<PropagationView>('globe');
  const [slicePlane, setSlicePlane] = useState<SlicePlaneResult>({
    bearingDeg: 0,
    distanceM: DEFAULT_RANGE_M,
  });
  const onSlicePlaneChange = useCallback((result: SlicePlaneResult) => {
    setSlicePlane(result);
  }, []);

  const [frequencyMhz, setFrequencyMhz] = useState(14.2);
  const [powerW, setPowerW] = useState(100);

  const [antennaType, setAntennaType] = useState<AntennaType>('vertical-whip');
  const [heightM, setHeightM] = useState(8);
  const [azimuthDeg, setAzimuthDeg] = useState(90);
  const [wireLengthWavelengths, setWireLengthWavelengths] = useState(1);

  const [dateTime, setDateTime] = useState(() => new Date());
  const [dateTimeText, setDateTimeText] = useState(() => formatUkDateTime(dateTime));
  const [solarPreset, setSolarPreset] = useState<SolarActivityPreset>('moderate');
  const [txLat, setTxLat] = useState(DEFAULT_TX_LAT_DEG);
  const [txLon, setTxLon] = useState(DEFAULT_TX_LON_DEG);
  const txLocation = useMemo(() => ({ lat: txLat, lon: txLon }), [txLat, txLon]);
  const commitTxLat = useCallback((value: number | undefined) => {
    if (value == null || !Number.isFinite(value)) return;
    setTxLat(Math.min(90, Math.max(-90, value)));
  }, []);
  const commitTxLon = useCallback((value: number | undefined) => {
    if (value == null || !Number.isFinite(value)) return;
    setTxLon(Math.min(180, Math.max(-180, value)));
  }, []);
  const txLatField = useDebouncedOptionalNumberField(txLat, commitTxLat);
  const txLonField = useDebouncedOptionalNumberField(txLon, commitTxLon);

  const [exaggerationEnabled, setExaggerationEnabled] = useState(true);
  const [exaggerationFactor, setExaggerationFactor] = useState(DEFAULT_EXAGGERATION);
  const [explodeEnabled, setExplodeEnabled] = useState(false);
  const [fresnelEnabled, setFresnelEnabled] = useState(true);
  const [terminatorEnabled, setTerminatorEnabled] = useState(false);
  const [visibleLayers, setVisibleLayers] =
    useState<Record<IonosphericLayerId, boolean>>(ALL_LAYERS_VISIBLE);

  const antennaFamily = useMemo(
    () =>
      ANTENNA_TYPE_OPTIONS.find((opt) => opt.value === antennaType)?.family ??
      'omnidirectional-vertical',
    [antennaType],
  );
  const shownFields = fieldsShownForFamily(antennaFamily);
  const antennaConfig = useMemo<AntennaConfig>(
    () => ({
      family: antennaFamily,
      heightM,
      azimuthDeg,
      wireLengthWavelengths,
    }),
    [antennaFamily, heightM, azimuthDeg, wireLengthWavelengths],
  );
  const peakGainElevation = useMemo(
    () => peakGainElevationDeg(antennaConfig, azimuthDeg, frequencyMhz),
    [antennaConfig, azimuthDeg, frequencyMhz],
  );

  const layers = useMemo(
    () => computeIonosphericLayers(txLat, txLon, dateTime.getTime(), solarPreset),
    [txLat, txLon, dateTime, solarPreset],
  );
  const f2Layer = layers.find((layer) => layer.id === 'F2');
  const criticalFrequencyMhzValue = f2Layer ? criticalFrequencyMhz(f2Layer.peakElectronDensity) : 0;
  const criticalFrequencyLabel = f2Layer ? `${criticalFrequencyMhzValue.toFixed(1)} MHz` : '—';
  const mufLabel = f2Layer
    ? `${maximumUsableFrequencyMhz(criticalFrequencyMhzValue, peakGainElevation).toFixed(1)} MHz`
    : '—';

  const rayTraceParams = useMemo(
    () => ({
      frequencyMhz,
      antenna: antennaConfig,
      layers,
      azimuthDeg,
      txLat,
      txLon,
      atMs: dateTime.getTime(),
    }),
    [frequencyMhz, antennaConfig, layers, azimuthDeg, txLat, txLon, dateTime],
  );
  const rays = usePropagationRayTrace(rayTraceParams);
  const dominant = dominantRay(rays);
  const modeReadout = dominant ? MODE_LABELS[dominant.mode] : '—';

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <h1 className={classes.title}>Propagation Visualiser</h1>
        <p className={classes.description}>
          See how your antenna, band, and time of day shape where your signal actually goes —
          groundwave, skywave, and NVIS, modelled with idealised atmospheric layers. Not a coverage
          guarantee.
        </p>

        <div className={classes.layout}>
          <div className={classes.viewport}>
            {view === 'globe' ? (
              <Suspense
                fallback={
                  <div className={classes.viewportPlaceholder}>
                    <Text size="sm" c="dimmed">
                      Loading 3D globe…
                    </Text>
                  </div>
                }
              >
                <HfPropagationGlobe
                  layers={layers}
                  display={{
                    exaggerationFactor: exaggerationEnabled ? exaggerationFactor : 1,
                    explodeEnabled,
                    fresnelEnabled,
                    terminatorEnabled,
                  }}
                  visibleLayers={visibleLayers}
                  environmentAtMs={dateTime.getTime()}
                  rays={rays}
                  txLat={txLat}
                  txLon={txLon}
                />
              </Suspense>
            ) : view === 'top-down' ? (
              <Suspense
                fallback={
                  <div className={classes.viewportPlaceholder}>
                    <Text size="sm" c="dimmed">
                      Loading top-down view…
                    </Text>
                  </div>
                }
              >
                <PropagationTopDownMap transmitter={txLocation} rays={rays} />
              </Suspense>
            ) : (
              <div className={classes.viewportPlaceholder}>
                <Text size="sm" c="dimmed">
                  {`This view isn't implemented yet. Slice plane: ${slicePlane.bearingDeg.toFixed(0)}°T, ${(slicePlane.distanceM / 1000).toFixed(0)} km.`}
                </Text>
              </div>
            )}
          </div>

          <div className={classes.controlPanel}>
            <Panel title="View">
              <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
            </Panel>

            {view === 'vertical-slice' ? (
              <Panel title="Slice plane">
                <SlicePlanePicker
                  transmitterLocation={txLocation}
                  defaultBearingDeg={shownFields.azimuth ? azimuthDeg : 0}
                  onChange={onSlicePlaneChange}
                  mapboxToken={mapboxToken}
                />
              </Panel>
            ) : null}

            <Panel title="Display">
              <Stack gap="lg">
                <ToggleSwitch
                  checked={exaggerationEnabled}
                  onChange={setExaggerationEnabled}
                  label="Altitude exaggeration"
                />
                {exaggerationEnabled ? (
                  <Input.Wrapper label={`${exaggerationFactor.toFixed(1)}×`}>
                    <Slider
                      aria-label="Altitude exaggeration"
                      value={exaggerationFactor}
                      onChange={setExaggerationFactor}
                      min={MIN_EXAGGERATION}
                      max={MAX_EXAGGERATION}
                      step={0.5}
                      mb={16}
                    />
                  </Input.Wrapper>
                ) : null}
                <ToggleSwitch
                  checked={explodeEnabled}
                  onChange={setExplodeEnabled}
                  label="Exploded layer stacking"
                />
                <ToggleSwitch
                  checked={fresnelEnabled}
                  onChange={setFresnelEnabled}
                  label="Fresnel shading"
                />
                <ToggleSwitch
                  checked={terminatorEnabled}
                  onChange={setTerminatorEnabled}
                  label="Show day/night terminator"
                />
                <div className={classes.layerToggles}>
                  {IONOSPHERIC_LAYER_IDS.map((id) => {
                    return (
                      <ToggleSwitch
                        key={id}
                        checked={visibleLayers[id]}
                        onChange={(checked) =>
                          setVisibleLayers((prev) => ({ ...prev, [id]: checked }))
                        }
                        label={
                          <span className={classes.layerToggleLabel}>
                            <span
                              className={classes.layerSwatch}
                              style={{ backgroundColor: colorForLayer(id) }}
                              aria-hidden
                            />
                            {id}
                          </span>
                        }
                        aria-label={layerToggleAriaLabel(id)}
                      />
                    );
                  })}
                </div>
              </Stack>
            </Panel>

            <Panel title="RF">
              <Stack gap="lg">
                <Input.Wrapper label={`Frequency — ${frequencyMhz.toFixed(1)} MHz`}>
                  <Slider
                    aria-label="Frequency"
                    value={frequencyMhz}
                    onChange={setFrequencyMhz}
                    min={MIN_FREQUENCY_MHZ}
                    max={MAX_FREQUENCY_MHZ}
                    step={0.1}
                    mb={16}
                  />
                </Input.Wrapper>
                <Input.Wrapper label={`Power — ${powerW} W`}>
                  <Slider
                    aria-label="Power"
                    value={powerW}
                    onChange={setPowerW}
                    min={MIN_POWER_W}
                    max={MAX_POWER_W}
                    step={1}
                    mb={16}
                  />
                </Input.Wrapper>
              </Stack>
            </Panel>

            <Panel title="Antenna">
              <Stack gap="lg">
                <FormField label="Type">
                  <Select
                    data={ANTENNA_TYPE_OPTIONS.map(({ value, label }) => ({ value, label }))}
                    value={antennaType}
                    onChange={(value) => {
                      if (value) setAntennaType(value as AntennaType);
                    }}
                  />
                </FormField>
                {shownFields.height ? (
                  <Input.Wrapper label={`Height above ground — ${heightM} m`}>
                    <Slider
                      aria-label="Height above ground"
                      value={heightM}
                      onChange={setHeightM}
                      min={MIN_HEIGHT_M}
                      max={MAX_HEIGHT_M}
                      step={1}
                      mb={16}
                    />
                  </Input.Wrapper>
                ) : null}
                {shownFields.azimuth ? (
                  <Input.Wrapper label={`Azimuth — ${azimuthDeg}°`}>
                    <Slider
                      aria-label="Azimuth"
                      value={azimuthDeg}
                      onChange={setAzimuthDeg}
                      min={0}
                      max={359}
                      step={1}
                      mb={16}
                    />
                  </Input.Wrapper>
                ) : null}
                {shownFields.wireLength ? (
                  <Input.Wrapper label={`Wire length — ${wireLengthWavelengths.toFixed(1)} λ`}>
                    <Slider
                      aria-label="Wire length"
                      value={wireLengthWavelengths}
                      onChange={setWireLengthWavelengths}
                      min={MIN_WIRE_LENGTH_WAVELENGTHS}
                      max={MAX_WIRE_LENGTH_WAVELENGTHS}
                      step={0.1}
                      mb={16}
                    />
                  </Input.Wrapper>
                ) : null}
              </Stack>
            </Panel>

            <Panel title="Environment">
              <Stack gap="lg">
                <FormField
                  label="Transmitter location"
                  hint="0°, 0° (Gulf of Guinea) until you enter coordinates or use your location."
                >
                  <Stack gap="sm">
                    <Group grow>
                      <NumberInput
                        label="Latitude"
                        aria-label="Latitude"
                        value={txLatField.value}
                        onChange={txLatField.setValue}
                        onBlur={txLatField.flush}
                        decimalScale={6}
                        min={-90}
                        max={90}
                      />
                      <NumberInput
                        label="Longitude"
                        aria-label="Longitude"
                        value={txLonField.value}
                        onChange={txLonField.setValue}
                        onBlur={txLonField.flush}
                        decimalScale={6}
                        min={-180}
                        max={180}
                      />
                    </Group>
                    <UseMyLocationButton
                      onLocation={(lat, lon) => {
                        setTxLat(lat);
                        setTxLon(lon);
                      }}
                    />
                  </Stack>
                </FormField>
                <FormField label="Date & time">
                  <div className={classes.dateTimeField}>
                    <input
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="dd/mm/yyyy HH:mm"
                      aria-label="Date and time, day first, 24-hour"
                      className={classes.dateTimeInput}
                      value={dateTimeText}
                      onChange={(e) => {
                        const next = e.currentTarget.value;
                        setDateTimeText(next);
                        const parsed = parseUkDateTime(next);
                        if (parsed) setDateTime(parsed);
                      }}
                      onBlur={() => {
                        const parsed = parseUkDateTime(dateTimeText);
                        setDateTimeText(formatUkDateTime(parsed ?? dateTime));
                      }}
                    />
                    <input
                      ref={dateTimePickerRef}
                      type="datetime-local"
                      lang="en-GB"
                      className={classes.dateTimeNative}
                      tabIndex={-1}
                      aria-hidden
                      value={formatDatetimeLocalValue(dateTime)}
                      onChange={(e) => {
                        const value = e.currentTarget.value;
                        if (!value) return;
                        const parsed = new Date(value);
                        if (Number.isNaN(parsed.getTime())) return;
                        setDateTime(parsed);
                        setDateTimeText(formatUkDateTime(parsed));
                      }}
                    />
                    <button
                      type="button"
                      className={classes.dateTimePickerButton}
                      aria-label="Open date and time picker"
                      onClick={() => {
                        const el = dateTimePickerRef.current;
                        if (!el) return;
                        if (typeof el.showPicker === 'function') el.showPicker();
                        else el.click();
                      }}
                    >
                      <IconCalendar size={16} />
                    </button>
                  </div>
                </FormField>
                <FormField label="Solar activity">
                  <SegmentedControl
                    options={SOLAR_PRESET_OPTIONS}
                    value={solarPreset}
                    onChange={setSolarPreset}
                  />
                </FormField>
              </Stack>
            </Panel>

            <Panel title="Reading">
              <Stack gap="lg">
                <FormField label="Critical frequency (fc)" value={criticalFrequencyLabel} />
                <FormField label="MUF" value={mufLabel} />
                <FormField label="Mode" value={modeReadout} />
              </Stack>
            </Panel>
          </div>
        </div>
      </div>
    </DesignSystemV2Provider>
  );
}
