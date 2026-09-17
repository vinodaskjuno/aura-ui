import { useEffect } from 'react'
import { Activity, Boxes, MessageSquare } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tabs } from '../ui/Tabs'
import type { QaRunner } from '../../api/qa'
import { RAIL_WIDTH, useDevmateRailStore } from '../../store/devmateRailStore'
import FlociControl from './FlociControl'
import AppRunControl from './AppRunControl'
import PolicyPanel from './PolicyPanel'
import ProjectObservability from './ProjectObservability'

/**
 * DevMate's context rail.
 *
 * The four control panels used to sit in the main column, above the message list, and
 * that was a layout bug rather than a styling one: every region above the list is
 * `flexShrink: 0` and only the list itself has `flex: 1`, so the controls took what
 * they needed and the conversation got the remainder. With the terminal open — which
 * it was by default, because Start force-opened it and the choice persisted — the
 * controls held ~550px and the chat got ~150.
 *
 * Machine state is ambient context for a conversation, not part of it. A rail is what
 * ambient context is for.
 *
 * ENVIRONMENT MERGES FLOCI AND RUN-LOCALLY on purpose. They are two halves of one
 * question — what is running on my machine — and the terminal used to sit BETWEEN
 * them, which is exactly why nobody could see they were related.
 *
 * The rail hides nothing: `ProjectStatusStrip` reports all four states on one line in
 * the main column, and each of its segments opens this rail on the matching tab.
 */
const TABS = [
  { id: 'chat' as const, label: 'Chat', icon: <MessageSquare size={12} /> },
  { id: 'env' as const, label: 'Env', icon: <Boxes size={12} /> },
  { id: 'checks' as const, label: 'Checks', icon: <Activity size={12} /> },
]

export default function ProjectRail({
  projectId, projectName, runners, you, history,
}: {
  projectId?: string
  projectName?: string
  runners: QaRunner[]
  you?: string
  /** The session list, passed in rather than rebuilt: it is bound to the page's own
   *  session state and handlers, and moving it here would drag all of that with it. */
  history: ReactNode
}) {
  const { open, tab, show, init } = useDevmateRailStore()

  useEffect(() => { init() }, [init])

  if (!open) return null

  return (
    <div style={{
      width: RAIL_WIDTH, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--color-surface)',
      borderLeft: '1px solid var(--color-border)',
      overflow: 'hidden',
    }}>
      <Tabs
        tabs={TABS}
        value={tab}
        onChange={show}
        style={{ flexShrink: 0, paddingLeft: 'var(--space-2)' }}
      />

      {/* One scroll container for whichever tab is showing, so a long policy report
          and a long session list cannot each invent their own overflow behaviour. */}
      {/* `overflowX: hidden` and `minWidth: 0` are both load-bearing. Without them a
          single wide child — a log line, a long file path — makes the whole rail a
          side-scroller, and a flex child's default `min-width: auto` refuses to
          shrink below its content. Wide content belongs in a popup, not in here. */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0,
                    overflowY: 'auto', overflowX: 'hidden' }}>
        {tab === 'chat' && history}

        {tab === 'env' && (
          projectId ? (
            <div style={{ display: 'grid', gap: 'var(--space-2)',
                          padding: 'var(--space-2)' }}>
              <FlociControl projectId={projectId} runners={runners} you={you} />
              <AppRunControl projectId={projectId} runners={runners} you={you} />
            </div>
          ) : <Empty>Pick a project to see what is running.</Empty>
        )}

        {tab === 'checks' && (
          projectId ? (
            <div style={{ display: 'grid', gap: 'var(--space-2)',
                          padding: 'var(--space-2)' }}>
              <PolicyPanel projectId={projectId} projectName={projectName ?? ''} />
              <ProjectObservability projectId={projectId} />
            </div>
          ) : <Empty>Pick a project to see its checks.</Empty>
        )}
      </div>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: 'var(--space-4)', fontSize: 'var(--text-caption)',
      color: 'var(--color-muted)', lineHeight: 1.5,
    }}>{children}</div>
  )
}
