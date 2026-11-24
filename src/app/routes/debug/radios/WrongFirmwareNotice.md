# WrongFirmwareNotice

Radio-neutral alert when a debug read meets firmware the page did not expect. Colours follow `DEBUG_FIRMWARE_COLOR` for the `found` family (`gray` when `unknown`).

## Props

| Prop                | Role                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `error`             | `DebugWrongFirmwareError` from the integration capture (`message`, `found`, optional `port` and `received`) |
| `target`            | Sibling descriptor for `error.found` when Studio has a page for it                                          |
| `stockSibling`      | A `stock` firmware sibling, if any (DM-32UV switch-only path)                                               |
| `portOpen`          | Whether `error.port` is still open for handoff                                                              |
| `secondsLeft`       | Countdown before an unused port closes (60 s)                                                               |
| `portClosedMessage` | Show the idle timeout copy                                                                                  |
| `onSwitchAndRead`   | Navigate to the target firmware and read on `error.port`                                                    |
| `onSwitchOnly`      | Navigate without reading (stock path)                                                                       |
| `onClose`           | Close the port and dismiss                                                                                  |

Rendered above the profile tabs from the route shell while a handoff is pending.
