import { wsOrigin } from '../../api/wsUrl'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, CheckCircle2, XCircle, Loader, Server, Play,
  Camera, Upload, PowerOff, ChevronRight, ZoomIn,
} from 'lucide-react'
import { qaApi, type Screenshot, type TestRun } from '../../api/qa'
import { useAuthStore } from '../../store/authStore'

interface Props {
  run:        TestRun
  projectId:  string
  onClose:    () => void
  onComplete: () => void
}

type LifecycleStep = 'idle' | 'scale_up' | 'setup' | 'running' | 'upload' | 'scale_down' | 'done' | 'error'

const STEPS: { id: LifecycleStep; label: string; icon: React.ReactNode }[] = [
  { id: 'scale_up',    label: 'Scale Up',      icon: <Server size={13} /> },
  { id: 'setup',       label: 'Environment',   icon: <Play size={13} /> },
  { id: 'running',     label: 'Running Tests', icon: <Loader size={13} /> },
  { id: 'upload',      label: 'Upload',        icon: <Upload size={13} /> },
  { id: 'scale_down',  label: 'Scale Down',    icon: <PowerOff size={13} /> },
]

const STEP_ORDER: LifecycleStep[] = ['scale_up', 'setup', 'running', 'upload', 'scale_down', 'done']

function stepStatus(current: LifecycleStep, step: LifecycleStep): 'done' | 'active' | 'pending' | 'error' {
  if (current === 'error') return step === STEP_ORDER[0] ? 'error' : 'pending'
  const ci = STEP_ORDER.indexOf(current)
  const si = STEP_ORDER.indexOf(step)
  if (si < ci)  return 'done'
  if (si === ci) return 'active'
  return 'pending'
}

