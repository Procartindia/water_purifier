import test from 'node:test';
import assert from 'node:assert/strict';
import {getReminders} from './reminders.js';
const safe = {hotSensor:3000,coldSensor:3000,lowWater:false,hotOverflow:false,coldOverflow:false,overheat:false};
test('reminders reflect affected tanks and all simultaneous warnings', () => {
  const result=getReminders({...safe,hotSensor:0,coldSensor:0,lowWater:true,overheat:true});
  assert.equal(result.warning,true);
  assert.equal(result.messages.length,2);
  assert.match(result.messages.join(' '),/Both tanks/);
  const mixed=getReminders({...safe,hotSensor:3600,coldSensor:100,hotOverflow:true,lowWater:true});
  assert.match(mixed.messages.join(' '),/Hot tank overflow/);
  assert.match(mixed.messages.join(' '),/Cold tank is low/);
});
test('resolved warnings clear and missing data never produces an all-clear', () => {
  assert.deepEqual(getReminders(safe),{messages:[],warning:false,incomplete:false});
  assert.equal(getReminders({}).incomplete,true);
  assert.ok(getReminders({}).messages.length>0);
});
