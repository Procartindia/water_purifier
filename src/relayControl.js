import {purifierDataUrl} from './firebase.js';

export const relayStages = [
  {key: 'relay1hot', label: 'Relay 1'},
  {key: 'relay3', label: 'Relay 2'},
  {key: 'relay4', label: 'Relay 3'},
];

export async function setRelay(key, value, signal) {
  if (!relayStages.some(stage => stage.key === key) || ![0, 1].includes(value)) {
    throw Error('Invalid relay or state.');
  }
  const response = await fetch(purifierDataUrl.replace(/\.json$/, '/relay.json'), {
    method: 'PATCH', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({[key]: value}), signal,
  });
  if (!response.ok) throw Error(`Relay update failed (HTTP ${response.status}). Check Firebase write permissions.`);
}
