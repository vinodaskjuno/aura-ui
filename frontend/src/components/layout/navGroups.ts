import {
  LayoutDashboard, Settings, Plug2, Activity, Orbit,
  TestTube2, ShieldCheck, CalendarClock, Bot, Database,
  ScanSearch, Radar, Server, GitCompareArrows, CircleDollarSign,
} from 'lucide-react'

/**
 * The navigation, in one place.
 *
 * Both the sidebar and the organization-role editor read this: the menus an
 * administrator can grant are generated from the menus that actually exist, so the
 * two cannot drift into offering a permission that opens nothing.
 *
 * GROUPED BY INTENT, NOT BY LIFECYCLE. There used to be one `WORKSPACE` group of nine,
 * ordered by how work flows through the product. That ordering is real, but it is a
 * thing you have to already know: on screen it was nine undifferentiated items, three
 * of which — AI Traces, AI Ops, Observability — are near-synonyms that sat apart and
 * read as three attempts at the same feature. Five groups of two to four scan at a
 * glance, and putting the three observability surfaces side by side is what finally
 * makes their relationship legible:
 *
 *   AI Traces      what an LLM app DID          (span trees, threads, judges)
 *   AI Ops         what it COST                 (gateway usage, budgets)
 *   Observability  what the INFRASTRUCTURE did  (SRE incident investigation)
 *
 * AI Traces and AI Ops also shared the `Activity` icon, so the two hardest items to
 * tell apart were the two rendered identically.
 */
interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  permission: string
  badge?: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

export const ALL_NAV_GROUPS: NavGroup[] = [
  {
    // Understanding what you have: the graph, where it came from, and what the
    // code behind it actually says.
    label: 'BUILD',
    items: [
      { to: '/dashboard',            label: 'Dashboard',           icon: LayoutDashboard,  permission: 'dashboard' },
      { to: '/ontology',             label: 'Onto Verse',          icon: Orbit,            permission: 'ontology' },
      { to: '/lineage',              label: 'Lineage',             icon: GitCompareArrows, permission: 'ontology' },
      { to: '/reverse-engineering',  label: 'Reverse Eng.',        icon: ScanSearch,       permission: 'dev_workspace' },
    ],
  },
  {
    // The two surfaces where an agent does work on your behalf.
    label: 'AGENTS',
    items: [
      { to: '/dev-chat',             label: 'DevMate',             icon: Bot,              permission: 'dev_workspace' },
      { to: '/qa',                   label: 'QualityMind',         icon: TestTube2,        permission: 'qa_workspace' },
    ],
  },
  {
    // Behaviour, cost, and infrastructure — in that order, because that is the order
    // you ask the questions in when something looks wrong.
    label: 'OBSERVE',
    items: [
      { to: '/ai-observability',     label: 'AI Traces',           icon: Activity,           permission: 'dev_workspace' },
      // NOT `Activity`: sharing it with AI Traces made the two adjacent items whose
      // names are hardest to tell apart render identically.
      { to: '/aiops',                label: 'AI Ops',              icon: CircleDollarSign,   permission: 'aiops' },
      { to: '/observability',        label: 'Observability',       icon: Radar,              permission: 'observability', badge: 'SRE' },
    ],
  },
  {
    label: 'DATA',
    items: [
      // Data Loader leads: it is what puts data into the graph, and Connectors
      // and MCP Servers are the sources it draws on.
      { to: '/ontology/data-loader', label: 'Data Loader',         icon: Database,        permission: 'ontology_maintain' },
      { to: '/connectors',           label: 'Connectors',          icon: Plug2,           permission: 'connectors' },
      { to: '/mcp',                  label: 'MCP Servers',         icon: Server,          permission: 'connectors' },
      { to: '/scheduler',            label: 'Scheduler',           icon: CalendarClock,   permission: 'scheduler' },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { to: '/settings',         label: 'Settings',         icon: Settings,    permission: 'settings' },
      { to: '/access',           label: 'Access',           icon: ShieldCheck, permission: 'user_management' },
    ],
  },
]
