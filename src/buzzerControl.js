import {purifierDataUrl} from './firebase.js';

export const buzzerConditions = {
  hot: 'Hot temperature', cold: 'Cold temperature',
};

export function warningTriggers(readings, settings) {
  return temperatureTriggers(readings, settings);
}

export function validThresholds(settings) {
  return settings && ['hot', 'cold'].every(kind =>
    typeof settings[kind] === 'number' && Number.isFinite(settings[kind]) &&
    ['above', 'below'].includes(settings[`${kind}Direction`]));
}

export function desiredBuzzer(readings, settings) {
  if (!validThresholds(settings) || settings.enabled !== true) return null;
  const reached = kind => {
    const value = readings[`${kind}Temperature`];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return settings[`${kind}Direction`] === 'above'
      ? value >= settings[kind] : value <= settings[kind];
  };
  const hot = reached('hot'), cold = reached('cold');
  if (hot === true || cold === true) return 1;
  // Missing readings cannot establish that both temperatures are outside their trigger range.
  return hot === false && cold === false ? 0 : null;
}

export function temperatureTriggers(readings, settings) {
  if (settings?.enabled !== true) return null;
  return Object.fromEntries(['hot', 'cold'].map(kind => {
    const value = readings[`${kind}Temperature`];
    const active = typeof value === 'number' && Number.isFinite(value) &&
      typeof settings[kind] === 'number' && Number.isFinite(settings[kind]) &&
      ['above','below'].includes(settings[`${kind}Direction`])
      ? settings[`${kind}Direction`] === 'above' ? value >= settings[kind] : value <= settings[kind]
      : null;
    return [kind, active];
  }));
}

export async function patchPurifier(changes, signal) {
  const response = await fetch(purifierDataUrl, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(changes),
    signal,
  });
  if (!response.ok) throw Error(`Firebase write failed (HTTP ${response.status}). Check database write permissions.`);
}
