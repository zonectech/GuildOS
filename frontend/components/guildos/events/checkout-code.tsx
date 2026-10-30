'use client';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {QRCodeSVG} from 'qrcode.react';
import {setCheckoutCode,selfCheckOut,type EventRegistration} from '../api/event-api';
import {Button} from '../ui/button';
export function OrganizerCheckoutCode({eventId}:{eventId:string}) {
 const [display,setDisplay]=useState<{code:string;expiresAt:string|null;url:string}|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 async function change(enabled:boolean){setBusy(true);setError('');try{const result=await setCheckoutCode(eventId,enabled);setDisplay(enabled?result:null);}catch(e){setError(e instanceof Error?e.message:'Unable to display checkout');}finally{setBusy(false);}}
 const expired=display?.expiresAt?new Date(display.expiresAt).getTime()<=now:true;
 return <section className="mb-6 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
 <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Attendee self-checkout</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Open check-out from the events page, then display a QR and code. Scanner checkout remains available.</p></div><Button variant="secondary" disabled={busy} onClick={()=>void change(true)}>{display?'Refresh code':'Display checkout QR'}</Button></div>
 {error&&<p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
 {display&&<div className="mt-5 flex flex-col items-center gap-4 text-center">
 {!expired?<><div className="rounded-xl bg-white p-4"><QRCodeSVG value={display.url} size={240} bgColor="#ffffff" fgColor="#000000" includeMargin/></div><p className="text-4xl font-semibold tracking-[0.2em]">{display.code}</p><p className="text-sm text-slate-500 dark:text-slate-400">Scan this QR, or enter the code on the event page. Expires at {new Date(display.expiresAt!).toLocaleTimeString()}.</p><a href={display.url} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 dark:text-indigo-300">Open checkout page</a></>:<p className="font-medium">Code expired. Refresh it to continue.</p>}
 <Button variant="secondary" disabled={busy} onClick={()=>void change(false)}>Stop self-checkout</Button></div>}
 </section>;
}
export function AttendeeCheckoutCode({eventId,onDone}:{eventId:string;onDone:(registration:EventRegistration)=>void}) {
 const params=useSearchParams();const [code,setCode]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{const scanned=params.get('checkout');if(scanned&&/^\d{8}$/.test(scanned))setCode(scanned);},[params]);
 async function submit(){setBusy(true);setMessage('');try{const result=await selfCheckOut(eventId,code);setMessage('Checked out successfully. Certificate eligibility depends on your recorded attendance.');onDone(result.registration);}catch(e){setMessage(e instanceof Error?e.message:'Unable to check out');}finally{setBusy(false);}}
 return <section id="checkout" className="w-full rounded-lg border border-slate-200 p-4 dark:border-slate-700"><h3 className="text-sm font-semibold">Check out with the organizer’s code</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Enter the displayed code, or show your pass to a scanner.</p><form className="mt-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void submit();}}><label className="sr-only" htmlFor="checkout-code">Checkout code</label><input id="checkout-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,8))} inputMode="numeric" autoComplete="off" placeholder="8-digit code" className="min-w-0 rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"/><Button variant="primary" disabled={busy||code.length!==8} type="submit">{busy?'Checking out…':'Check out'}</Button></form>{message&&<p role="status" className="mt-2 text-sm">{message}</p>}</section>;
}
