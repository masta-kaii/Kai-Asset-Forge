export type AssetType = 'creature' | 'accessory' | 'item' | 'weapon' | 'food' | 'material' | 'animation' | 'ui-icon'

export type AssetStatus = 'draft' | 'review' | 'approved' | 'rejected'

export type AssetStyle = 'pixel-art' | 'cute-retro' | 'pastel-cyber-fantasy' | 'tamagotchi'

export interface Asset {
  id: string
  name: string
  type: AssetType
  style: AssetStyle
  previewUrl: string
  thumbnailUrl: string
  rawAssetUrl?: string
  pixelSize?: number
  paletteSize?: number
  status: AssetStatus
  tags: string[]
  dimensions: { width: number; height: number }
  isTransparent: boolean
  qualityScore: number
  createdAt: string
  updatedAt: string
}

export interface AssetPack {
  id: string
  title: string
  description: string
  assets: string[]
  price: number
  status: AssetStatus
  previewUrl: string
  storeUrl?: string
  createdAt: string
}

export interface GenerationRecord {
  id: string
  assetId: string
  agentName: AgentName
  promptId: string
  generationTime: string
  qualityScore: number
  outputUrl: string
  createdAt: string
}

export type WorkflowType = 'trend-research' | 'art-direction' | 'asset-generation' | 'quality-review' | 'packaging' | 'store-listing' | 'marketing'

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Workflow {
  id: string
  workflowType: WorkflowType
  status: WorkflowStatus
  assignedAgent: AgentName
  input: Record<string, unknown>
  output?: Record<string, unknown>
  startedAt?: string
  completedAt?: string
  createdAt: string
}

export type AgentName = 'trend-researcher' | 'art-director' | 'asset-generator' | 'quality-controller' | 'packager' | 'store-lister' | 'marketer'

export type AgentStatus = 'idle' | 'working' | 'error'

export interface AgentState {
  name: AgentName
  status: AgentStatus
  currentTask?: string
  lastActive: string
  totalCompleted: number
  successRate: number
}

export interface Prompt {
  id: string
  promptName: string
  promptText: string
  modelUsed: string
  rating: number
  category: AssetType
  style: AssetStyle
  createdAt: string
}

export interface DashboardStats {
  totalAssets: number
  approvedAssets: number
  activeWorkflows: number
  completedToday: number
  agentActivity: number
  packsReady: number
}
