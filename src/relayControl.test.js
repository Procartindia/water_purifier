import test from 'node:test';
import assert from 'node:assert/strict';
import {relayStages, setRelay} from './relayControl.js';
import {normalizePurifierData} from './purifierData.js';
import {purifierDataUrl} from './firebase.js';

test('three displayed relays retain their original Firebase mappings', async () => {
  assert.deepEqual(relayStages, [
    {key:'relay1hot',label:'Relay 1'},
    {key:'relay3',label:'Relay 2'},
    {key:'relay4',label:'Relay 3'},
  ]);
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {calls.push({url, ...options}); return {ok:true};};
  try {
    for (const stage of relayStages) {
      for (const value of [1,0]) {
        await setRelay(stage.key,value);
        const call = calls.at(-1);
        assert.equal(call.url,purifierDataUrl.replace(/\.json$/, '/relay.json'));
        assert.equal(call.method,'PATCH');
        assert.deepEqual(JSON.parse(call.body),{[stage.key]:value});
      }
    }
    await assert.rejects(setRelay('unknown',1),/Invalid relay/);
    await assert.rejects(setRelay('relay3','1'),/Invalid relay/);
    await assert.rejects(setRelay('relay2cold',1),/Invalid relay/);
    assert.equal(calls.length,6);
    globalThis.fetch = async () => ({ok:false,status:403});
    await assert.rejects(setRelay('relay4',0),/HTTP 403/);
  } finally {globalThis.fetch = original;}
});
test('saved relay states include all four stages and leave missing values unknown', () => {
  const readings = normalizePurifierData({relay:{relay1hot:1,relay2cold:0,relay3:'1',relay4:'0'}});
  assert.deepEqual(readings.relayStates,{relay1hot:true,relay2cold:false,relay3:true,relay4:false});
  assert.equal(readings.heater,true);
  assert.equal(readings.cooling,false);
  assert.equal(normalizePurifierData({relay:{}}).relayStates.relay3,null);
});
