import React, {useEffect, useState, useRef} from 'react';
import {Volume2} from 'lucide-react';
import {patchPurifier, validThresholds, buzzerConditions} from './buzzerControl.js';

export default function BuzzerThresholds({pulseStatus, settings, connected, buzzer, controlError, onSaved, onSaving, onManual}) {
  const [clock,setClock]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer)},[]);
  const offSeconds=Math.max(0,Math.ceil(((pulseStatus?.cooldownUntil||0)-clock)/1000));
  const [manualPending,setManualPending]=useState(false);
  const manualBusy=useRef(false);
  const [hot, setHot] = useState('');
  const [cold, setCold] = useState('');
  const [hotDirection, setHotDirection] = useState('above');
  const [coldDirection, setColdDirection] = useState('below');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const manual = async value => {
    if (!connected || manualBusy.current || saving) return;
    manualBusy.current=true;setManualPending(true);setError('');setMessage('');
    try {
      await onManual(value);
      setMessage(value===1?'Manual buzzer ON (1). It turns OFF automatically within 10 seconds.':'Buzzer OFF (0). Waiting 10 seconds before checking current readings again.');
    } catch(e) {setError(`Manual buzzer update failed: ${e.message}`)}
    finally {manualBusy.current=false;setManualPending(false)}
  };
  useEffect(() => {
    if (!settings) return;
    setHot(settings.hot ?? ''); setCold(settings.cold ?? '');
    setHotDirection(settings.hotDirection ?? 'above');
    setColdDirection(settings.coldDirection ?? 'below');
    setEnabled(settings.enabled === true);
  }, [settings?.hot, settings?.cold, settings?.hotDirection, settings?.coldDirection, settings?.enabled]);

  const save = async event => {
    event.preventDefault(); setMessage(''); setError('');
    const next = {hot: Number(hot), cold: Number(cold), hotDirection, coldDirection, enabled};
    if (String(hot).trim() === '' || String(cold).trim() === '' || !validThresholds(next)) {
      setError('Enter a valid temperature for both tanks.'); return;
    }
    setSaving(true); onSaving(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      await patchPurifier({buzzer_thresholds: next, ...(!enabled ? {buzzer: 0} : {})}, controller.signal);
      setMessage(enabled ? 'Thresholds saved. Automation checks these values on every refresh.' : 'Automation disabled; buzzer set to OFF (0).');
      onSaved();
    } catch (e) {
      setError(e.name === 'AbortError' ? 'Save timed out. Check the connection and try again.' : e.message);
    } finally {
      clearTimeout(timeout); setSaving(false); onSaving(false);
    }
  };

  return <section className="panel buzzer-settings">
    <h2><Volume2/>Temperature Buzzer</h2>
    <div className="manual-buzzer">
      <strong>Manual buzzer control</strong>
      <div className="relay-actions">
        <button type="button" className={buzzer===true?'selected-on':''} disabled={!connected||saving||manualPending||buzzer===true} onClick={()=>manual(1)}>ON (1)</button>
        <button type="button" className={buzzer===false?'selected-off':''} disabled={!connected||saving||manualPending} onClick={()=>manual(0)}>OFF (0)</button>
      </div>
      <p>{manualPending?'Updating buzzer...':'ON runs for up to 10 seconds. OFF stops it immediately. Manual controls also work with warning automation disabled.'}</p>
    </div>
    <p>Only hot and cold temperature thresholds trigger the automatic buzzer. It runs for up to 10 seconds, stays OFF for 10 seconds, then checks fresh temperatures. Low-water and overflow alerts are displayed without sounding the buzzer.</p>
    <form onSubmit={save}>
      <fieldset disabled={!connected || saving || manualPending}>
        <div className="threshold-grid">
          <label>Hot temperature (°C)<input type="number" step="any" required value={hot} onChange={e => setHot(e.target.value)} placeholder="Enter threshold"/></label>
          <label>Hot trigger<select value={hotDirection} onChange={e => setHotDirection(e.target.value)}><option value="above">At or above (≥)</option><option value="below">At or below (≤)</option></select></label>
          <label>Cold temperature (°C)<input type="number" step="any" required value={cold} onChange={e => setCold(e.target.value)} placeholder="Enter threshold"/></label>
          <label>Cold trigger<select value={coldDirection} onChange={e => setColdDirection(e.target.value)}><option value="below">At or below (≤)</option><option value="above">At or above (≥)</option></select></label>
        </div>
        <div className="threshold-actions"><label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/>Enable temperature buzzer</label><button type="submit">{saving ? 'Saving…' : 'Save thresholds'}</button></div>
      </fieldset>
    </form>
    <p className="threshold-status" aria-live="polite">Buzzer: <strong>{buzzer === true ? 'ON (1)' : buzzer === false ? 'OFF (0)' : 'Unknown'}</strong> · Automation: {connected ? settings?.enabled === true && validThresholds(settings) ? 'Enabled' : 'Not enabled' : 'Paused — connect to the configured Firebase database'}</p>
    <p className="threshold-status" aria-live="polite">Cycle: {buzzer===true?'ON - maximum 10 seconds':offSeconds>0?`OFF - checking fresh readings in ${offSeconds}s`:pulseStatus?.cooldownUntil?'Waiting for fresh readings':'Monitoring current readings'}</p>
    <div className="buzzer-conditions" aria-live="polite">{Object.entries(buzzerConditions).map(([key,label])=>{
      const active=pulseStatus?.triggers?.[key];
      const description=!connected?'Waiting for connection':settings?.enabled!==true?'Disabled':active==null?'Waiting for reading':active===false?'Clear - no warning':buzzer===true?'Active - buzzer sounding':pulseStatus?.until>0?'Active - OFF update pending':offSeconds>0?`Active - OFF interval (${offSeconds}s)`:'Active - checking fresh readings';
      return <div key={key}><span>{label}</span><strong className={active===true?'bad':'unknown'}>{description}</strong></div>;
    })}</div>
    {message && <p role="status">{message}</p>}
    {(error || controlError) && <p className="error" role="alert">{error || controlError}</p>}
    <p className="note">Keep this dashboard open and connected. Temperatures are checked every 5 seconds. After each ON cycle there is a 10-second OFF interval, followed by a fresh reading check. Manual ON overrides the OFF interval. Disabling and saving turns the buzzer OFF. For operation with the dashboard closed, the device must implement these thresholds.</p>
  </section>;
}
