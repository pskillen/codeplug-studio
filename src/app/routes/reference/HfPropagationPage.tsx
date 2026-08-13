import { Input, Select, Slider, Stack, Text } from '@mantine/core';
import { lazy, Suspense, useMemo, useState } from 'react';
import { computeIonosphericLayers } from '@core/domain/hfPropagation/ionosphericProfile.ts';
import { colorForLayer, IONOSPHERIC_LAYER_IDS } from '@core/domain/hfPropagation/layerColor.ts';
import { criticalFrequencyMhz } from '@core/domain/hfPropagation/mufCalculation.ts';
import type {
  AntennaPatternFamily,
  IonosphericLayerId,
  SolarActivityPreset,
} from '@core/domain/hfPropagation/types.ts';
import {
  DesignSystemV2Provider,
  FormField,
  Panel,
  SegmentedControl,
  ToggleSwitch,
} from '../../components/v2/index.ts';
import classes from './HfPropagationPage.module.css';

const HfPropagationGlobe = lazy(
  () => import('../../components/HfPropagationGlobe/HfPropagationGlobe.tsx'),
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
const DEFAULT_EXAGGERATION = 5;

/** Fields shown/hidden per antenna pattern family — see `AntennaConfig` (core domain scaffold). */
function fieldsShownForFamily(family: AntennaPatternFamily) {
  return {
    height: family === 'omnidirectional-vertical' || family === 'bidirectional-transverse',
    azimuth: family === 'bidirectional-transverse' || family === 'directional-lobe',
    wireLength: family === 'multi-lobe-conical',
  };
}

/** Placeholder transmitter site until the slice-plane picker (#1167) supplies lat/lon. */
const DEFAULT_TX_LAT_DEG = 0;
const DEFAULT_TX_LON_DEG = 0;

/** "YYYY-MM-DDTHH:mm" in local time, suitable for an `<input type="datetime-local">` default. */
function nowForDateTimeInput(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

function dateTimeLocalToMs(value: string): number {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
}

function layerToggleAriaLabel(id: IonosphericLayerId, physicsPresent: boolean): string {
  return physicsPresent ? `${id} layer` : `${id} layer, not present (night)`;
}

const ALL_LAYERS_VISIBLE: Record<IonosphericLayerId, boolean> = {
  D: true,
  E: true,
  F1: true,
  F2: true,
};

export default function HfPropagationPage() {
  const [view, setView] = useState<PropagationView>('globe');

  const [frequencyMhz, setFrequencyMhz] = useState(14.2);
  const [powerW, setPowerW] = useState(100);

  const [antennaType, setAntennaType] = useState<AntennaType>('vertical-whip');
  const [heightM, setHeightM] = useState(8);
  const [azimuthDeg, setAzimuthDeg] = useState(90);
  const [wireLengthWavelengths, setWireLengthWavelengths] = useState(1);

  const [dateTime, setDateTime] = useState(nowForDateTimeInput);
  const [solarPreset, setSolarPreset] = useState<SolarActivityPreset>('moderate');

  const [exaggerationEnabled, setExaggerationEnabled] = useState(true);
  const [exaggerationFactor, setExaggerationFactor] = useState(DEFAULT_EXAGGERATION);
  const [explodeEnabled, setExplodeEnabled] = useState(true);
  const [fresnelEnabled, setFresnelEnabled] = useState(true);
  const [visibleLayers, setVisibleLayers] =
    useState<Record<IonosphericLayerId, boolean>>(ALL_LAYERS_VISIBLE);

  const antennaFamily = useMemo(
    () =>
      ANTENNA_TYPE_OPTIONS.find((opt) => opt.value === antennaType)?.family ??
      'omnidirectional-vertical',
    [antennaType],
  );
  const shownFields = fieldsShownForFamily(antennaFamily);

  const layers = useMemo(
    () =>
      computeIonosphericLayers(
        DEFAULT_TX_LAT_DEG,
        DEFAULT_TX_LON_DEG,
        dateTimeLocalToMs(dateTime),
        solarPreset,
      ),
    [dateTime, solarPreset],
  );
  const f2Layer = layers.find((layer) => layer.id === 'F2');
  const criticalFrequencyLabel = f2Layer
    ? `${criticalFrequencyMhz(f2Layer.peakElectronDensity).toFixed(1)} MHz`
    : '—';

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
                  }}
                  visibleLayers={visibleLayers}
                />
              </Suspense>
            ) : (
              <div className={classes.viewportPlaceholder}>
                <Text size="sm" c="dimmed">
                  This view isn&apos;t implemented yet.
                </Text>
              </div>
            )}
          </div>

          <div className={classes.controlPanel}>
            <Panel title="View">
              <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
            </Panel>

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
                <div className={classes.layerToggles}>
                  {IONOSPHERIC_LAYER_IDS.map((id) => {
                    const physicsPresent = layers.find((layer) => layer.id === id)?.active ?? false;
                    return (
                      <ToggleSwitch
                        key={id}
                        checked={visibleLayers[id]}
                        disabled={!physicsPresent}
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
                            {physicsPresent ? null : (
                              <span className={classes.layerAbsentHint}>not present (night)</span>
                            )}
                          </span>
                        }
                        aria-label={layerToggleAriaLabel(id, physicsPresent)}
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
                <FormField label="Date & time">
                  <input
                    type="datetime-local"
                    className={classes.dateTimeInput}
                    value={dateTime}
                    onChange={(e) => setDateTime(e.currentTarget.value)}
                  />
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
                <FormField label="MUF" value="—" />
                <FormField label="Mode" value="—" />
              </Stack>
            </Panel>
          </div>
        </div>
      </div>
    </DesignSystemV2Provider>
  );
}
