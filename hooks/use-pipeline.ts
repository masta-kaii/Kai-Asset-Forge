"use client"

import { useState, useCallback } from "react"
import type { Workflow, WorkflowType, WorkflowStatus } from "@/lib/types"
import { PIPELINE_MAP, WORKFLOW_LABELS } from "@/lib/workflows/pipeline"

export interface PipelineStep {
  key: WorkflowType
  label: string
  progress: number
  status: WorkflowStatus
}

const INITIAL_STEPS: PipelineStep[] = Object.entries(WORKFLOW_LABELS).map(([key, label]) => ({
  key: key as WorkflowType,
  label,
  progress: 0,
  status: "pending" as WorkflowStatus,
}))

interface UsePipelineReturn {
  steps: PipelineStep[]
  activeStep: number
  isRunning: boolean
  startPipeline: () => void
  pausePipeline: () => void
  resetPipeline: () => void
}

export function usePipeline(): UsePipelineReturn {
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS)
  const [activeStep, setActiveStep] = useState(-1)
  const [isRunning, setIsRunning] = useState(false)

  const startPipeline = useCallback(() => {
    setIsRunning(true)
    setActiveStep(0)
  }, [])

  const pausePipeline = useCallback(() => {
    setIsRunning(false)
  }, [])

  const resetPipeline = useCallback(() => {
    setIsRunning(false)
    setActiveStep(-1)
    setSteps(INITIAL_STEPS)
  }, [])

  return { steps, activeStep, isRunning, startPipeline, pausePipeline, resetPipeline }
}
