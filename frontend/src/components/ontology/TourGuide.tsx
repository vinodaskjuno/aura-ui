import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Play, Pause, Square, SkipBack, SkipForward } from 'lucide-react'
import type { OntologyNode, OntologyLink } from '../../api/ontologyUniverse'
import { useGraphTheme } from '../../hooks/useGraphTheme'

interface TourStep {
  node: OntologyNode
  description: string
  highlightIds: string[]
}

interface Props {
  nodes: OntologyNode[]
  links: OntologyLink[]
  projectNode: OntologyNode | null
  onFocusNode: (node: OntologyNode, highlightIds: string[]) => void
  onStop: () => void
}

function bfsFrom(startId: string, links: OntologyLink[]): string[] {
  const visited = new Set<string>([startId])
  const queue = [startId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const l of links) {
      const src = typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id
      const tgt = typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id
      if (src === cur && !visited.has(tgt)) { visited.add(tgt); queue.push(tgt) }
      if (tgt === cur && !visited.has(src)) { visited.add(src); queue.push(src) }
    }
  }
  visited.delete(startId)
  return [...visited]
}

function getDirectChildren(nodeId: string, links: OntologyLink[]): string[] {
  return links
    .filter(l => (typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id) === nodeId)
    .map(l => typeof l.target === 'string' ? l.target : (l.target as OntologyNode).id)
}

function outDegree(nodeId: string, links: OntologyLink[]): number {
  return links.filter(l => (typeof l.source === 'string' ? l.source : (l.source as OntologyNode).id) === nodeId).length
}

function buildSteps(projectNode: OntologyNode, nodes: OntologyNode[], links: OntologyLink[]): TourStep[] {
  const steps: TourStep[] = []
  const allReachable = bfsFrom(projectNode.id, links)
  const reachableSet = new Set(allReachable)
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Step 1: Project itself
  steps.push({
    node: projectNode,
    description: (projectNode as any).description || `Project: ${projectNode.label}`,
    highlightIds: allReachable.slice(0, 20),
  })

  // Get services
  const serviceIds = getDirectChildren(projectNode.id, links)
  const services = serviceIds.map(id => nodeMap.get(id)).filter((n): n is OntologyNode =>
    !!n && (n.node_type || '').toLowerCase() === 'service' && reachableSet.has(n.id)
  ).sort((a, b) => a.label.localeCompare(b.label))

  for (const svc of services) {
    const svcChildren = getDirectChildren(svc.id, links)
    steps.push({
      node: svc,
      description: (svc as any).description || `Service: ${svc.label} — ${svcChildren.length} components`,
      highlightIds: [svc.id, ...svcChildren],
    })

    // Top 3 APIs for this service
    const apis = svcChildren
      .map(id => nodeMap.get(id))
      .filter((n): n is OntologyNode => !!n && (n.node_type || '').toLowerCase() === 'api')
      .sort((a, b) => outDegree(b.id, links) - outDegree(a.id, links))
      .slice(0, 3)

    for (const api of apis) {
      steps.push({
        node: api,
        description: (api as any).description || `API: ${api.label}`,
        highlightIds: [api.id, svc.id],
      })
    }

    // Databases
    const dbs = svcChildren
      .map(id => nodeMap.get(id))
      .filter((n): n is OntologyNode => !!n && ['database', 'table', 'dataflow'].includes((n.node_type || '').toLowerCase()))
      .slice(0, 2)

    for (const db of dbs) {
      steps.push({
        node: db,
        description: (db as any).description || `${db.node_type}: ${db.label}`,
        highlightIds: [db.id, svc.id],
      })
    }
  }

  // Cloud resources (not already covered)
  const coveredIds = new Set(steps.map(s => s.node.id))
  const cloudNodes = nodes.filter(n =>
    reachableSet.has(n.id) &&
    !coveredIds.has(n.id) &&
    ['cloudresource', 'kubernetescluster', 'deploymentenvironment'].includes((n.node_type || '').toLowerCase())
  ).slice(0, 4)

  for (const cloud of cloudNodes) {
    steps.push({
      node: cloud,
      description: (cloud as any).description || `Cloud resource: ${cloud.label}`,
      highlightIds: [cloud.id],
    })
  }

  return steps
}

const INTERVAL_MS = 3000

export default function TourGuide({ nodes, links, projectNode, onFocusNode, onStop }: Props) {
  const gt = useGraphTheme()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const steps = useMemo(() => {
    if (!projectNode) return []
    return buildSteps(projectNode, nodes, links)
  }, [projectNode, nodes, links])

  const currentStep = steps[currentIdx] ?? null

  useEffect(() => {
    if (currentStep) {
      onFocusNode(currentStep.node, currentStep.highlightIds)
    }
  }, [currentIdx, steps])

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentIdx(prev => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, INTERVAL_MS)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPlaying, steps.length])

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, idx))
    setCurrentIdx(clamped)
  }

  const progress = steps.length > 1 ? (currentIdx / (steps.length - 1)) * 100 : 100

  if (steps.length === 0) return null

  const iconBtn = (onClick: () => void, children: React.ReactNode, title: string, accent?: string) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 8,
        background: accent ? `${accent}22` : 'rgba(255,255,255,0.07)',
        border: `1px solid ${accent ? `${accent}55` : 'rgba(255,255,255,0.12)'}`,
        color: accent || '#e2e8f0', cursor: 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0, padding: 0,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = accent ? `${accent}40` : 'rgba(255,255,255,0.14)')}
      onMouseLeave={e => (e.currentTarget.style.background = accent ? `${accent}22` : 'rgba(255,255,255,0.07)')}
    >
      {children}
    </button>
  )

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      zIndex: 50,
      background: 'rgba(6,12,26,0.97)',
      borderTop: '1px solid rgba(255,255,255,0.12)',
      backdropFilter: 'blur(12px)',
      padding: '14px 24px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Top row: title + progress + step counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isPlaying ? '#22c55e' : '#64748b',
            display: 'inline-block',
            boxShadow: isPlaying ? '0 0 6px #22c55e' : 'none',
            transition: 'all 0.3s',
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
            {projectNode?.label ?? 'Project'} Tour
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg, #22c55e, #16a34a)',
            borderRadius: 2, transition: 'width 0.4s ease',
          }} />
        </div>

        <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>
          {currentIdx + 1} / {steps.length}
        </span>
      </div>

      {/* Bottom row: description + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Step description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentStep?.description}
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {currentStep?.node.node_type}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {iconBtn(() => goTo(currentIdx - 1), <SkipBack size={14} strokeWidth={2} />, 'Previous')}
          {iconBtn(
            () => setIsPlaying(v => !v),
            isPlaying ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />,
            isPlaying ? 'Pause' : 'Play',
            '#22c55e',
          )}
          {iconBtn(() => { setIsPlaying(false); onStop() }, <Square size={14} strokeWidth={2} />, 'Stop', '#ef4444')}
          {iconBtn(() => goTo(currentIdx + 1), <SkipForward size={14} strokeWidth={2} />, 'Next')}
        </div>

        <div style={{
          fontSize: 10, color: '#475569', flexShrink: 0,
          background: 'rgba(255,255,255,0.05)', borderRadius: 4,
          padding: '2px 8px', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {INTERVAL_MS / 1000}s
        </div>
      </div>
    </div>
  )
}
