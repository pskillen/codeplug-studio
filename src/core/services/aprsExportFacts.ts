/**
 * App-facing APRS export facts — wraps NeonPlug settings patch builder
 * without exposing format-adapter imports to `src/app/`.
 */

export {
  buildNeonplugAprsRadioSettingsPatch,
  type NeonplugAprsRadioSettingsPatch,
  type NeonplugAprsSettingsBuildResult,
} from '@core/import-export/formats/neonplug/aprsSettingsWire.ts';
