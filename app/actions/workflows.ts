"use server"

import { getRecentWorkflows, getActiveWorkflows, createWorkflow, updateWorkflowStatus } from "@/lib/firebase/workflows"
import type { Workflow, WorkflowType, AgentName } from "@/lib/types"

export async function fetchRecentWorkflows(count: number): Promise<Workflow[]> {
  return getRecentWorkflows(count)
}

export async function fetchActiveWorkflows(): Promise<Workflow[]> {
  return getActiveWorkflows()
}

export async function startWorkflow(data: {
  workflowType: WorkflowType
  agent: AgentName
}): Promise<Workflow> {
  return createWorkflow({
    workflowType: data.workflowType,
    status: "pending",
    assignedAgent: data.agent,
    input: {},
  })
}

export async function failWorkflow(id: string): Promise<void> {
  await updateWorkflowStatus(id, "failed", new Date().toISOString())
}
