import test from 'node:test';
import assert from 'node:assert/strict';
import {desiredBuzzer, patchPurifier} from './buzzerControl.js';
import {purifierDataUrl} from './firebase.js';

const settings = {enabled:true, hot:60, cold:15, hotDirection:'above', coldDirection:'below'};
test('inclusive thresholds trigger for either tank; both outside turns off', () => {
  for (const [hotTemperature,coldTemperature,expected] of [
    [59,16,0],[60,16,1],[61,16,1],[59,15,1],[59,14,1],[60,15,1],
  ]) assert.equal(desiredBuzzer({hotTemperature,coldTemperature},settings),expected);
});
test('zero thresholds and selectable directions are supported', () => {
  assert.equal(desiredBuzzer({hotTemperature:0,coldTemperature:32},{...settings,hot:0}),1);
  assert.equal(desiredBuzzer({hotTemperature:61,coldTemperature:32},{...settings,hotDirection:'below',coldDirection:'above'}),1);
  assert.equal(desiredBuzzer({hotTemperature:61,coldTemperature:14},{...settings,hotDirection:'below',coldDirection:'above'}),0);
});
test('missing readings cannot turn off; a known trigger can still turn on', () => {
  assert.equal(desiredBuzzer({hotTemperature:59,coldTemperature:null},settings),null);
  assert.equal(desiredBuzzer({hotTemperature:null,coldTemperature:16},settings),null);
  assert.equal(desiredBuzzer({hotTemperature:60,coldTemperature:null},settings),1);
  assert.equal(desiredBuzzer({hotTemperature:NaN,coldTemperature:16},settings),null);
});
test('disabled, absent, or invalid settings never write', () => {
  for (const config of [null,{}, {...settings,enabled:false},{...settings,hot:''},{...settings,hot:Infinity},{...settings,coldDirection:'invalid'}]) {
    assert.equal(desiredBuzzer({hotTemperature:60,coldTemperature:15},config),null);
  }
});
test('writes only numeric buzzer changes; reports failed writes without optimistic success', async () => {
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async (url,options)=>{calls.push({url,...options});return {ok:true}};
  try {
    await patchPurifier({buzzer:1});
    assert.equal(calls[0].url,purifierDataUrl);
    assert.equal(calls[0].method,'PATCH');
    assert.deepEqual(JSON.parse(calls[0].body),{buzzer:1});
    await patchPurifier({buzzer:0});
    assert.deepEqual(JSON.parse(calls[1].body),{buzzer:0});
    await patchPurifier({buzzer_thresholds:{...settings,enabled:false},buzzer:0});
    assert.deepEqual(JSON.parse(calls[2].body),{buzzer_thresholds:{...settings,enabled:false},buzzer:0});
    globalThis.fetch=async()=>({ok:false,status:403});
    await assert.rejects(patchPurifier({buzzer:1}),/HTTP 403/);
  } finally {globalThis.fetch=original}
});
