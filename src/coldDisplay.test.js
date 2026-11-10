import test from 'node:test';
import assert from 'node:assert/strict';
import {createColdDisplay} from './coldDisplay.js';
const reading=(temperature,on)=>({coldTemperature:temperature,relayStates:{relay3:on}});
test('displayed Relay 2 lowers cold temperature by one per three seconds independently of Firebase updates and stops at 15',()=>{
  const display=createColdDisplay();
  assert.equal(display.update(reading(17.5,true),0),17.5);
  assert.equal(display.update(reading(30,true),1000),17.5);
  assert.equal(display.update(reading(30,true),3000),16.5);
  assert.equal(display.update(reading(30,true),6000),15.5);
  assert.equal(display.update(reading(30,true),13000),15);
  assert.equal(display.update(reading(30,true),12000),15);
});
test('OFF restores current Firebase reading and the next ON starts from that reading',()=>{
  const display=createColdDisplay();
  const source=reading(30,true);
  display.update(source,0);assert.equal(display.update(source,3000),29);
  assert.equal(source.coldTemperature,30);
  assert.equal(display.update(reading(32,false),6000),32);
  assert.equal(display.update(reading(32,true),7000),32);
  assert.equal(display.update(reading(32,true),10000),31);
});
test('15 stays fixed despite changing or missing Firebase temperatures until relay OFF',()=>{
  const display=createColdDisplay();
  display.update(reading(16,true),0);
  assert.equal(display.update(reading(40,true),3000),15);
  assert.equal(display.update(reading(null,true),6000),15);
  assert.equal(display.update(reading(50,true),60000),15);
  assert.equal(display.update(reading(28,false),61000),28);
  assert.equal(display.update(reading(28,true),62000),28);
});
test('extra refreshes do not accelerate timing and delayed updates catch up',()=>{
  const display=createColdDisplay();
  display.update(reading(25,true),0);
  assert.equal(display.update(reading(30,true),2999),25);
  assert.equal(display.update(reading(30,true),3000),24);
  assert.equal(display.update(reading(30,true),5000),24);
  assert.equal(display.update(reading(30,true),9000),22);
  display.reset();assert.equal(display.update(reading(29,true),10000),29);
});
