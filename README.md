# Smart Water Purifier dashboard

React/Vite dashboard based on the supplied design. It shows two 5 L tanks, temperatures and levels, heater and cooling, overflow and overheat conditions, hydration reminder, button and buzzer, filtration stages and safety alerts. No quotation numbers appear in the application.

## Run on Windows
1. Install Node.js version 20 or later.
2. Extract the ZIP and open a terminal inside the `ks5615` folder.
3. Run `npm install` and then `npm run dev`.
4. Open http://localhost:5615 in a browser. This project uses port 5615 to avoid conflicts with other apps on Vite's default port 5173. If port 5615 is occupied, Vite reports an error instead of silently switching ports.

## Firebase connection
The dashboard automatically reads `water_purifier` from the configured Firebase Realtime Database every five seconds using its REST API. Configuration is in `src/firebase.js`. The dashboard monitors readings and can save temperature thresholds and control the buzzer. It also provides manual ON/OFF controls for three relay fields.

Default endpoint: https://diet-planner-3bdf3-default-rtdb.firebaseio.com/water_purifier.json

| Firebase field | Dashboard field |
| --- | --- |
| `temperature/hot_temp` | Hot water temperature (?C) |
| `temperature/cold_temp` | Cold water temperature (?C) |
| `relay/relay1hot` | Heater (1 = ON, 0 = OFF) |
| `relay/relay2cold` | Cooling (1 = ON, 0 = OFF) |
| `sensor/hot_level_watersensor` | Hot raw water-level reading; estimated tank fill |
| `sensor/cold_level_watersensor` | Cold raw water-level reading; estimated tank fill |
| `buzzer` | Buzzer (1 = ON, 0 = OFF) |

Water-level sensors use raw readings. Below 500 is LOW; 3000-3200 is FULL; strictly above 3500 is OVERFLOW. The visual fill is estimated as reading / 3000, capped at 100%, with raw readings displayed beside each tank. Values from 3201 through 3500 stay full without an overflow alert. Either tank below 500 triggers the combined Low water alert. At exactly 500 it is not low; at exactly 3500 it is not overflow. Missing, invalid, or negative readings remain unknown. Zero is a valid low reading.

Optional fields `hotOverflow`, `coldOverflow`, `overheat`, `lowWater`, `sensorError`, `hydrationReminder`, and `buttonPressed` accept booleans or 0/1. Missing or invalid fields remain unknown. The buzzer is not used to infer a hydration reminder. Relay display assumes 1 = ON; confirm this matches the controller firmware. The database has no device timestamp, so the update time indicates the last successful fetch, not device freshness.

Expand **Live data connection** to use a different JSON endpoint or disconnect. Your selection is saved in this browser. Legacy flat endpoints with `hotLevel`, `coldLevel` (raw sensor readings on the same scale), `hotTemperature`, `coldTemperature`, `heater`, `cooling`, and the optional fields above remain supported.

On connection errors, displayed readings are cleared. The endpoint must permit reads and browser CORS access. No authentication is needed under the current database rules; protected rules would require an authentication integration.

Tank capacity and one-hour reminder interval are fixed design specifications. The controller must independently implement heater, cooling, safety, reminder, and physical-button behavior.

## Temperature buzzer thresholds
Enter hot and cold thresholds in the Temperature Buzzer panel, choose each trigger direction, and press **Save thresholds**. The defaults are hot at/above and cold at/below; neither threshold has an invented default temperature. Values are saved under `water_purifier/buzzer_thresholds` with numeric `hot` and `cold`, `hotDirection` and `coldDirection` (`above` or `below`), and boolean `enabled`.

When enabled, only a hot or cold temperature threshold trigger starts an ON cycle of up to ten seconds. After a successful OFF write, the buzzer remains OFF for a full ten seconds. At that deadline, the dashboard fetches fresh Firebase readings. If either temperature trigger is still active, another ON cycle starts; otherwise it stays OFF and continues normal monitoring. Requests started before the OFF deadline cannot restart a cycle. New warnings do not bypass the OFF interval.

The cycle deadlines are saved in this browser across reloads. Missing readings do not cancel the OFF timer or trigger an ON cycle. Failed OFF writes retry and show an error; the ten-second OFF interval starts only once the OFF write succeeds. A countdown shows the remaining OFF interval.

Use one dashboard controller tab and keep it open and connected. Browser throttling, closure, or network outages can delay writes. A strict hardware limit requires a device-side timer. The serial display reflects Firebase's buzzer value.

Implementation reference: https://firebase.google.com/docs/database/rest/save-data

## Derived safety alerts
Hot/cold overflow alerts when the corresponding raw reading is greater than 3500. The combined overflow alert is active if either tank overflows, safe only when both are known safe, and unknown otherwise.