export default function ContainerRunView({ run, projectId, onClose, onComplete }: Props) {
  const { token }  = useAuthStore()
  const wsRef      = useRef<WebSocket | null>(null)
  const wsUrl      = wsOrigin()

  const [appUrl,        setAppUrl]        = useState('')
  const [started,       setStarted]       = useState(false)
  const [currentStep,   setCurrentStep]   = useState<LifecycleStep>('idle')
  const [logs,          setLogs]          = useState<string[]>([])
  const [taskArn,       setTaskArn]       = useState('')
  const [screenshots,   setScreenshots]   = useState<Screenshot[]>([])
  const [lightbox,      setLightbox]      = useState<Screenshot | null>(null)
  const [filter,        setFilter]        = useState<'all'|'passed'|'failed'>('all')
  const [result,        setResult]        = useState<{ passed:number; failed:number; screenshots:number } | null>(null)
  const [stepTimes,     setStepTimes]     = useState<Record<string, number>>({})
  const [startTime]     = useState(Date.now())
  const logsEndRef      = useRef<HTMLDivElement>(null)

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  const addLog = useCallback((msg: string) => {
    setLogs(l => [...l, msg])
  }, [])

  const handleStart = () => {
    if (!appUrl.trim()) return
    setStarted(true)
    setCurrentStep('scale_up')
    const t0 = Date.now()

    const ws = new WebSocket(`${wsUrl}/api/qa/ws/container-run`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        token, run_id: run.testRunId, project_id: projectId, app_url: appUrl.trim(),
      }))
    }

    ws.onmessage = (e) => {
      const ev = JSON.parse(e.data)
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0)

      if (ev.message) addLog(ev.message)

      switch (ev.type) {
        case 'scale_up':
          setCurrentStep('scale_up')
          setStepTimes(s => ({ ...s, scale_up: parseInt(elapsed) }))
          if (ev.taskArn) setTaskArn(ev.taskArn)
          break
        case 'setup':
          setCurrentStep('setup')
          setStepTimes(s => ({ ...s, setup: parseInt(elapsed) }))
          break
        case 'running':
          setCurrentStep('running')
          setStepTimes(s => ({ ...s, running: parseInt(elapsed) }))
          break
        case 'screenshot':
          setCurrentStep('running')
          break
        case 'upload':
          setCurrentStep('upload')
          setStepTimes(s => ({ ...s, upload: parseInt(elapsed) }))
          break
        case 'scale_down':
          setCurrentStep('scale_down')
          setStepTimes(s => ({ ...s, scale_down: parseInt(elapsed) }))
          break
        case 'done':
          setCurrentStep('done')
          setResult({ passed: ev.totalPassed ?? 0, failed: ev.totalFailed ?? 0,
                      screenshots: ev.totalScreenshots ?? 0 })
          // Load screenshots
          qaApi.getContainerScreenshots(run.testRunId)
               .then(r => setScreenshots(r.data))
               .catch(() => {})
          onComplete()
          break
        case 'error':
          setCurrentStep('error')
          addLog(`Error: ${ev.message}`)
          break
      }
    }

    ws.onerror = () => { setCurrentStep('error'); addLog('WebSocket connection failed') }
    ws.onclose = () => { if (currentStep !== 'done' && currentStep !== 'error') setCurrentStep('error') }
  }

  useEffect(() => () => { wsRef.current?.close() }, [])

  const visScreenshots = screenshots.filter(s =>
    filter === 'all' ? true : filter === 'failed' ? s.failed : !s.failed
  )

  const elapsed = (step: string) => {
    const t = stepTimes[step]
    return t !== undefined ? `0:${String(t).padStart(2,'0')}` : ''
  }

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:300,
        display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={onClose}>
      <motion.div initial={{ scale:0.94, y:20 }} animate={{ scale:1, y:0 }}
        exit={{ scale:0.94, opacity:0 }}
        style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)',
          borderRadius:16, width:'100%', maxWidth:960, maxHeight:'90vh',
          display:'flex', flexDirection:'column', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--color-border)', flexShrink:0 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
              <Server size={16} color="var(--color-primary)" />
              <span style={{ fontFamily:'var(--font-heading)', fontWeight:800, fontSize:16,
                color:'var(--color-text)' }}>Container Test Run</span>
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4,
                background:'rgba(79,142,247,0.15)', color:'var(--color-primary)' }}>
                ECS Fargate
              </span>
            </div>
            <div style={{ fontSize:12, color:'var(--color-muted)' }}>
              Run: {run.testRunId.slice(0,8).toUpperCase()}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
            color:'var(--color-muted)', display:'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* App URL input (pre-launch) */}
        {!started && (
          <div style={{ padding:'24px 20px', borderBottom:'1px solid var(--color-border)' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--color-subtext)',
              marginBottom:8 }}>Application URL to Test *</div>
            <div style={{ display:'flex', gap:10 }}>
              <input className="ov-input" style={{ flex:1 }}
                placeholder="https://staging.payments.aura.com"
                value={appUrl} onChange={e => setAppUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleStart() }} />
              <motion.button className="ov-btn ov-btn-primary"
                onClick={handleStart} disabled={!appUrl.trim()}
                whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
                style={{ gap:6, flexShrink:0 }}>
                <Play size={13} /> Launch Container
              </motion.button>
            </div>
            <div style={{ fontSize:11, color:'var(--color-muted)', marginTop:6 }}>
              Playwright will open this URL and take screenshots at every test step.
            </div>
          </div>
        )}

        {/* Main body */}
        {started && (
          <div style={{ flex:1, display:'grid', gridTemplateColumns:'240px 1fr',
            minHeight:0, overflow:'hidden' }}>

            {/* Left: Lifecycle timeline */}
            <div style={{ borderRight:'1px solid var(--color-border)',
              padding:'16px 14px', display:'flex', flexDirection:'column', gap:4, overflowY:'auto' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--color-muted)',
                textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>
                Timeline
              </div>
              {appUrl && (
                <div style={{ fontSize:11, color:'var(--color-subtext)', marginBottom:10,
                  padding:'6px 8px', background:'var(--color-card)', borderRadius:6,
                  wordBreak:'break-all' }}>
                  {appUrl}
                </div>
              )}
              {taskArn && (
                <div style={{ fontSize:10, color:'var(--color-muted)', marginBottom:10,
                  fontFamily:'var(--font-mono)', wordBreak:'break-all' }}>
                  Task: {taskArn.split('/').pop()?.slice(0,12)}...
                </div>
              )}

              {STEPS.map(step => {
                const st = stepStatus(currentStep, step.id)
                const color = st==='done' ? '#10b981' : st==='active' ? 'var(--color-primary)'
                            : st==='error' ? '#ef4444' : 'var(--color-muted)'
                return (
                  <div key={step.id} style={{ display:'flex', alignItems:'center', gap:8,
                    padding:'8px 10px', borderRadius:8,
                    background: st==='active' ? 'var(--color-primary)12' : 'transparent' }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', flexShrink:0,
                      background:`${color}18`, border:`1.5px solid ${color}`,
                      display:'flex', alignItems:'center', justifyContent:'center', color }}>
                      {st==='done'   ? <CheckCircle2 size={12} /> :
                       st==='error'  ? <XCircle size={12} /> :
                       st==='active' ? <Loader size={12} style={{ animation:'spin 1s linear infinite' }} /> :
                       step.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:st==='active'?700:500, color:
                        st==='active' ? 'var(--color-text)' : st==='done' ? '#10b981' : 'var(--color-muted)' }}>
                        {step.label}
                      </div>
                      {elapsed(step.id) && (
                        <div style={{ fontSize:10, color:'var(--color-muted)', fontFamily:'var(--font-mono)' }}>
                          {elapsed(step.id)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Result summary */}
              {result && (
                <div style={{ marginTop:12, padding:'10px 12px', borderRadius:8,
                  background:'var(--color-card)', border:'1px solid var(--color-border)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--color-muted)',
                    textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                    Results
                  </div>
                  {[
                    { label:'Passed',      value:result.passed,      color:'#10b981' },
                    { label:'Failed',      value:result.failed,      color:'#ef4444' },
                    { label:'Screenshots', value:result.screenshots, color:'var(--color-primary)' },
                  ].map(r => (
                    <div key={r.label} style={{ display:'flex', justifyContent:'space-between',
                      alignItems:'center', marginBottom:5 }}>
                      <span style={{ fontSize:12, color:'var(--color-subtext)' }}>{r.label}</span>
                      <span style={{ fontSize:13, fontWeight:800, color:r.color }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Screenshots + logs */}
            <div style={{ display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}>

              {/* Screenshot gallery */}
              {screenshots.length > 0 ? (
                <div style={{ flex:1, padding:'14px 16px', overflowY:'auto' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <Camera size={14} color="var(--color-primary)" />
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--color-text)' }}>
                      Screenshots ({visScreenshots.length})
                    </span>
                    {/* Filter tabs */}
                    <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
                      {(['all','passed','failed'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                          style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:5,
                            cursor:'pointer', background:filter===f?'var(--color-primary)':'transparent',
                            border:`1px solid ${filter===f?'var(--color-primary)':'var(--color-border)'}`,
                            color:filter===f?'#fff':'var(--color-muted)', transition:'all 0.15s',
                            textTransform:'capitalize' }}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))',
                    gap:8 }}>
                    {visScreenshots.map((s, i) => (
                      <motion.div key={s.key} initial={{ opacity:0, scale:0.95 }}
                        animate={{ opacity:1, scale:1 }} transition={{ delay:i*0.03 }}
                        onClick={() => setLightbox(s)}
                        style={{ cursor:'pointer', borderRadius:8, overflow:'hidden',
                          border:`1.5px solid ${s.failed ? '#ef444466' : 'var(--color-border)'}`,
                          background:'var(--color-card)', position:'relative' }}>
                        <img src={s.url} alt={s.filename}
                          style={{ width:'100%', height:90, objectFit:'cover', display:'block' }} />
                        <div style={{ padding:'5px 7px', display:'flex', alignItems:'center', gap:5 }}>
                          {s.failed
                            ? <XCircle size={10} color="#ef4444" />
                            : <CheckCircle2 size={10} color="#10b981" />}
                          <span style={{ fontSize:10, color:'var(--color-muted)',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {s.filename.replace(/^\d+-/, '').replace('.png','')}
                          </span>
                        </div>
                        <div style={{ position:'absolute', top:4, right:4, opacity:0,
                          transition:'opacity 0.15s' }}
                          className="screenshot-zoom">
                          <ZoomIn size={14} color="#fff" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Live log stream (while running) */
                <div style={{ flex:1, padding:'14px 16px', overflowY:'auto',
                  background:'rgba(0,0,0,0.2)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--color-muted)',
                    textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>
                    Live Output
                  </div>
                  {logs.map((l, i) => (
                    <div key={i} style={{ fontSize:12, color:
                      l.toLowerCase().includes('error') || l.toLowerCase().includes('fail') ? '#ef4444' :
                      l.toLowerCase().includes('✓') || l.toLowerCase().includes('complete') ? '#10b981' :
                      'var(--color-subtext)',
                      fontFamily:'var(--font-mono)', marginBottom:4, lineHeight:1.5 }}>
                      {l}
                    </div>
                  ))}
                  {currentStep !== 'done' && currentStep !== 'error' && (
                    <div style={{ color:'var(--color-primary)', fontFamily:'var(--font-mono)',
                      fontSize:12 }}>▌</div>
                  )}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:400,
              display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
            onClick={() => setLightbox(null)}>
            <div style={{ maxWidth:900, width:'100%' }} onClick={e => e.stopPropagation()}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {lightbox.failed
                    ? <XCircle size={16} color="#ef4444" />
                    : <CheckCircle2 size={16} color="#10b981" />}
                  <span style={{ color:'#e2e8f0', fontSize:14, fontWeight:600 }}>
                    {lightbox.filename}
                  </span>
                </div>
                <button onClick={() => setLightbox(null)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.5)' }}>
                  <X size={18} />
                </button>
              </div>
              <img src={lightbox.url} alt={lightbox.filename}
                style={{ width:'100%', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
