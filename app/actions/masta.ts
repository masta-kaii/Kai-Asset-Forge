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
import { buildPackDeliverable } from "@/app/actions/pack-builder"
import { generatePackItchListing, markPackUploaded } from "@/app/actions/itchio-listing"
import { buildMastaDigest } from "@/app/actions/digest"
import { getPackById, getPacks } from "@/lib/firebase/packs"

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
    {
      type: "function",
      function: {
        name: "list_packs",
        description:
          "List asset packs with their status and whether the buyer-facing ZIP deliverable has been built. Use this when the operator asks 'what's ready to ship' or 'show me the packs'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max packs to return (default 10)." },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "build_pack_deliverable",
        description:
          "Assemble the buyer-facing ZIP, preview grid, and cover image for a specific pack. Use when the operator asks to 'package' a pack or 'get it ready to upload'.",
        parameters: {
          type: "object",
          properties: {
            packId: { type: "string", description: "Pack id from list_packs." },
          },
          required: ["packId"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_pack",
        description:
          "Get the full record for a pack including the ZIP, cover, and preview URLs once built.",
        parameters: {
          type: "object",
          properties: {
            packId: { type: "string" },
          },
          required: ["packId"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "generate_itchio_listing",
        description:
          "Draft an itch.io-shaped listing (title, description, tags, suggested price) for a pack and store it on the pack record. Use after build_pack_deliverable when the operator says 'prep listing' or 'ready it for itch.io'.",
        parameters: {
          type: "object",
          properties: {
            packId: { type: "string" },
          },
          required: ["packId"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "mark_pack_uploaded",
        description:
          "Record that the operator finished uploading a pack to itch.io. Sets the storeUrl and flips the pack to approved.",
        parameters: {
          type: "object",
          properties: {
            packId: { type: "string" },
            storeUrl: { type: "string", description: "Live itch.io URL." },
          },
          required: ["packId", "storeUrl"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "build_digest",
        description:
          "Build a fresh 24-hour digest right now (runs / assets / packs / budget / what-needs-you) without waiting for the daily cron.",
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
    case "list_packs": {
      const lim = typeof args.limit === "number" ? args.limit : 10
      const packs = await getPacks()
      return packs.slice(0, lim).map((p) => ({
        id: p.id,
        title: p.title,
        assetCount: p.assets?.length ?? 0,
        price: p.price,
        status: p.status,
        deliverableReady: !!p.zipUrl,
        uploaded: !!p.storeUrl,
        slug: p.slug,
      }))
    }
    case "build_pack_deliverable": {
      const packId = typeof args.packId === "string" ? args.packId : ""
      if (!packId) return { success: false, error: "packId required" }
      return await buildPackDeliverable(packId)
    }
    case "get_pack": {
      const packId = typeof args.packId === "string" ? args.packId : ""
      if (!packId) return { success: false, error: "packId required" }
      const pack = await getPackById(packId)
      if (!pack) return { success: false, error: "Pack not found" }
      return {
        id: pack.id,
        title: pack.title,
        description: pack.description,
        price: pack.price,
        status: pack.status,
        assetCount: pack.assets?.length ?? 0,
        slug: pack.slug,
        zipUrl: pack.zipUrl,
        coverUrl: pack.coverUrl,
        previewGridUrl: pack.previewGridUrl,
        listing: pack.listing,
        uploaded: !!pack.storeUrl,
        storeUrl: pack.storeUrl,
        uploadPagePath: `/products/upload/${pack.id}`,
      }
    }
    case "generate_itchio_listing": {
      const packId = typeof args.packId === "string" ? args.packId : ""
      if (!packId) return { success: false, error: "packId required" }
      return await generatePackItchListing(packId)
    }
    case "mark_pack_uploaded": {
      const packId = typeof args.packId === "string" ? args.packId : ""
      const storeUrl = typeof args.storeUrl === "string" ? args.storeUrl : ""
      if (!packId || !storeUrl) return { success: false, error: "packId and storeUrl required" }
      return await markPackUploaded(packId, storeUrl)
    }
    case "build_digest": {
      const d = await buildMastaDigest()
      return { body: d.body, snapshot: d.snapshot }
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
