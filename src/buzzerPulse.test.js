import test from 'node:test';
import assert from 'node:assert/strict';
import {createBuzzerPulse} from './buzzerPulse.js';
const settings={enabled:true,hot:60,cold:15,hotDirection:'above',coldDirection:'below'};
const clear={hotTemperature:59,coldTemperature:32,hotSensor:1500,coldSensor:1500,hotOverflow:false,coldOverflow:false,buzzer:false};
const hot={...clear,hotTemperature:60};
function rig(saved=new Map(), start=1000){
  let time=start, failOff=false, checks=0;
  const jobs=new Set(),writes=[],errors=[];
  const controller=createBuzzerPulse({
    now:()=>time,
    write:async value=>{if(value===0&&failOff)throw Error('offline');writes.push(value)},
    storage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},
    schedule:(fn,delay)=>{const job={fn,at:time+delay};jobs.add(job);return job},cancel:job=>jobs.delete(job),
    onError:error=>errors.push(error),onRecheck:()=>{checks++},
  });
  controller.start();
  return {controller,writes,errors,saved,checks:()=>checks,now:()=>time,failOff:value=>{failOff=value},
    async advance(ms){time+=ms;for(const job of [...jobs])if(job.at<=time){jobs.delete(job);await job.fn()}}};
}
test('ten seconds ON, ten seconds OFF, fresh check, then repeat the same warning',async()=>{
  const r=rig();await r.controller.sync(hot,settings);
  await r.advance(9999);assert.deepEqual(r.writes,[1]);
  await r.advance(1);assert.deepEqual(r.writes,[1,0]);
  await r.controller.sync(hot,settings);assert.deepEqual(r.writes,[1,0]);
  await r.advance(9999);assert.equal(r.checks(),0);
  await r.advance(1);assert.equal(r.checks(),1);assert.deepEqual(r.writes,[1,0]);
  await r.controller.sync(hot,settings);assert.deepEqual(r.writes,[1,0,1]);
  await r.advance(10000);assert.deepEqual(r.writes,[1,0,1,0]);
});
test('cleared or unknown fresh readings keep buzzer OFF after the interval',async()=>{
  for(const current of [clear,{}]){
    const r=rig();await r.controller.sync(hot,settings);await r.advance(10000);await r.advance(10000);
    await r.controller.sync({...current,buzzer:false},settings);assert.deepEqual(r.writes,[1,0]);
  }
});
test('an in-flight pre-deadline snapshot cannot restart the buzzer',async()=>{
  const r=rig();await r.controller.sync(hot,settings);await r.advance(10000);
  const oldTime=r.now();await r.advance(10000);
  await r.controller.sync(hot,settings,oldTime);assert.deepEqual(r.writes,[1,0]);
  await r.controller.sync(hot,settings,r.now());assert.deepEqual(r.writes,[1,0,1]);
});
test('each temperature independently triggers without bypassing the OFF interval',async()=>{
  for(const change of [{hotTemperature:60},{coldTemperature:15}]){
    const r=rig();const active={...clear,...change};await r.controller.sync(active,settings);
    await r.advance(10000);await r.controller.sync({...active,hotSensor:0},settings);
    assert.deepEqual(r.writes,[1,0]);await r.advance(10000);await r.controller.sync(active,settings);
    assert.deepEqual(r.writes,[1,0,1]);
  }
});
test('water-level and other safety alerts never activate the automatic buzzer',async()=>{
  for(const change of [{hotSensor:0},{coldSensor:0},{hotSensor:3600,hotOverflow:true},{coldSensor:3600,coldOverflow:true},{lowWater:true,sensorError:true,overheat:true}]){
    const r=rig();await r.controller.sync({...clear,...change},settings);
    await r.advance(20000);assert.deepEqual(r.writes,[]);
  }
});
test('remaining low water cannot keep the buzzer running after temperatures clear',async()=>{
  const r=rig();await r.controller.sync(hot,settings);
  await r.controller.sync({...clear,hotSensor:0,coldSensor:0,lowWater:true,buzzer:true},settings);
  assert.deepEqual(r.writes,[1,0]);await r.advance(10000);
  await r.controller.sync({...clear,hotSensor:0,coldSensor:0,lowWater:true},settings);
  assert.deepEqual(r.writes,[1,0]);
});
test('reload preserves the remaining OFF interval',async()=>{
  const r=rig();await r.controller.sync(hot,settings);await r.advance(10000);
  const restored=rig(r.saved,r.now());await restored.controller.sync(hot,settings);
  assert.deepEqual(restored.writes,[]);await restored.advance(10000);
  assert.equal(restored.checks(),1);await restored.controller.sync(hot,settings);assert.deepEqual(restored.writes,[1]);
});
test('failed OFF retries; ten-second OFF interval starts only after successful write',async()=>{
  const r=rig();await r.controller.sync(hot,settings);r.failOff(true);await r.advance(10000);
  assert.match(r.errors.at(-1),/OFF failed/);r.failOff(false);await r.advance(1000);
  await r.advance(9999);assert.equal(r.checks(),0);await r.advance(1);assert.equal(r.checks(),1);
});
test('manual ON works with automation disabled; manual OFF starts a full OFF interval',async()=>{
  const r=rig(),disabled={...settings,enabled:false};
  await r.controller.manual(1,clear,disabled);await r.controller.sync({...clear,buzzer:true},disabled);
  await r.advance(10000);assert.deepEqual(r.writes,[1,0]);await r.advance(10000);
  await r.controller.sync(hot,disabled);assert.deepEqual(r.writes,[1,0]);
  const a=rig();await a.controller.sync(hot,settings);await a.controller.manual(0,hot,settings);
  await a.controller.sync(hot,settings);assert.deepEqual(a.writes,[1,0]);
  await a.advance(10000);await a.controller.sync(hot,settings);assert.deepEqual(a.writes,[1,0,1]);
});
test('manual ON deliberately overrides OFF wait without extending an already running pulse',async()=>{
  const r=rig();await r.controller.sync(hot,settings);await r.advance(10000);
  await r.controller.manual(1,clear,settings);await r.advance(5000);
  await r.controller.manual(1,clear,settings);await r.advance(5000);
  assert.deepEqual(r.writes,[1,0,1,1,0]);
});
test('disabling stops active automation; failed ON does not start a cycle',async()=>{
  const r=rig();await r.controller.sync(hot,settings);await r.controller.sync({...hot,buzzer:true},{...settings,enabled:false});
  assert.deepEqual(r.writes,[1,0]);
  let attempts=0;
  const controller=createBuzzerPulse({write:async()=>{if(++attempts===1)throw Error('offline')},schedule:()=>0,cancel:()=>{}});
  await assert.rejects(controller.sync(hot,settings),/offline/);await controller.sync(hot,settings);assert.equal(attempts,2);
});
