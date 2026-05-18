"use server"

import OpenAI from "openai"
import { collection, getDocs, query, orderBy, limit as fbLimit } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import { getRecentAssets } from "@/lib/firebase/assets"
import { getBudgetStatus } from "@/lib/budget/budget"
import { runOrchestrator, findIncompleteRun } from "@/app/actions/orchestrator"
import { autonomousTick } from "@/app/actions/autonomous-agent"
import { scoutTrends } from "@/app/actions/scout"
import { runReflection } from "@/app/actions/reflection"

export interface MastaToolEvent {
  name: string
  args: Record<string, unknown>
  result: unknown
  ms: number
}

export interface MastaChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface MastaResponse {
  reply: string
  toolEvents: MastaToolEvent[]
  error?: string
}

const MASTA_SYSTEM_PROMPT = `You are Masta — the master agent of an autonomous AI business organization called KAI Asset Forge.

You are the ONLY interface the human operator talks to. You have a team of specialist agents working for you 24/7:
- Scout: researches market trends and proposes new business ideas
- Art Director / Asset Generator: produces digital game assets
- Curator: quality-checks generated assets
- Packager / Store Lister: bundles assets into commercial packs and writes listings
- Reflection: analyzes performance and suggests improvements
- Autonomous tick: a heartbeat that decides what the org should do next

Your job:
1. Understand the operator's high-level goal (e.g. "find me a new niche", "run a pack", "status?").
2. Delegate to the right tool(s). Don't ask the operator to do work you can do yourself.
3. Report back concisely. Lead with the answer. Numbers and decisions over prose.
4. Be honest about blockers (budget, provider down, stuck run). Propose the next move.

Style: terse, confident, business-focused. No "I'll happily..." filler. Treat the operator like a busy founder.`

function tools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [
    {
      type: "function",
      function: {
        name: "get_system_status",
        description:
          "Get a snapshot of the whole org: what the autonomous loop thinks it should do next, budget remaining, provider health, backlog counts. Call this when the operator asks 'how are we doing', 'status', 'what's happening'.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function",
      function: {
        name: "get_budget",
        description: "Get current spend and remaining budget (daily + monthly).",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function",
      function: {
        name: "scout_trends",
        description:
          "Ask the Scout agent to research a market theme and propose a concrete product idea with asset type, style, count, and price.",
        parameters: {
          type: "object",
          properties: {
            theme: {
              type: "string",
              description: "Optional theme hint (e.g. 'cozy farming', 'cyberpunk weapons'). If omitted Scout picks freely.",
            },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "start_pipeline",
        description:
          "Kick off the full 8-step asset production pipeline (Scout → Decision → Forge → Curator → Finalize → Reflection). Returns when the run starts; check status later.",
        parameters: {
          type: "object",
          properties: {
            theme: { type: "string", description: "Theme for this run." },
            maxAssets: { type: "number", description: "How many assets to forge (default 2, keep small to control cost)." },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "resume_stuck_run",
        description:
          "Find the most recent incomplete pipeline run and resume it from where it stopped. Use when the operator says 'continue', 'resume', or status shows a stuck run.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function",
      function: {
        name: "list_recent_runs",
        description: "List the most recent orchestrator runs with their status, completed steps, and asset counts.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max runs to return (default 5)." },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_recent_assets",
        description: "List recently generated assets with id, type, status, and quality score.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max assets to return (default 10)." },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "reflect",
        description:
          "Ask the Reflection agent to analyze recent runs and propose improvements. Use when the operator asks 'how can we do better' or before changing strategy.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
  ]
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_system_status": {
      const tick = await autonomousTick()
      return tick
    }
    case "get_budget": {
      return getBudgetStatus()
    }
    case "scout_trends": {
      const theme = typeof args.theme === "string" ? args.theme : undefined
      return await scoutTrends({ theme })
    }
    case "start_pipeline": {
      const theme = typeof args.theme === "string" ? args.theme : undefined
      const maxAssets = typeof args.maxAssets === "number" ? args.maxAssets : undefined
      return await runOrchestrator({ theme, maxAssets })
    }
    case "resume_stuck_run": {
      const stuck = await findIncompleteRun()
      if (!stuck) return { resumed: false, reason: "No incomplete run found." }
      const result = await runOrchestrator({ resumeRunId: stuck.runId })
      return { resumed: true, ...result }
    }
    case "list_recent_runs": {
      const lim = typeof args.limit === "number" ? args.limit : 5
      const db = getDb()
      const snap = await getDocs(query(collection(db, "orchestrator_runs"), orderBy("startedAt", "desc"), fbLimit(lim)))
      return snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        return {
          id: data.id,
          status: data.status,
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          assetCount: data.assetCount,
          productName: data.productName,
          completedSteps:
            (data.resumeData as { completedSteps?: string[] } | undefined)?.completedSteps ?? [],
          error: data.error,
        }
      })
    }
    case "list_recent_assets": {
      const lim = typeof args.limit === "number" ? args.limit : 10
      const assets = await getRecentAssets(lim)
      return assets.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        status: a.status,
        qualityScore: a.qualityScore,
        createdAt: a.createdAt,
      }))
    }
    case "reflect": {
      return await runReflection()
    }
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

export async function sendToMasta(input: {
  history: MastaChatMessage[]
  userMessage: string
}): Promise<MastaResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      reply: "",
      toolEvents: [],
      error: "OPENAI_API_KEY is missing. Add it in Vercel → Settings → Environment Variables.",
    }
  }

  const client = new OpenAI({ apiKey })
  const toolEvents: MastaToolEvent[] = []

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: MASTA_SYSTEM_PROMPT },
    ...input.history.map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
    { role: "user", content: input.userMessage },
  ]

  const MAX_TOOL_ROUNDS = 5
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages,
        tools: tools(),
        tool_choice: "auto",
        temperature: 0.4,
      })

      const choice = completion.choices[0]
      const msg = choice?.message
      if (!msg) {
        return { reply: "", toolEvents, error: "Empty response from model." }
      }

      const toolCalls = msg.tool_calls ?? []
      if (toolCalls.length === 0) {
        return { reply: msg.content ?? "", toolEvents }
      }

      messages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: toolCalls,
      })

      for (const call of toolCalls) {
        if (call.type !== "function") continue
        let parsedArgs: Record<string, unknown> = {}
        try {
          parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {}
        } catch {
          parsedArgs = {}
        }
        const t0 = Date.now()
        let result: unknown
        try {
          result = await executeTool(call.function.name, parsedArgs)
        } catch (err) {
          result = { error: err instanceof Error ? err.message : "Tool failed" }
        }
        const ms = Date.now() - t0
        toolEvents.push({ name: call.function.name, args: parsedArgs, result, ms })
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 8000),
        })
      }
    }

    return {
      reply: "(Masta hit the tool-call round limit. Try a more specific request.)",
      toolEvents,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Masta failed"
    return { reply: "", toolEvents, error: message }
  }
}
