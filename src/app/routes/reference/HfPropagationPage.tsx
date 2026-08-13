import { Input, Select, Slider, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import type {
  AntennaPatternFamily,
  SolarActivityPreset,
} from '@core/domain/hfPropagation/types.ts';
import {
  DesignSystemV2Provider,
  FormField,
  Panel,
  SegmentedControl,
} from '../../components/v2/index.ts';
import classes from './HfPropagationPage.module.css';

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

/** Fields shown/hidden per antenna pattern family — see `AntennaConfig` (core domain scaffold). */
function fieldsShownForFamily(family: AntennaPatternFamily) {
  return {
    height: family === 'omnidirectional-vertical' || family === 'bidirectional-transverse',
    azimuth: family === 'bidirectional-transverse' || family === 'directional-lobe',
    wireLength: family === 'multi-lobe-conical',
  };
}

/** "YYYY-MM-DDTHH:mm" in local time, suitable for an `<input type="datetime-local">` default. */
function nowForDateTimeInput(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

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

  const antennaFamily = useMemo(
    () =>
      ANTENNA_TYPE_OPTIONS.find((opt) => opt.value === antennaType)?.family ??
      'omnidirectional-vertical',
    [antennaType],
  );
  const shownFields = fieldsShownForFamily(antennaFamily);

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
            <Text size="sm" c="dimmed">
              3D globe coming in a later phase
            </Text>
          </div>

          <div className={classes.controlPanel}>
            <Panel title="View">
              <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
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
                <FormField label="Critical frequency (fc)" value="—" />
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
