const number = value => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};
const flag = value => value === true || value === 1 || value === '1' ? true
  : value === false || value === 0 || value === '0' ? false : null;
const withDeviceAlert = (derived, reported) => reported === true ? true : derived ?? reported;

export function waterLevel(value) {
  const raw = number(value);
  if (raw === null || raw < 0) return {percent: null, low: null, overflow: null};
  return {percent: Math.min(100, Math.round(raw / 3000 * 100)), low: raw < 500, overflow: raw > 3500};
}

export function deriveSafety(readings, thresholds) {
  const hot = waterLevel(readings.hotSensor), cold = waterLevel(readings.coldSensor);
  const overheated = kind => {
    const temperature = readings[`${kind}Temperature`];
    const threshold = number(thresholds?.[kind]);
    return typeof temperature === 'number' && Number.isFinite(temperature) && threshold !== null
      ? temperature > threshold : null;
  };
  return {
    hotOverflow: withDeviceAlert(hot.overflow, readings.hotOverflow),
    coldOverflow: withDeviceAlert(cold.overflow, readings.coldOverflow),
    lowWater: withDeviceAlert(hot.low === true || cold.low === true ? true
      : hot.low === false && cold.low === false ? false : null, readings.lowWater),
    overheat: overheated('hot'),
  };
}

export function normalizePurifierData(data) {
  const nested = ['relay', 'sensor', 'temperature'].some(key => key in data);
  const hotSensor = number(nested ? data.sensor?.hot_level_watersensor : data.hotLevel);
  const coldSensor = number(nested ? data.sensor?.cold_level_watersensor : data.coldLevel);
  const readings = {
    // Estimated visual fill: raw 3000 marks full; retain raw readings for alerts.
    hotLevel: waterLevel(hotSensor).percent,
    coldLevel: waterLevel(coldSensor).percent,
    hotSensor,
    coldSensor,
    hotTemperature: number(nested ? data.temperature?.hot_temp : data.hotTemperature),
    coldTemperature: number(nested ? data.temperature?.cold_temp : data.coldTemperature),
    heater: flag(nested ? data.relay?.relay1hot : data.heater),
    cooling: flag(nested ? data.relay?.relay2cold : data.cooling),
    relayStates: Object.fromEntries(['relay1hot', 'relay2cold', 'relay3', 'relay4']
      .map(key => [key, flag(data.relay?.[key])])),
    buzzer: flag(data.buzzer),
    ...Object.fromEntries(['hotOverflow', 'coldOverflow', 'overheat', 'lowWater',
      'sensorError', 'hydrationReminder', 'buttonPressed'].map(key => [key, flag(data[key])])),
  };
  return {...readings, ...deriveSafety(readings, data.buzzer_thresholds)};
}
