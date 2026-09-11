/**
 * The landing page every authenticated user reaches.
 *
 * It used to be the same eight tiles for everyone — counting graph labels, four
 * of which were fetched and never rendered and nine of which counted labels
 * that exist nowhere in the graph. It now renders whatever the server says this
 * role needs, because the role is a server-side fact and the person holding it
 * has a different first question in the morning.
 *
 * This file deliberately holds no metric logic and no per-role branching. It is
 * a renderer over `blocks`; the shape of a role's dashboard lives in
 * aura-api/src/services/role_metrics.py. Adding a role should not touch the UI.
 *
 * What it DOES own is rhythm. A flat stack of full-width sections separated by
 * identical rules reads as a document, not a dashboard — so the hero and rail
 * share a band, metric rows run full width, and everything arrives on one
 * orchestrated stagger rather than all at once.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { getDashboardView, type DashboardView } from '../api/dashboardView'
import { useAuthStore } from '../store/authStore'
import { Headline } from '../components/ui/Headline'
import { AttentionRail } from '../components/dashboard/AttentionRail'
import { renderBlock } from '../components/dashboard/renderBlock'
import { sectionAccent } from '../components/dashboard/sectionAccent'

/** Seconds between each block's entrance. Small enough to feel like one motion. */
const STAGGER = 0.08

/**
 * The standing-metrics row is hoisted above the hero.
 *
 * Every role's first metrics block is its headline numbers — "Platform" for
 * Ops and Admin, "The last run" for QA, "What Aura mapped" for a developer —
 * and a KPI strip across the top is what people expect a dashboard to open
 * with. The narrative headline and the attention rail then sit beneath it,
 * explaining the numbers rather than being buried under them.
 */
function splitBlocks(blocks: DashboardView['blocks']) {
  const i = blocks.findIndex(b => b.kind === 'metrics')
  if (i < 0) return { strip: null, rest: blocks }
  return { strip: blocks[i], rest: blocks.filter((_, n) => n !== i) }
}

export default function DashboardPage() {
  const username = useAuthStore(s => s.username)
  const roleLabel = useAuthStore(s => s.roleLabel)
  const role = useAuthStore(s => s.role)
  const reduced = useReducedMotion()

  const [view, setView] = useState<DashboardView | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Read inside the callback so a failed refresh can tell "nothing on screen"
  // from "stale data on screen" without making `view` a dependency.
  const hasData = useRef(false)
  hasData.current = view !== null

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true)
    try {
      setView(await getDashboardView())
      setError(null)
    } catch (e) {
      // A refresh that fails while data is on screen leaves the data there —
      // stale numbers beat an error page, and the timestamp says how stale.
      if (!hasData.current) {
        setError(e instanceof Error ? e.message : 'Could not reach the server')
      }
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{
      maxWidth: 'var(--content-max)', margin: '0 auto',
      paddingBottom: 'var(--space-12)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-8)',
    }}>
      <header style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 'var(--space-4)', flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--text-label)', fontWeight: 700,
          letterSpacing: '0.11em', textTransform: 'uppercase',
          color: 'var(--color-muted)',
        }}>
          {username}{(roleLabel || role) && ` · ${roleLabel ?? role}`}
        </span>

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
            background: 'transparent', border: 'none', padding: 0,
            fontSize: 'var(--text-caption)', color: 'var(--color-subtext)',
            cursor: refreshing ? 'default' : 'pointer',
            fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums',
          }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : undefined} />
          {view ? `Updated ${new Date(view.generatedAt).toLocaleTimeString()}` : 'Refresh'}
        </button>
      </header>

      {loading && !view && <DashboardSkeleton />}

      {error && !view && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Headline text="Your dashboard could not be loaded" detail={error}
                    state="unavailable" />
          <button className="ov-btn ov-btn-ghost" style={{ alignSelf: 'flex-start' }}
                  onClick={() => load()}>Try again</button>
        </div>
      )}

      {view && (() => {
        const { strip, rest } = splitBlocks(view.blocks)
        return (
        <>
          {/* The headline numbers, first. */}
          {strip && renderBlock(strip, 'strip', 0.05, sectionAccent(0))}

          {/* Hero band: the answer, and what to do about it, in one field of
              view. These two are the reason the page exists — everything below
              is supporting detail. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)',
            gap: 'var(--space-8)', alignItems: 'start',
            // Grid children default to min-content width, which lets a wide
            // child push past its track instead of shrinking. Both tracks are
            // already minmax(0, …); this stops the CONTENT doing it too.
            minWidth: 0,
          }} className="dash-hero">
            <Headline {...view.headline} accent={sectionAccent(0)} />
            <AttentionRail items={view.attention} />
          </div>

          <motion.hr
            aria-hidden="true"
            initial={reduced ? false : { scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              border: 0, height: 1, transformOrigin: 'left',
              // Fades out to the right so it frames rather than boxes.
              background: 'linear-gradient(90deg, var(--color-border) 0%, '
                        + 'var(--color-border) 55%, transparent 100%)',
            }}
          />

          {rest.map((block, i) => (
            <div key={`${block.kind}-${i}`}>
              {/* +1 so the hoisted strip keeps accent 0 to itself and the
                  sections below it each get a distinct one. */}
              {renderBlock(block, `${block.kind}-${i}`,
                           0.25 + i * STAGGER, sectionAccent(i + 1))}
            </div>
          ))}

          {view.degraded && view.degraded.length > 0 && (
            // Named rather than hidden. A dashboard quietly missing a section
            // reads as "there is nothing there", which is a different claim.
            <p style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              fontSize: 'var(--text-caption)', color: 'var(--color-muted)',
              marginTop: 'var(--space-4)',
            }}>
              <AlertCircle size={13} />
              Some figures are unavailable — could not read: {view.degraded.join(', ')}.
            </p>
          )}
        </>
        )
      })()}
    </div>
  )
}

/**
 * Shaped like the page it precedes, so the layout does not jump when data
 * lands. The existing `.skeleton` class carries the shimmer.
 */
function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}
         aria-busy="true" aria-label="Loading your dashboard">
      {/* Same order as the real page — strip, then hero band, then detail — so
          nothing jumps when the data lands. */}
      <div style={{ display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: 'var(--space-3)' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 104 }} />
        ))}
      </div>
      <div style={{ display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)',
                    gap: 'var(--space-8)' }} className="dash-hero">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="skeleton" style={{ height: 44, width: '78%' }} />
          <div className="skeleton" style={{ height: 16, width: '52%' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton" style={{ height: 34, width: `${94 - i * 12}%` }} />
          ))}
        </div>
      </div>
      <div className="skeleton" style={{ height: 220 }} />
    </div>
  )
}