Overheat alerts only when the hot temperature is strictly greater than the saved hot threshold. Equality is Safe. Cold temperature, buzzer enablement, trigger direction, and the device overheat flag do not affect this display. Missing hot temperature or hot threshold reports Unknown. Explicit device overflow alerts still remain active even if calculated levels are safe.

The Sensor error row is fixed to Safe as requested for this presentation; it does not reflect sensor health or change the Firebase sensorError value.

These derived safety indicators update on each refresh in the dashboard; they do not write safety flags to Firebase or alter the existing buzzer rule.

## Warning reminders
The Reminder panel shows all active overflow, low-water, and hot-temperature warnings with actions for the affected tanks. It updates with each data refresh and clears resolved warnings. Missing readings or thresholds show a waiting message instead of an all-clear. The panel displays the actual buzzer state; reminders do not change the temperature-based buzzer rule.

## Manual relay controls
Display Relay 1 maps to `water_purifier/relay/relay1hot`, Relay 2 to `relay3`, and Relay 3 to `relay4`. The former Stage 2 (`relay2cold`) control is hidden; its Firebase field is unchanged. ON writes numeric 1 and OFF writes numeric 0. Each request updates only the selected field using PATCH on the relay node. After a successful write, the dashboard refreshes the saved states. Failed writes are reported without displaying a successful change. Controls are available only when connected to the configured Firebase database. The controller must consume these relay fields to operate the hardware.

## Arduino TFT serial display (Windows)
The supplied Arduino sketch is a USB serial receiver, not a Firebase client. Run `npm run display -- -Port COM13` in a separate terminal while the Arduino is connected. With exactly one serial port, `npm run display` selects it automatically. Keep Arduino Serial Monitor/Plotter closed because only one process can own the port. Stop the bridge with Ctrl+C.

The bridge reads Firebase every second and sends 9600-baud, 8N1, newline-terminated CSV in this exact order:

`hot_temp,cold_temp,hot_level_watersensor,cold_level_watersensor,relay1hot,relay2cold,relay3,relay4,buzzer`

Levels are raw readings, not percentages. All four physical relay fields are sent, including relay2cold, which is hidden from the dashboard controls. The Arduino display now matches the dashboard: RELAY 1 shows relay1hot, RELAY 2 shows relay3, and RELAY 3 shows relay4. The relay2cold field is received for protocol compatibility but is not displayed. No sketch change is required for these nine fields. The styled sketch shows LOW WATER, NORMAL, FULL, or OVERFLOW beneath each level bar. It does not display reminder or temperature-threshold text and ignores the optional tenth status field.

Packets repeat even when values are unchanged so the sketch's five-second timeout does not blank the display. Missing/invalid fields or Firebase read failures pause transmission instead of fabricating values; the sketch then clears its values. Fetch time is not device freshness: the Firebase schema has no device timestamp. The bridge reads Firebase and writes only to the serial display; buzzer automation still runs in the dashboard. It does not flash firmware or toggle hardware relays.

`npm run test:display` checks packet formatting without connecting hardware.

The supplied sketch is saved in `firmware/water_purifier_display/water_purifier_display.ino`. The older sketch on COM13 rejected nine-field packets; the supplied version was compiled for `arduino:avr:uno`, uploaded, and verified by its `DATA RECEIVED` serial replies for all nine fields. It uses MCUFRIEND_kbv and Adafruit GFX. A matching nine-field receiver must remain installed for this bridge to work.

The TFT layout uses a 320x240 landscape canvas with a water-drop header, double outer border, bordered sensor/relay cards, raw water levels and estimated fill bars, and LIVE/WAIT connection status. Only changed value areas are repainted to reduce flicker.



## Manual buzzer control
The Temperature Buzzer panel includes ON (1) and OFF (0) buttons. Manual ON runs for up to ten seconds, even when warning automation is disabled or all conditions are clear. It does not extend an already active ten-second cycle. OFF immediately writes zero and starts a ten-second OFF interval before automatic rechecking. Manual ON deliberately overrides the OFF interval. Manual write failures appear on screen; displayed success is updated only after Firebase accepts the write.

## Relay 2 cold-temperature display
While the dashboard control labeled Relay 2 (Firebase relay3) is ON, the cold tank display starts from the measured temperature and decreases by 1 degree C every three seconds using a separate display timer, stopping at 15 degrees C. Extra UI refreshes do not accelerate the sequence. A reading already below 15 is left unchanged. Switching OFF restores the latest Firebase temperature. Once it reaches 15 it stays at 15 until the relay is observed OFF. Temporary missing data does not reset the sequence; changing sources resets it. This presentation-only value does not overwrite Firebase, alter the raw temperature used for buzzer checks, or change the Arduino serial feed.

Automatic buzzer activation ignores water levels, overflow, sensor-error flags, and the separate overheat flag; only the configured hot/cold temperature comparisons apply. Low-water and overflow indicators and reminders remain visible. Manual ON/OFF controls remain available.
