import React,{useEffect,useState,useRef} from 'react';
import{createRoot}from'react-dom/client';
import{Droplets,Flame,Snowflake,Thermometer,Bell,Clock,Volume2,Filter,TriangleAlert,CheckCircle2,CircleHelp,ArrowRight,Database,RefreshCw}from'lucide-react';
import './style.css';
import {purifierDataUrl} from './firebase.js';
import {normalizePurifierData} from './purifierData.js';
import BuzzerThresholds from './BuzzerThresholds.jsx';
import RelayControls from './RelayControls.jsx';
import {getReminders} from './reminders.js';
import {warningTriggers} from './buzzerControl.js';
import {createBuzzerPulse} from './buzzerPulse.js';
import {createColdDisplay} from './coldDisplay.js';
const display=(n,unit='')=>typeof n==='number'&&Number.isFinite(n)?`${n}${unit}`:'—';
const status=(v,on='ON',off='OFF')=>v===true?on:v===false?off:'—';
const safety=v=>v===true?'ALERT':v===false?'Safe':'Unknown';
function Panel({title,icon:Icon,children,cls=''}){return <section className={'panel '+cls}><h2><Icon size={31}/>{title}</h2>{children}</section>}
function Tank({kind,level,temp,sensor,overflow}){const hot=kind==='hot';const valid=typeof level==='number'&&Number.isFinite(level)&&level>=0;return <div className={'tank-card '+kind+(overflow===true?' tank-overflow':'')}><div className="tank"><div className="tank-cap"/><div className="tank-glass">{valid&&<div className="liquid" style={{height:`${Math.min(level,100)}%`}}/>}<div className="markings"><span>−</span><span>−</span><span>−</span><span>−</span></div><div className="water-level"><strong>{valid?`${level}%`:'—'}</strong><span>{overflow===true?'OVERFLOW':valid&&sensor<500?'LOW':valid&&sensor>=3000?'FULL':'Level'}</span></div></div><div className="tank-bottom"/></div><div className="tank-details"><h2>{hot?<Flame/>:<Snowflake/>}{hot?'Hot':'Cold'} Water Tank</h2><div className="capacity">5 L capacity</div><div className="temp"><Droplets/><span>Water level sensor: <b>{display(sensor)}</b></span></div><div className="temp"><Thermometer/><span>Temperature: <b>{display(temp,'°C')}</b></span></div></div></div>}
function Info({icon:Icon,title,value,cls=''}){return <div className={'info '+cls}><Icon/><div>{title}: <b>{value}</b></div></div>}
function AlertRow({title,value}){let st=safety(value);return <div className="alert-row"><span>{title}:</span><strong className={value===true?'bad':value===false?'safe':'unknown'}>{value===null||value===undefined?<CircleHelp/>:value?<TriangleAlert/>:<CheckCircle2/>}{st}</strong></div>}
function App(){const [url,U]=useState(()=>localStorage.getItem('purifier_firebase_url')??purifierDataUrl);const [input,I]=useState(url),[data,D]=useState(null),[net,N]=useState('Not connected'),[error,E]=useState(''),[updated,T]=useState(null);
 const [settings,setSettings]=useState(null),[controlError,setControlError]=useState('');
 const [pulseStatus,setPulseStatus]=useState(null);
 const [coldDisplay]=useState(createColdDisplay);
 const latestReadings=useRef(null);
 useEffect(()=>{latestReadings.current=data},[data]);
 useEffect(()=>coldDisplay.reset(),[url,coldDisplay]);
 useEffect(()=>{
   const timer=setInterval(()=>{
     const current=latestReadings.current;
     if(!current || current.relayStates?.relay3!==true)return;
     const temperature=coldDisplay.update(current);
     if(temperature!==current.coldDisplayTemperature){
       D(previous=>previous===current?{...previous,coldDisplayTemperature:temperature}:previous);
     }
   },250);
   return()=>clearInterval(timer);
 },[coldDisplay]);
 const [revision,setRevision]=useState(0),[savingThresholds,setSavingThresholds]=useState(false);
 const [buzzerPulse]=useState(()=>createBuzzerPulse({
   storage:window.localStorage,
   onState:value=>D(current=>current?{...current,buzzer:value}:current),
   onError:setControlError,
   onStatus:setPulseStatus,
   onRecheck:()=>setRevision(n=>n+1),
 }));
 useEffect(()=>{buzzerPulse.start();return()=>buzzerPulse.stop()},[buzzerPulse]);
 useEffect(()=>{
   if(savingThresholds)return;
   D(null);T(null);E('');setControlError('');
   if(!url){N('Not connected');return}
   N('Connecting');
   let active=true,timer;
   let abort;
   const load=async()=>{
     const observedAt=Date.now();
     abort=new AbortController();
     const timeout=setTimeout(()=>abort.abort(),15000);
     try{
       const response=await fetch(url,{cache:'no-store',signal:abort.signal});
       if(!response.ok)throw Error('HTTP '+response.status);
       const result=await response.json();
       if(!result||typeof result!=='object'||Array.isArray(result))throw Error('No purifier data found at this URL');
       let readings=normalizePurifierData(result);
       if(!active)return;
       if(url===purifierDataUrl){
         setSettings(result.buzzer_thresholds??null);
         try{
           readings=await buzzerPulse.sync(readings,result.buzzer_thresholds,observedAt);
           if(active)setControlError(result.buzzer_thresholds?.enabled===true&&Object.values(warningTriggers(readings,result.buzzer_thresholds)??{}).every(value=>value===null)?'Waiting for valid readings and saved thresholds.':'');
         }catch(e){if(active)setControlError(e.name==='AbortError'?'Buzzer update timed out; retrying on the next refresh.':e.message)}
       }
       if(active){D({...readings,coldDisplayTemperature:coldDisplay.update(readings)});T(new Date());N('Connected');E('')}
     }catch(e){
       if(active){D(null);N('Connection error');E(e.name==='AbortError'?'Request timed out. Press Connect to retry.':e.message)}
     }finally{
       clearTimeout(timeout);
       if(active)timer=setTimeout(load,5000);
     }
   };
   load();
   return()=>{active=false;abort.abort();clearTimeout(timer)};
 },[url,revision,savingThresholds]);
 const connect=e=>{e.preventDefault();const u=input.trim();try{if(u){const parsed=new URL(u,window.location.href);if(!['http:','https:'].includes(parsed.protocol))throw Error();}localStorage.setItem('purifier_firebase_url',u);if(u===url){U('');setTimeout(()=>U(u),0)}else U(u)}catch{E('Enter a valid HTTP or HTTPS JSON URL.')}};
 const v=data||{};const reminder=getReminders(v);return <><header><Droplets/><h1>Smart Water Purifier</h1><div className={'connected '+(net==='Connected'?'yes':'')}>{net}</div></header><main><div className="tanks"><Tank kind="hot" level={v.hotLevel} temp={v.hotTemperature} sensor={v.hotSensor} overflow={v.hotOverflow}/><Tank kind="cold" level={v.coldLevel} temp={v.coldDisplayTemperature} sensor={v.coldSensor} overflow={v.coldOverflow}/></div><div className="status-grid"><Info icon={Flame} title="Heater" value={status(v.heater)} cls="hot-text"/><Info icon={v.hotOverflow===true?TriangleAlert:v.hotOverflow===false?CheckCircle2:CircleHelp} title="Hot Tank Overflow" value={safety(v.hotOverflow)} cls={v.hotOverflow?'alert-text':'status-text'}/><Info icon={v.coldOverflow===true?TriangleAlert:v.coldOverflow===false?CheckCircle2:CircleHelp} title="Cold Tank Overflow" value={safety(v.coldOverflow)} cls={v.coldOverflow?'alert-text':'status-text'}/><Info icon={v.overheat===true?TriangleAlert:v.overheat===false?CheckCircle2:CircleHelp} title="Overheat" value={safety(v.overheat)} cls={v.overheat?'alert-text':'status-text'}/></div><RelayControls states={v.relayStates} connected={url===purifierDataUrl&&net==='Connected'} onSaved={()=>setRevision(n=>n+1)}/><div className="bottom-grid"><Panel icon={Bell} title="Reminder" cls="hydration"><div className="line"><Clock/> <span>Updates:</span><b>Every 5 seconds</b></div><div className="warning-reminders" aria-live="polite"><strong className={reminder.warning?'bad':reminder.incomplete?'unknown':'safe'}>{reminder.warning?'Action needed':reminder.incomplete?'Waiting for readings':'No active warnings'}</strong>{reminder.messages.length>0?<ul>{reminder.messages.map(message=><li key={message}>{message}</li>)}</ul>:<p>Water levels and hot temperature are within their limits.</p>}</div><div className="line"><Volume2/> <span>Buzzer:</span><b>{status(v.buzzer)}</b></div></Panel><Panel icon={Filter} title="Water Filtration" cls="filtration"><div className="filters"><div><Filter/><strong>Sediment<br/>Filter</strong></div><ArrowRight/><div><Filter/><strong>Activated<br/>Carbon Filter</strong></div><ArrowRight/><div><Filter/><strong>RO<br/>Membrane</strong></div></div><div className="destination">Purified water to hot and cold tanks</div></Panel><Panel icon={TriangleAlert} title="Safety Alert" cls="alerts"><AlertRow title="Low water" value={v.lowWater}/><AlertRow title="Sensor error" value={false}/><AlertRow title="Overflow" value={v.hotOverflow===true||v.coldOverflow===true?true:v.hotOverflow===false&&v.coldOverflow===false?false:null}/><AlertRow title="Overheat" value={v.overheat}/></Panel></div><BuzzerThresholds onManual={value=>buzzerPulse.manual(value,v,settings)} pulseStatus={pulseStatus} settings={settings} connected={url===purifierDataUrl&&net==='Connected'} buzzer={v.buzzer} controlError={controlError} onSaved={()=>setRevision(n=>n+1)} onSaving={setSavingThresholds}/><details className="source"><summary><Database size={16}/> Live data connection {updated&&net==='Connected'&&<small> · Updated {updated.toLocaleTimeString()}</small>}</summary><p>Connected by default to the Firebase water_purifier node. Readings refresh every 5 seconds. You can enter another JSON endpoint below.</p><form onSubmit={connect}><input type="url" placeholder="https://your-device-or-server/readings" value={input} onChange={e=>I(e.target.value)} aria-label="Live data URL"/><button type="submit"><RefreshCw size={15}/> Connect</button><button type="button" onClick={()=>{U('');I('');D(null);T(null);localStorage.setItem('purifier_firebase_url','')}}>Disconnect</button></form>{error&&<p className="error">{error} — Check the address, server availability and CORS settings.</p>}<p className="note">Raw water sensor readings: below 500 is low, 3000-3200 is full, and above 3500 is overflow. Estimated tank fill reaches 100% at 3000. Overheat alerts only when the hot temperature exceeds its saved hot threshold, regardless of buzzer trigger direction. Missing readings or thresholds remain unknown.</p></details></main></>}

createRoot(document.getElementById('root')).render(<App/>);
