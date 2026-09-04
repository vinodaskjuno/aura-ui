import {
  LayoutDashboard, Settings, Plug2, Activity, Orbit,
  TestTube2, ShieldCheck, CalendarClock, Bot, Database,
  ScanSearch, Radar, Server, GitCompareArrows,
} from 'lucide-react'

/**
 * The navigation, in one place.
 *
 * Both the sidebar and the organization-role editor read this: the menus an
 * administrator can grant are generated from the menus that actually exist, so the
 * two cannot drift into offering a permission that opens nothing.
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
    // Ordered by how the work actually flows: build the graph (Onto Verse,
    // Lineage), then the surfaces that consume it (DevMate, QualityMind,
    // Reverse Eng.), then the ones that observe it running (AI Traces, AI Ops,
    // Observability).
    label: 'WORKSPACE',
    items: [
      { to: '/dashboard',            label: 'Dashboard',           icon: LayoutDashboard,  permission: 'dashboard' },
      { to: '/ontology',             label: 'Onto Verse',          icon: Orbit,            permission: 'ontology' },
      { to: '/lineage',              label: 'Lineage',             icon: GitCompareArrows, permission: 'ontology' },
      { to: '/dev-chat',             label: 'DevMate',             icon: Bot,              permission: 'dev_workspace' },
      { to: '/qa',                   label: 'QualityMind',         icon: TestTube2,        permission: 'qa_workspace' },
      { to: '/reverse-engineering',  label: 'Reverse Eng.',        icon: ScanSearch,       permission: 'dev_workspace' },
      { to: '/ai-observability',     label: 'AI Traces',           icon: Activity,         permission: 'dev_workspace' },
      { to: '/aiops',                label: 'AI Ops',              icon: Activity,         permission: 'aiops' },
      { to: '/observability',        label: 'Observability',       icon: Radar,            permission: 'observability', badge: 'SRE' },
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

