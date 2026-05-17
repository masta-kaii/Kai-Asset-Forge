import type { AgentName, WorkflowType } from '@/lib/types'

export const PIPELINE_MAP: Record<number, { type: WorkflowType; agent: AgentName }> = {
  0: { type: 'trend-research', agent: 'trend-researcher' },
  1: { type: 'art-direction', agent: 'art-director' },
  2: { type: 'asset-generation', agent: 'asset-generator' },
  3: { type: 'quality-review', agent: 'quality-controller' },
  4: { type: 'packaging', agent: 'packager' },
  5: { type: 'store-listing', agent: 'store-lister' },
  6: { type: 'marketing', agent: 'marketer' },
}

export const WORKFLOW_LABELS: Record<WorkflowType, string> = {
  'trend-research': 'Trend Research',
  'art-direction': 'Art Direction',
  'asset-generation': 'Asset Generation',
  'quality-review': 'Quality Review',
  'packaging': 'Packaging',
  'store-listing': 'Store Listing',
  'marketing': 'Marketing',
}
