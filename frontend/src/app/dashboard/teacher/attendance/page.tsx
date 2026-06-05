'use client';

import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/api';
import { toast } from 'sonner';

interface Course   { id: string; name: string; icon: string; }
interface Student  { id: string; name: string; email: string; macAddress?: string; checkin?: { method: string; status: string; checkedInAt: string } | null; }
interface Session  { id: string; courseId: string; date: string; title: string; type: string; status: string; methods: string[]; qrToken?: string; qrExpiresAt?: string; }
interface Policy   { minAttendancePercent: number; remoteAllowPercent: number; requireProofForOnline: boolean; proofType: string; webcamCheckInterval: number; allowedMethods: string[]; }

const METHOD_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  manual:  { icon: '✏️', label: 'Manual',        color: 'text-white/70'    },
  network: { icon: '📡', label: 'Network Scan',  color: 'text-blue-400'    },
  qr:      { icon: '📲', label: 'QR Code',       color: 'text-purple-400'  },
  online:  { icon: '🌐', label: 'Online/Remote', color: 'text-emerald-400' },
};

export default function TeacherAttendancePage() {
  const router = useRouter();

  const [courses,        setCourses]        = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [loading,        setLoading]        = useState(true);
  const [students,       setStudents]       = useState<Student[]>([]);
  const [session,        setSession]        = useState<Session | null>(null);
  const [qrDataUrl,      setQrDataUrl]      = useState<string | null>(null);
  const [qrExpiry,       setQrExpiry]       = useState<Date | null>(null);
  const [qrSecs,         setQrSecs]         = useState(0);
  const [showStart,      setShowStart]      = useState(false);
  const [newTitle,       setNewTitle]       = useState('');
  const [newType,        setNewType]        = useState<'in_person'|'online'>('in_person');
  const [newMethods,     setNewMethods]     = useState<string[]>(['manual','network']);
  const [starting,       setStarting]       = useState(false);
  const [manualStatus,   setManualStatus]   = useState<Record<string,string>>({});
  const [scanning,       setScanning]       = useState(false);
  const [scanResult,     setScanResult]     = useState<{matched:number;unmatched:string[]}|null>(null);
  const [policy,         setPolicy]         = useState<Policy|null>(null);
  const [showPolicy,     setShowPolicy]     = useState(false);
  const [savingPolicy,   setSavingPolicy]   = useState(false);
  const [legacyDate,     setLegacyDate]     = useState(new Date().toISOString().split('T')[0]);
  const [legacyRecs,     setLegacyRecs]     = useState<Record<string,string>>({});
  const [savingLegacy,   setSavingLegacy]   = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const qrRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const userRef = useRef<{id:string;role:string}|null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const u = JSON.parse(stored);
    if (u.role !== 'teacher') { router.push('/login'); return; }
    userRef.current = u;
    authFetch(`/api/courses?teacherId=${u.id}`).then(r=>r.json()).then(d=>{
      setCourses(d.courses??[]); setLoading(false);
    });
  }, [router]);

  const refreshSession = useCallback(async (sid:string, base?:Student[]) => {
    const r = await authFetch(`/api/attendance/sessions/${sid}`);
    const d = await r.json();
    if (!d.session) return;
    const checkins: Record<string,Student['checkin']> = {};
    (d.checkins??[]).forEach((c:{studentId:string;method:string;status:string;checkedInAt:string})=>{
      checkins[c.studentId] = {method:c.method,status:c.status,checkedInAt:c.checkedInAt};
    });
    const enriched:Student[] = (d.students ?? base ?? []).map((s:Student)=>({...s,checkin:checkins[s.id]??null}));
    setStudents(enriched);
    setManualStatus(prev=>{
      const next={...prev};
      enriched.forEach((s:Student)=>{ if(s.checkin) next[s.id]=s.checkin.status; else if(!next[s.id]) next[s.id]='absent'; });
      return next;
    });
  },[]);

  const loadCourse = useCallback(async (cid:string) => {
    if(!cid) return;
    const [er,sr,pr,ar] = await Promise.all([
      authFetch(`/api/enrollments?courseId=${cid}`).then(r=>r.json()),
      authFetch(`/api/attendance/sessions?courseId=${cid}`).then(r=>r.json()),
      authFetch(`/api/attendance/policy?courseId=${cid}`).then(r=>r.json()),
      authFetch(`/api/attendance?courseId=${cid}&date=${new Date().toISOString().split('T')[0]}`).then(r=>r.json()),
    ]);
    const enrolled:Student[] = (er.enrollments??[]).map((e:{userId:string;userName:string;userEmail:string;userMacAddress?:string})=>({
      id:e.userId, name:e.userName, email:e.userEmail, macAddress:e.userMacAddress
    }));
    const init:Record<string,string>={};
    enrolled.forEach((s:Student)=>{init[s.id]='absent';});
    setManualStatus(init);

    const active = (sr.sessions??[]).find((s:Session)=>s.status==='active') as Session|undefined;
    if(active){
      setSession(active);
      if(active.qrToken && active.qrExpiresAt) setQrExpiry(new Date(active.qrExpiresAt));
      await refreshSession(active.id, enrolled);
    } else {
      setSession(null);
      setStudents(enrolled);
    }
    setPolicy(pr.policy??null);
    const legacyInit:Record<string,string>={};
    enrolled.forEach((s:Student)=>{legacyInit[s.id]='absent';});
    if(ar.attendance?.records) setLegacyRecs(ar.attendance.records);
    else setLegacyRecs(legacyInit);
  },[refreshSession]);

  useEffect(()=>{ if(selectedCourse) loadCourse(selectedCourse); },[selectedCourse,loadCourse]);

  useEffect(()=>{
    if(pollRef.current) clearInterval(pollRef.current);
    if(session?.status==='active'){
      pollRef.current=setInterval(()=>refreshSession(session.id),5000);
    }
    return ()=>{ if(pollRef.current) clearInterval(pollRef.current); };
  },[session?.id, session?.status, refreshSession]);

  useEffect(()=>{
    if(qrRef.current) clearInterval(qrRef.current);
    if(!qrExpiry){setQrSecs(0);return;}
    const tick=()=>setQrSecs(Math.max(0,Math.round((qrExpiry.getTime()-Date.now())/1000)));
    tick();
    qrRef.current=setInterval(tick,1000);
    return ()=>{ if(qrRef.current) clearInterval(qrRef.current); };
  },[qrExpiry]);

  const startSession = async () => {
    if(!newTitle.trim()){toast.error('Enter a session title');return;}
    setStarting(true);
    try{
      const r=await authFetch('/api/attendance/sessions',{
        method:'POST',
        body:JSON.stringify({courseId:selectedCourse,title:newTitle,type:newType,methods:newMethods}),
      });
      const d=await r.json();
      setSession(d.session);
      if(d.qrDataUrl){setQrDataUrl(d.qrDataUrl);setQrExpiry(new Date(d.session.qrExpiresAt));}
      setShowStart(false);
      toast.success('Session started!');
      await refreshSession(d.session.id);
    }catch{toast.error('Failed to start session');}
    finally{setStarting(false);}
  };

  const endSession = async () => {
    if(!session) return;
    if(!confirm('End this session? Attendance will be saved to records.')) return;
    await Promise.all(
      Object.entries(manualStatus).map(([sid,status])=>
        authFetch(`/api/attendance/sessions/${session.id}/checkin`,{
          method:'POST',
          body:JSON.stringify({studentId:sid,method:'manual',status}),
        })
      )
    );
    const r=await authFetch(`/api/attendance/sessions/${session.id}`,{method:'PUT',body:JSON.stringify({status:'ended'})});
    const d=await r.json();
    setSession(d.session);
    toast.success('Session ended — attendance saved ✓');
  };

  const refreshQr = async () => {
    if(!session) return;
    const r=await authFetch(`/api/attendance/sessions/${session.id}`,{method:'PUT',body:JSON.stringify({refreshQr:true})});
    const d=await r.json();
    if(d.qrDataUrl){setQrDataUrl(d.qrDataUrl);setQrExpiry(new Date(d.session.qrExpiresAt));}
    toast.success('QR refreshed');
  };

  const scanNetwork = async () => {
    setScanning(true); setScanResult(null);
    try{
      const r=await authFetch('/api/attendance/network-scan');
      const d=await r.json();
      const matched:(typeof students[0])[] = d.matchedStudents??[];
      if(session){
        await Promise.all(matched.map((s:{id:string})=>
          authFetch(`/api/attendance/sessions/${session.id}/checkin`,{
            method:'POST',
            body:JSON.stringify({studentId:s.id,method:'network',status:'present'}),
          })
        ));
        await refreshSession(session.id);
      } else {
        const ids=new Set(matched.map((s:{id:string})=>s.id));
        setManualStatus(prev=>{const n={...prev};ids.forEach(id=>{n[id]='present';});return n;});
        setLegacyRecs(prev=>{const n={...prev};ids.forEach(id=>{n[id]='present';});return n;});
      }
      const noMac=students.filter(s=>!s.macAddress&&!matched.find((m:{id:string})=>m.id===s.id)).map(s=>s.name);
      setScanResult({matched:matched.length,unmatched:noMac});
      toast.success(`${matched.length} student${matched.length!==1?'s':''} found on network`);
    }catch(e){toast.error(e instanceof Error?e.message:'Network scan failed');}
    finally{setScanning(false);}
  };

  const savePolicy = async () => {
    if(!policy||!selectedCourse) return;
    setSavingPolicy(true);
    try{
      await authFetch(`/api/attendance/policy?courseId=${selectedCourse}`,{method:'PUT',body:JSON.stringify(policy)});
      toast.success('Policy saved ✓'); setShowPolicy(false);
    }catch{toast.error('Failed to save policy');}
    finally{setSavingPolicy(false);}
  };

  const saveLegacy = async () => {
    if(!selectedCourse) return;
    setSavingLegacy(true);
    try{
      await authFetch('/api/attendance',{
        method:'POST',
        body:JSON.stringify({courseId:selectedCourse,date:legacyDate,records:legacyRecs,markedBy:userRef.current?.id}),
      });
      toast.success('Attendance saved ✓');
    }catch{toast.error('Failed to save');}
    finally{setSavingLegacy(false);}
  };

  if(loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">📋</div></div>;

  const present = students.filter(s=>(s.checkin?.status||manualStatus[s.id])==='present').length;
  const remote  = students.filter(s=>(s.checkin?.status||manualStatus[s.id])==='remote').length;
  const late    = students.filter(s=>(s.checkin?.status||manualStatus[s.id])==='late').length;
  const absent  = students.length - present - remote - late;

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <Link href="/dashboard/teacher" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition">← Back</Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">📋 Attendance</h1>
          <p className="text-white/50 text-sm">QR code · Network scan · Online · Manual</p>
        </div>
        {selectedCourse && <button onClick={()=>setShowPolicy(!showPolicy)} className="glass px-4 py-2 rounded-xl text-sm hover:bg-white/10 transition">⚙️ Policy</button>}
      </div>

      <div className="glass rounded-2xl p-5 mb-5">
        <label className="block text-sm text-white/60 mb-2">Select Course</label>
        <select value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)} className="input-glass">
          <option value="">Choose a course…</option>
          {courses.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      {!selectedCourse && <div className="glass rounded-2xl p-12 text-center text-white/40"><p className="text-4xl mb-3">📋</p><p>Select a course to manage attendance</p></div>}

      {selectedCourse && (
        <div className="space-y-5">
          {/* Policy panel */}
          {showPolicy && policy && (
            <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
              <h2 className="font-semibold">⚙️ Attendance Policy</h2>
              <div className="grid grid-cols-2 gap-4">
                {([
                  ['minAttendancePercent','Min attendance (%)',0,100],
                  ['remoteAllowPercent','Remote allowance (%)',0,100],
                  ['webcamCheckInterval','Webcam check interval (min)',1,120],
                ] as [string,string,number,number][]).map(([k,lbl,mn,mx])=>(
                  <div key={k}>
                    <label className="text-xs text-white/50 block mb-1">{lbl}</label>
                    <input type="number" min={mn} max={mx}
                      value={(policy as unknown as Record<string,number>)[k]}
                      onChange={e=>setPolicy({...policy,[k]:Math.min(mx,Math.max(mn,+e.target.value))})}
                      className="input-glass" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-white/50 block mb-1">Online proof required</label>
                  <select value={policy.proofType} onChange={e=>setPolicy({...policy,proofType:e.target.value})} className="input-glass">
                    <option value="none">None</option>
                    <option value="webcam">Webcam check</option>
                    <option value="quiz">Quiz completion</option>
                    <option value="either">Webcam OR quiz</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-2">Allowed methods</label>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(METHOD_LABELS).map(([k,v])=>(
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={policy.allowedMethods.includes(k)}
                        onChange={e=>setPolicy({...policy,allowedMethods:e.target.checked?[...policy.allowedMethods,k]:policy.allowedMethods.filter(m=>m!==k)})}
                        className="accent-emerald-500" />
                      <span className={`text-sm ${v.color}`}>{v.icon} {v.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={savePolicy} disabled={savingPolicy} className="btn-primary px-6 py-2 disabled:opacity-50">{savingPolicy?'⏳…':'💾 Save Policy'}</button>
            </div>
          )}

          {/* Active session */}
          {session?.status==='active' ? (
            <div className="glass rounded-2xl p-6 border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/><span className="font-semibold">{session.title}</span><span className="text-xs text-white/40 capitalize">{session.type.replace('_',' ')}</span></div>
                  <div className="flex gap-3 mt-1">{session.methods.map(m=><span key={m} className={`text-xs ${METHOD_LABELS[m]?.color??'text-white/50'}`}>{METHOD_LABELS[m]?.icon} {METHOD_LABELS[m]?.label}</span>)}</div>
                </div>
                <button onClick={endSession} className="bg-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm hover:bg-red-500/30 transition">⏹ End</button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[['Present',present,'text-emerald-400'],['Remote',remote,'text-blue-400'],['Late',late,'text-amber-400'],['Absent',absent,'text-red-400']].map(([l,v,c])=>(
                  <div key={l as string} className="bg-white/5 rounded-xl p-3 text-center"><p className={`text-xl font-bold ${c}`}>{v}</p><p className="text-xs text-white/50">{l}</p></div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {session.methods.includes('network') && (
                  <button onClick={scanNetwork} disabled={scanning} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30 disabled:opacity-50 transition">
                    {scanning?<><span className="animate-spin">⚙️</span> Scanning…</>:'📡 Scan Network'}
                  </button>
                )}
                {session.methods.includes('qr') && <button onClick={refreshQr} className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/30 transition">🔄 Refresh QR</button>}
                <button onClick={()=>setManualStatus(prev=>{const n={...prev};students.forEach(s=>{n[s.id]='present';});return n;})} className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm hover:bg-emerald-500/30 transition">✓ All Present</button>
                <button onClick={()=>setManualStatus(prev=>{const n={...prev};students.forEach(s=>{n[s.id]='absent';});return n;})} className="px-4 py-2 rounded-lg bg-white/5 text-white/50 text-sm hover:bg-white/10 transition">✗ All Absent</button>
              </div>

              {session.methods.includes('qr') && qrDataUrl && (
                <div className="flex gap-5 items-start p-4 bg-white/5 rounded-xl">
                  <img src={qrDataUrl} alt="QR" className="w-32 h-32 rounded-lg bg-white p-1 shrink-0" />
                  <div>
                    <p className="font-medium text-sm mb-1">📲 Students scan with their phone</p>
                    <p className="text-xs text-white/50 mb-1">{qrSecs>0?`Expires in ${Math.floor(qrSecs/60)}m ${qrSecs%60}s`:<span className="text-amber-400">Expired — click Refresh QR</span>}</p>
                    <p className="text-white/30 text-xs font-mono break-all">
                      {typeof window!=='undefined'?`${window.location.origin}/attend/${session.qrToken}`:`/attend/${session.qrToken}`}
                    </p>
                  </div>
                </div>
              )}

              {scanResult && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm">
                  <p className="text-blue-400">📡 {scanResult.matched} student{scanResult.matched!==1?'s':''} found on network</p>
                  {scanResult.unmatched.length>0&&<p className="text-white/40 text-xs mt-1">⚠️ No MAC: {scanResult.unmatched.join(', ')}</p>}
                </div>
              )}

              <StudentList students={students} status={manualStatus} onChange={(id,s)=>setManualStatus(prev=>({...prev,[id]:s}))} />
            </div>
          ) : (
            <div className="space-y-5">
              {!showStart ? (
                <button onClick={()=>{setShowStart(true);setNewTitle(`Lecture – ${new Date().toLocaleDateString()}`);}}
                  className="w-full glass rounded-2xl p-8 text-center hover:bg-white/5 transition border-2 border-dashed border-white/10 hover:border-emerald-500/40">
                  <p className="text-4xl mb-2">▶️</p>
                  <p className="font-semibold text-lg">Start Attendance Session</p>
                  <p className="text-white/40 text-sm mt-1">QR code · Network scan · Online · Manual</p>
                </button>
              ) : (
                <div className="glass rounded-2xl p-6 space-y-4">
                  <h2 className="font-semibold">▶️ Start New Session</h2>
                  <div><label className="text-xs text-white/50 block mb-1">Title</label><input type="text" value={newTitle} onChange={e=>setNewTitle(e.target.value)} className="input-glass" /></div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Type</label>
                    <div className="flex gap-3">
                      {[['in_person','🏫','In-Person'],['online','🌐','Online/Hybrid']].map(([v,icon,label])=>(
                        <button key={v} onClick={()=>setNewType(v as 'in_person'|'online')}
                          className={`flex-1 py-3 rounded-xl text-sm border-2 transition ${newType===v?'border-emerald-500 bg-emerald-500/15 text-emerald-400':'border-white/10 text-white/50 hover:border-white/20'}`}>
                          {icon} {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-2">Methods for this session</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(METHOD_LABELS).map(([k,v])=>(
                        <label key={k} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${newMethods.includes(k)?'border-emerald-500/50 bg-emerald-500/10':'border-white/10 hover:border-white/20'}`}>
                          <input type="checkbox" checked={newMethods.includes(k)} onChange={e=>setNewMethods(e.target.checked?[...newMethods,k]:newMethods.filter(m=>m!==k))} className="accent-emerald-500" />
                          <span className={`text-sm ${v.color}`}>{v.icon} {v.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={startSession} disabled={starting} className="btn-primary flex-1 py-3 disabled:opacity-50">{starting?'⏳ Starting…':'▶️ Start Session'}</button>
                    <button onClick={()=>setShowStart(false)} className="glass px-6 py-3 rounded-xl hover:bg-white/10 transition">Cancel</button>
                  </div>
                </div>
              )}

              {/* Legacy manual */}
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">✏️ Manual Attendance</h2>
                  <input type="date" value={legacyDate} onChange={e=>{
                    setLegacyDate(e.target.value);
                    authFetch(`/api/attendance?courseId=${selectedCourse}&date=${e.target.value}`).then(r=>r.json()).then(d=>{
                      const init:Record<string,string>={};
                      students.forEach(s=>{init[s.id]='absent';});
                      setLegacyRecs(d.attendance?.records??init);
                    });
                  }} className="input-glass text-sm py-1 w-auto" />
                </div>
                <div className="flex gap-2 mb-4">
                  <button onClick={()=>{const n:Record<string,string>={};students.forEach(s=>{n[s.id]='present';});setLegacyRecs(n);}} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm hover:bg-emerald-500/30 transition">All Present</button>
                  <button onClick={()=>{const n:Record<string,string>={};students.forEach(s=>{n[s.id]='absent';});setLegacyRecs(n);}} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-sm hover:bg-white/10 transition">All Absent</button>
                  <button onClick={scanNetwork} disabled={scanning} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30 disabled:opacity-50 transition">{scanning?'⚙️…':'📡 Scan'}</button>
                </div>
                {students.length===0
                  ? <p className="text-white/40 text-sm text-center py-6">No students enrolled</p>
                  : <div className="space-y-1 mb-4">{students.map(s=>(
                    <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5">
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{s.name}</p><p className="text-xs text-white/40 truncate">{s.email}</p></div>
                      {!s.macAddress&&<span className="text-xs text-amber-500/50">no MAC</span>}
                      <div className="flex gap-1">
                        {['present','late','absent'].map(st=>(
                          <button key={st} onClick={()=>setLegacyRecs(prev=>({...prev,[s.id]:st}))}
                            className={`px-2 py-1 rounded text-xs transition ${legacyRecs[s.id]===st?st==='present'?'bg-emerald-500 text-white':st==='late'?'bg-amber-500 text-white':'bg-red-500 text-white':'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                            {st==='present'?'✓':st==='late'?'⏰':'✗'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}</div>}
                <button onClick={saveLegacy} disabled={savingLegacy||students.length===0} className="btn-primary w-full py-3 disabled:opacity-50">{savingLegacy?'⏳ Saving…':'💾 Save Attendance'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentList({students,status,onChange}:{students:Student[];status:Record<string,string>;onChange:(id:string,s:string)=>void}) {
  if(!students.length) return <p className="text-white/40 text-sm text-center py-6">No students enrolled</p>;
  return (
    <div className="space-y-1">
      {students.map(s=>{
        const st = status[s.id]??'absent';
        const METHOD_LABELS_L: Record<string,{icon:string;label:string;color:string}> = {
          manual:{icon:'✏️',label:'Manual',color:'text-white/70'},
          network:{icon:'📡',label:'Network',color:'text-blue-400'},
          qr:{icon:'📲',label:'QR',color:'text-purple-400'},
          online:{icon:'🌐',label:'Online',color:'text-emerald-400'},
        };
        return (
          <div key={s.id} className={`flex items-center gap-3 p-2.5 rounded-lg transition ${st==='present'?'bg-emerald-500/8':st==='remote'?'bg-blue-500/8':''}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{s.name}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/40 truncate">{s.email}</p>
                {s.checkin&&<span className={`text-xs ${METHOD_LABELS_L[s.checkin.method]?.color??'text-white/40'}`}>{METHOD_LABELS_L[s.checkin.method]?.icon} {new Date(s.checkin.checkedInAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>}
              </div>
            </div>
            {!s.macAddress&&<span className="text-xs text-amber-500/50 shrink-0">no MAC</span>}
            <div className="flex gap-1 shrink-0">
              {['present','late','remote','absent'].map(opt=>(
                <button key={opt} onClick={()=>onChange(s.id,opt)}
                  className={`px-2 py-1 rounded text-xs transition ${st===opt?opt==='present'?'bg-emerald-500 text-white':opt==='late'?'bg-amber-500 text-white':opt==='remote'?'bg-blue-500 text-white':'bg-red-500 text-white':'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                  {opt==='present'?'✓ P':opt==='late'?'⏰ L':opt==='remote'?'🌐 R':'✗ A'}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
