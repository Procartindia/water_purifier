import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePurifierData, waterLevel} from './purifierData.js';

const sample = (hotLevel, coldLevel, hotTemp = 60, coldTemp = 15) => ({
  sensor: {hot_level_watersensor: hotLevel, cold_level_watersensor: coldLevel},
  temperature: {hot_temp: hotTemp, cold_temp: coldTemp},
  buzzer_thresholds: {hot: 60, cold: 15, hotDirection: 'above', coldDirection: 'below', enabled: false},
});

test('overflow starts strictly above 3500 and retains raw readings', () => {
  for (const [level, expected] of [[0,false],[500,false],[3000,false],[3200,false],[3500,false],[3501,true],['3600',true],[null,null],[-1,null],['invalid',null]]) {
    const value = normalizePurifierData(sample(level,level));
    assert.equal(value.hotOverflow,expected);
    assert.equal(value.coldOverflow,expected);
  }
  assert.equal(normalizePurifierData(sample(3600,1500)).hotSensor,3600);
  assert.equal(normalizePurifierData(sample(3600,1500)).hotLevel,100);
  assert.equal(normalizePurifierData(sample(3600,1500)).coldLevel,50);
});
test('overheat checks only hot temperature, independent of cold readings and buzzer settings', () => {
  for (const [hot,cold,expected] of [[60,15,false],[60.1,15,true],[60,15.1,false],[59,100,false],[0,0,false],[null,14,null],[61,null,true],[59,null,false]]) {
    assert.equal(normalizePurifierData(sample(50,50,hot,cold)).overheat,expected);
  }
});
test('absent hot thresholds are unknown; device overflow alerts remain active', () => {
  const data = sample(50,50,59,14);
  delete data.buzzer_thresholds;
  assert.equal(normalizePurifierData(data).overheat,null);
  assert.equal(normalizePurifierData({...sample(50,50,59,14),overheat:1,hotOverflow:1}).overheat,false);
  assert.equal(normalizePurifierData({...sample(50,50),hotOverflow:1}).hotOverflow,true);
  assert.equal(normalizePurifierData({...sample(3501,1500,61,14),hotOverflow:0,overheat:0}).hotOverflow,true);
  assert.equal(normalizePurifierData({...sample(3501,1500,61,14),overheat:0}).overheat,true);
});

test('low water uses either tank and requires both known to report safe', () => {
  for (const [hot,cold,expected] of [[0,3000,true],[499,3000,true],[3000,499,true],[500,3000,false],[3000,3200,false],[null,3000,null],[499,null,true],[-1,3000,null]]) {
    assert.equal(normalizePurifierData(sample(hot,cold)).lowWater,expected);
  }
});
test('visual fill uses 3000 as full and saturates without triggering overflow', () => {
  for (const [raw,percent] of [[0,0],[1500,50],[3000,100],[3200,100],[3500,100],[3600,100],[null,null],[-1,null]]) {
    assert.equal(waterLevel(raw).percent,percent);
  }
});
