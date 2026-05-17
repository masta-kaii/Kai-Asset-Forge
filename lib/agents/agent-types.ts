import type { AgentName, AgentState } from '@/lib/types'

export const AGENTS: { name: AgentName; label: string; emoji: string; role: string }[] = [
  { name: 'trend-researcher', label: 'Trend Researcher', emoji: '🔍', role: 'Research profitable asset trends' },
  { name: 'art-director', label: 'Art Director', emoji: '🎨', role: 'Maintain visual consistency' },
  { name: 'asset-generator', label: 'Asset Generator', emoji: '⚡', role: 'Generate assets using AI models' },
  { name: 'quality-controller', label: 'Quality Controller', emoji: '✅', role: 'Review generation quality' },
  { name: 'packager', label: 'Packager', emoji: '📦', role: 'Prepare assets for selling' },
  { name: 'store-lister', label: 'Store Lister', emoji: '🏪', role: 'Generate marketplace listings' },
  { name: 'marketer', label: 'Marketer', emoji: '📢', role: 'Generate promotional content' },
]

export function defaultAgentState(name: AgentName): AgentState {
  return {
    name,
    status: 'idle',
    lastActive: new Date().toISOString(),
    totalCompleted: 0,
    successRate: 100,
  }
}

export const PIPELINE_STEPS = [
  'Trend Research',
  'Art Direction',
  'Asset Generation',
  'Quality Review',
  'Packaging',
  'Store Listing',
  'Marketing Content',
] as const
