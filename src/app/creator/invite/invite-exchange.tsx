"use client";
import{useEffect,useState}from"react";
import{useRouter}from"next/navigation";
export default function InviteExchange({token}:{token:string|null}){const router=useRouter();const[message,setMessage]=useState(token?"Activating your creator portal…":"This invitation link is incomplete.");useEffect(()=>{if(!token)return;fetch("/api/creator/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);router.replace("/creator");router.refresh()}).catch(e=>setMessage(e.message))},[token,router]);return <main className="creator-access"><div className="brand"><span>W</span> wornly creators</div><h1>{message}</h1></main>}
