import {waterLevel} from './purifierData.js';

export function getReminders(readings) {
  const messages = [];
  if (readings.overheat === true) messages.push('Hot water is above its temperature threshold. Check the heater and allow the water to cool.');
  for (const kind of ['hot', 'cold']) {
    const name = kind === 'hot' ? 'Hot' : 'Cold';
    if (readings[`${kind}Overflow`] === true) messages.push(`${name} tank overflow. Stop filling and check the water inlet.`);
  }
  if (readings.lowWater === true) {
    const tanks = ['hot', 'cold'].filter(kind => waterLevel(readings[`${kind}Sensor`]).low === true);
    messages.push(tanks.length === 2 ? 'Both tanks are low. Refill the hot and cold water tanks.'
      : tanks.length === 1 ? `${tanks[0] === 'hot' ? 'Hot' : 'Cold'} tank is low. Refill the tank.`
      : 'Low water detected. Check and refill the affected tank.');
  }
  const incomplete = ['lowWater', 'hotOverflow', 'coldOverflow', 'overheat'].some(key => typeof readings[key] !== 'boolean');
  if (incomplete) messages.push('Some readings or thresholds are unavailable. Check the connection and saved hot threshold.');
  return {messages, warning: [readings.lowWater, readings.hotOverflow, readings.coldOverflow, readings.overheat].includes(true), incomplete};
}
