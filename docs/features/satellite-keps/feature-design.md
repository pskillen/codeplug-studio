# Feature design: Satellite Keplerian elements

**Purpose:** Product design deep-dive for satellite keps (problem space, TLE sources, Keplerian definitions, library UX, and write workflows). Hub status and ticket tracking live in [README.md](README.md). Epic: [#848](https://github.com/pskillen/codeplug-studio/issues/848).

## 1. The Problem Space

Amateur radio operators utilize Low Earth Orbit (LEO) satellites for voice (FM, SSB) and digital communications (APRS, packet). Because these satellites move at high velocities relative to the Earth's surface, their positions and relative radio frequencies change constantly.

Radios with built-in satellite tracking, such as those running OpenGD77 firmware and the Anytone D890, need to calculate:

- **Acquisition of Signal (AOS) & Loss of Signal (LOS):** The times the satellite rises above and falls below the local horizon.
- **Azimuth and Elevation:** Where to point a directional antenna.
- **Doppler Shift:** The necessary frequency adjustments for uplinks and downlinks to maintain the link as the satellite approaches and recedes.

To compute these values locally, the radio's microcontroller requires a mathematical model of the satellite's orbit. Orbits are not perfectly stable; atmospheric drag, the Earth's oblateness, and solar radiation pressure cause LEO orbits to degrade and shift over time. Consequently, the orbital parameters—known as Keplerian elements or "keps"—become stale and must be routinely updated (ideally every few days) to maintain tracking accuracy.

Your tool bridges the gap by fetching fresh orbital data from upstream sources, parsing it, and flashing it to the radio's memory.

## 2. What are Keps Files?

"Keps files" are plain text files containing collections of orbital data. The industry standard format for distributing this data is the **Two-Line Element (TLE)** set.

Despite the name, a TLE typically consists of three lines:

1. **Line 0:** The satellite's common name (e.g., `SO-50` or `ISS (ZARYA)`).
2. **Line 1:** The first line of data containing satellite identification, epoch (time of the reading), and drag terms.
3. **Line 2:** The second line containing the primary Keplerian elements that describe the orbit's geometry.

Each data line is strictly 69 characters long and uses a rigid column-based formatting structure, ending with a modulo-10 checksum.

## 3. Where to Obtain Keps

For automated tools, fetching TLEs via HTTP GET requests is the standard approach. The primary sources used by the amateur radio community are:

- **CelesTrak (Recommended):** The most reliable, free, and unrestricted source for automated fetching. They provide pre-filtered lists of satellites.
  - *Amateur specific endpoint:* `https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle`
- **AMSAT (Radio Amateur Satellite Corporation):** Provides a curated text file specifically for active amateur satellites.
  - *Endpoint:* `https://www.amsat.org/tle/current/nasabare.txt`
- **Space-Track.org:** The authoritative US Space Command database. Highly accurate, but requires an authenticated account (API key) and strict adherence to rate limiting, making it less ideal for direct integration into client-side ham radio flashing tools.

## 4. Definition of Keplerian Elements

Keplerian elements are the mathematical parameters required to define an orbit and the position of a satellite within that orbit at a specific point in time.


|                                           |            |                                                                                                                                                                                              |
| ----------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Element**                               | **Symbol** | **Definition**                                                                                                                                                                               |
| **Epoch**                                 | $t_0$      | The exact timestamp (Year and Julian Day) at which the given orbital elements are absolutely true. All tracking calculations extrapolate from this time.                                     |
| **Inclination**                           | $i$        | The angle between the equator and the orbital plane. $0^{\circ}$ is equatorial, $90^{\circ}$ is polar.                                                                                       |
| **Right Ascension of the Ascending Node** | $\Omega$   | The angle measured eastward from the vernal equinox to the point where the orbit crosses the equator from south to north. Defines the rotation of the orbital plane around the Earth's axis. |
| **Eccentricity**                          | $e$        | Defines the shape of the orbit. $0$ is a perfect circle, values between $0$ and $1$ form an ellipse.                                                                                         |
| **Argument of Perigee**                   | $\omega$   | The angle measured from the Ascending Node to the perigee (the orbit's closest point to Earth). This defines the orientation of the ellipse within the orbital plane.                        |
| **Mean Anomaly**                          | $M$        | The phase of the satellite in its orbit at the Epoch. Represents an angle progressing uniformly over time from $0^{\circ}$ to $360^{\circ}$.                                                 |
| **Mean Motion**                           | $n$        | The speed of the satellite, expressed in revolutions per day. This determines the orbital period and altitude.                                                                               |
| **BSTAR (Drag Term)**                     | $B^*$      | An empirical parameter modeling atmospheric drag and solar radiation pressure, dictating how quickly the orbit decays.                                                                       |


## 5. Engineering Considerations for the Tool

When building the agent and ingestion pipeline for the tool, consider the following constraints:

- **Parsing Strictness:** TLE line lengths and column indexing are immutable. The tool must validate the modulo-10 checksum at the end of Line 1 and Line 2 before attempting to push data to the radio.
- **Data Transformation:** While the tool fetches TLEs, the target radios often require the data to be packed into specific binary structures via the serial protocol. The agent will need to implement the mathematical conversions (e.g., parsing the decimal-point-implied formats in TLE strings) into the precise variable types (floats, doubles, integers) expected by the OpenGD77 and D890 firmware.

## 6. UI & User Workflow Overview

Codeplug Studio operates as a browser-based CPS utilizing the Web Serial API. The fundamental UX philosophy for this feature is **decoupling**: modifying a channel codeplug is an infrequent, heavy task (done every few months), whereas updating Keps is a frequent, lightweight maintenance task (done every few days).

The UI will visually separate these concerns while allowing them to interact seamlessly during the physical serial write process.

### 7. The Keps Library View (Curating the Data)

Within the main "Library" navigation, a dedicated **"Satellite Keps"** tab will be introduced. This acts as the single source of truth for the user's orbital data.

- **Data Fetching:** A prominent "Update from CelesTrak/AMSAT" button. Crucially, the UI must display a **"Last Updated: [Timestamp]"** indicator. If the timestamp is older than 7 days, it should turn yellow/red to gently prompt the user to refresh.
- **Satellite Selection:** A data grid displaying the downloaded satellites (Name, Uplink/Downlink frequencies if available, Epoch date).
- **Toggles:** Users will have On/Off toggle switches next to each satellite. This allows users to curate a clean list of only the satellites they actively track (e.g., turning off dead telemetry satellites or modes they don't operate), saving valuable radio memory.
- **Global Write Button:** A primary action button floating or at the top: `Write Keps to Radio`.

### 8. The Write Workflows

The user can initiate a web-serial write to their radio via two distinct paths, accommodating different user intents.

#### Workflow A: Global Write (From the Library)

*Intended for the quick, bi-weekly update when the user just plugs in their radio to refresh orbital data.*

1. User navigates to the Keps Library and clicks `Write Keps to Radio`.
2. A modal window appears titled "Select Target Radio".
3. **Smart List Sorting:** The modal lists radios in two sections:
  - **Recommended / Your Radios:** Pulls from the user's curated Codeplug library (e.g., "Anytone D890 - Base Station", "OpenGD77 - SOTA Kit").
  - **Other Supported Radios:** A generic list (e.g., "Generic OpenGD77", "Generic Anytone 890") for ad-hoc writes to radios not stored in the user's profile.
4. User selects the radio. Codeplug Studio triggers the browser's Web Serial API prompt to connect to the COM port.
5. A progress bar displays the binary payload transfer, distinct from the UI used for codeplug writes.

#### Workflow B: Contextual Write (From the Export/Build Page)

*Intended for when the user is already deep in the process of flashing a new codeplug structure and wants to sync their Keps at the same time.*

1. User is on the specific "Build" page for a saved radio (e.g., their "OpenGD77 - SOTA Kit" profile).
2. In the action panel, alongside the primary `Write Codeplug` button, there is a secondary `Write Keps` button.
3. Clicking this **bypasses the radio selection modal entirely**, as the context (the specific radio model and memory map) is already known.
4. The browser immediately prompts for the Web Serial COM port connection.
5. The upload executes with a progress indicator.

### 9. UX Edge Cases & Error Handling

- **Memory Overages:** Radios have hard limits on satellite capacity. The Library view must dynamically show a count (e.g., "Selected: 42"). If the user initiates a write to an OpenGD77, and the selected count exceeds the firmware's limit, the write should halt with a clear error: *"You have selected 85 satellites, but the OpenGD77 only supports 45. Please deselect some satellites in the library."*
- **COM Port Collisions:** Since the user might attempt to click `Write Codeplug` and `Write Keps` in rapid succession on the Build page, the UI must disable the adjacent button while a serial write lock is active to prevent port crashing.

