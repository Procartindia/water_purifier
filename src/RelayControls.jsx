import React, {useRef, useState} from 'react';
import {Power} from 'lucide-react';
import {relayStages, setRelay} from './relayControl.js';

export default function RelayControls({states = {}, connected, onSaved}) {
  const [pending, setPending] = useState(null);
  const busy = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const update = async (stage, value) => {
    if (!connected || busy.current) return;
    busy.current = true;
    setPending(stage.key); setMessage(''); setError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      await setRelay(stage.key, value, controller.signal);
      setMessage(`${stage.label} saved as ${value === 1 ? 'ON (1)' : 'OFF (0)'}.`);
      onSaved();
    } catch (e) {
      setError(e.name === 'AbortError' ? 'Relay update timed out. Check the current state before retrying.' : e.message);
    } finally {
      clearTimeout(timeout); busy.current = false; setPending(null);
    }
  };
  return <section className="panel relay-controls">
    <h2><Power/>Manual Relay Controls</h2>
    <div className="relay-grid">{relayStages.map(stage => {
      const state = states[stage.key];
      return <div className="relay-card" key={stage.key}>
        <h3>{stage.label}</h3>
        <strong className={state === true ? 'safe' : 'unknown'}>{pending === stage.key ? 'Updating…' : state === true ? 'ON (1)' : state === false ? 'OFF (0)' : 'Unknown'}</strong>
        <div className="relay-actions">
          <button type="button" className={state === true ? 'selected-on' : ''} aria-label={`${stage.label} ON`} aria-pressed={state === true} disabled={!connected || pending !== null} onClick={() => update(stage, 1)}>ON</button>
          <button type="button" className={state === false ? 'selected-off' : ''} aria-label={`${stage.label} OFF`} aria-pressed={state === false} disabled={!connected || pending !== null} onClick={() => update(stage, 0)}>OFF</button>
        </div>
      </div>;
    })}</div>
    {!connected && <p className="note">Connect to the configured Firebase database to control the relays.</p>}
    {message && <p role="status">{message}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
