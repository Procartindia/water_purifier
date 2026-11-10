// Presentation-only cooling sequence for the control labeled Relay 2 (relay3).
// Keep Firebase readings intact for device monitoring and buzzer automation.
export function createColdDisplay() {
  let value = null;
  let lastStep = null;
  const reset = () => {value = null; lastStep = null;};
  return {
    reset,
    update(readings, now = Date.now()) {
      const measured = readings.coldTemperature;
      if (readings.relayStates?.relay3 !== true) {
        if (readings.relayStates?.relay3 === false) reset();
        return measured;
      }
      if (lastStep === null) {
        if (typeof measured !== 'number' || !Number.isFinite(measured)) return null;
        value = measured; lastStep = now;
      } else if (now - lastStep >= 3000) {
        // Elapsed time drives the display independently of Firebase polling.
        const steps = Math.floor((now - lastStep) / 3000);
        if (value > 15) value = Math.max(15, value - steps);
        lastStep += steps * 3000;
      }
      return value;
    },
  };
}
