import React from 'react'
import {
  Cloud, Server, Database, Globe, Layers, GitBranch, Network, Monitor,
  Flag, Star, Building2, Shield, Box, Table2, ArrowLeftRight, HardDrive,
  FolderOpen, Code2, Lock, Zap, Workflow,
} from 'lucide-react'

interface IconEntry { Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; label: string }

export const NODE_TYPE_ICONS: Record<string, IconEntry> = {
  organization:          { Icon: Building2,      label: 'Organization' },
  project:               { Icon: FolderOpen,     label: 'Project' },
  service:               { Icon: Server,         label: 'Service' },
  api:                   { Icon: Globe,          label: 'API Endpoint' },
  module:                { Icon: Layers,         label: 'Module' },
  database:              { Icon: Database,       label: 'Database' },
  dataflow:              { Icon: ArrowLeftRight, label: 'Data Flow' },
  cloudresource:         { Icon: Cloud,          label: 'Cloud Resource' },
  kubernetescluster:     { Icon: Network,        label: 'K8s Cluster' },
  deploymentenvironment: { Icon: Monitor,        label: 'Environment' },
  buildpipeline:         { Icon: GitBranch,      label: 'Pipeline' },
  table:                 { Icon: Table2,         label: 'Table' },
  businessrule:          { Icon: Shield,         label: 'Business Rule' },
  featureflag:           { Icon: Flag,           label: 'Feature Flag' },
  feature:               { Icon: Star,           label: 'Feature' },
  repository:            { Icon: Code2,          label: 'Repository' },
  infrastructure:        { Icon: HardDrive,      label: 'Infrastructure' },
  network:               { Icon: Network,        label: 'Network' },
  security:              { Icon: Lock,           label: 'Security' },
  api_service:           { Icon: Zap,            label: 'API Service' },
  application:           { Icon: Workflow,       label: 'Application' },
  team:                  { Icon: Building2,      label: 'Team' },
}

export function getNodeIcon(node_type: string): IconEntry {
  return NODE_TYPE_ICONS[(node_type || '').toLowerCase()] ?? { Icon: Box, label: node_type || 'Node' }
}
