import {patchPurifier, warningTriggers, buzzerConditions} from './buzzerControl.js';

export const BUZZER_DURATION = 10000;
export const BUZZER_OFF_DURATION = 10000;
const STORAGE_KEY = 'purifier_buzzer_pulse_v1';
const initialState = () => ({...Object.fromEntries(Object.keys(buzzerConditions).map(key=>[key,false])), until:0, cooldownUntil:0});

// Every cycle requires a full OFF interval and a fresh reading after that interval.
export function nextPulse(previous, triggers, now, observedAt = now) {
  const state = {...previous};
  if (triggers) {
    for (const kind of Object.keys(buzzerConditions)) {
      if (typeof triggers[kind] === 'boolean') state[kind] = triggers[kind];
    }
  }
  if (state.until && state.until <= now) {
    state.until = 0; state.manual = false;
    state.cooldownUntil = now + BUZZER_OFF_DURATION;
    return state;
  }
  if (state.until) {
    if (!state.manual && triggers && Object.values(triggers).every(value=>value===false)) {
      state.until=0; state.cooldownUntil=now+BUZZER_OFF_DURATION;
    }
    return state;
  }
  if (state.cooldownUntil && (now < state.cooldownUntil || observedAt < state.cooldownUntil)) return state;
  state.cooldownUntil = 0;
  if (triggers && Object.values(triggers).some(value=>value===true)) state.until=now+BUZZER_DURATION;
  return state;
}

export function createBuzzerPulse({
  write = value => patchPurifier({buzzer:value}, AbortSignal.timeout(5000)),
  storage,
  now = Date.now,
  schedule = setTimeout,
  cancel = clearTimeout,
  onState = () => {},
  onError = () => {},
  onStatus = () => {},
  onRecheck = () => {},
} = {}) {
  let state = initialState();
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved.hot === 'boolean' && typeof saved.cold === 'boolean' &&
        Number.isFinite(saved.until) && saved.until >= 0) state = {...state,...saved};
  } catch { /* Storage unavailable: timing still works in this session. */ }
  let timer;
  let queue = Promise.resolve();
  let stopped = false;
  let lastTriggers = null;
  const report = () => onStatus({until:state.until,cooldownUntil:state.cooldownUntil,triggers:lastTriggers,latched:{...state}});
  const persist = () => {
    try {storage?.setItem(STORAGE_KEY, JSON.stringify(state));} catch { /* Session only. */ }
  };
  const enqueue = task => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };
  const arm = () => {
    cancel(timer);
    if (stopped) return;
    if (state.until) timer = schedule(() => expire().catch(() => {}), Math.max(0, state.until - now()));
    else if (state.cooldownUntil > now()) timer = schedule(() => {report(); onRecheck();}, state.cooldownUntil-now());
  };
  const expire = () => enqueue(async () => {
    if (!state.until) return;
    if (now() < state.until && !stopped) {arm(); return;}
    try {
      await write(0);
      state.until = 0; state.manual = false; state.cooldownUntil=now()+BUZZER_OFF_DURATION; persist(); arm(); onState(false); onError(''); report();
    } catch (error) {
      onError(`Buzzer OFF failed: ${error.message}. Retrying.`);
      // Retry the OFF command even if temperature polling has failed.
      timer = schedule(() => expire().catch(() => {}), 1000);
      throw error;
    }
  });
  return {
    manual(value, readings, settings) {
      return enqueue(async () => {
        if (value !== 0 && value !== 1) throw Error('Buzzer state must be 0 or 1.');
        const triggers = warningTriggers(readings, settings);
        const next = {...state};
        for (const key of Object.keys(buzzerConditions)) {
          if (typeof triggers?.[key] === 'boolean') next[key] = triggers[key];
        }
        next.enabled = settings?.enabled === true;
        next.manual = value === 1;
        next.until = value === 1 ? state.until > now() ? state.until : now() + BUZZER_DURATION : 0;
        next.cooldownUntil = value === 1 ? 0 : now()+BUZZER_OFF_DURATION;
        await write(value);
        if(value===0)next.cooldownUntil=now()+BUZZER_OFF_DURATION;
        state = next; lastTriggers = triggers; persist(); arm();
        onState(Boolean(value)); onError(''); report();
      });
    },
    start() {stopped = false; arm(); report(); if(!state.until && state.cooldownUntil && state.cooldownUntil<=now())onRecheck();},
    stop() {
      stopped = true; cancel(timer);
      if (state.until) expire().catch(() => {});
    },
    sync(readings, settings, observedAt = now()) {
      return enqueue(async () => {
        const triggers = warningTriggers(readings, settings);
        const next = nextPulse(state, triggers, now(), observedAt);
        next.enabled = settings?.enabled === true;
        if (settings?.enabled === false && (!state.manual || state.enabled === true)) {
          if (state.until) next.cooldownUntil=now()+BUZZER_OFF_DURATION;
          next.until = 0; next.manual = false;
        }
        if (!triggers && !state.until && settings?.enabled !== false) return readings;
        const desired = next.until > now() ? 1 : 0;
        if (readings.buzzer !== Boolean(desired)) await write(desired);
        if(state.until && !next.until)next.cooldownUntil=now()+BUZZER_OFF_DURATION;
        state = next; lastTriggers=triggers; persist(); arm(); report();
        return {...readings, buzzer:Boolean(desired)};
      });
    },
  };
}
