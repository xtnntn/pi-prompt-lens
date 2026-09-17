/**
 * Review orchestrator:
 * 1. Catches eligible user prompts in pi.on('input').
 * 2. Launches side-review completion immediately in the background.
 * 3. Waits until pi.on('agent_settled') to append the review card.
 * 4. Silently drops pending reviews if the session was aborted, switched, or errored.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { loadConfig } from './config.ts'
import {
  shouldReviewPrompt,
  buildReviewPrompt,
  parseReviewResponse,
  type ReviewDecision
} from './core.ts'
import { resolveModel, runPromptReview } from './llm.ts'
import { ENTRY_TYPE, type PromptLensEntryData } from './renderer.ts'

interface PendingReview {
  id: string
  prompt: string
  abort: AbortController
  promise: Promise<ReviewDecision | undefined>
}

export function registerReviewOrchestrator(pi: ExtensionAPI): { cancelPending(): void } {
  let pending: PendingReview | null = null

  const cancelPending = () => {
    if (pending) {
      pending.abort.abort()
      pending = null
    }
  }

  pi.on('input', (event, ctx) => {
    // Only run in interactive TUI mode
    if (!ctx.hasUI || ctx.mode !== 'tui') return
    // Only run on user inputs submitted while idle (skip steer and followUp mid-stream)
    if (event.source !== 'interactive' || event.streamingBehavior !== undefined) return

    const config = loadConfig()
    if (!config.enabled) return

    const prompt = event.text.trim()
    if (!shouldReviewPrompt(prompt)) return

    cancelPending()

    const abort = new AbortController()
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const reviewTask = async (): Promise<ReviewDecision | undefined> => {
      try {
        const model = resolveModel(ctx, config)
        if (!model) return undefined

        const reviewPrompt = buildReviewPrompt(prompt)
        const raw = await runPromptReview(ctx, model, reviewPrompt, abort.signal)
        if (!raw || abort.signal.aborted) return undefined

        return parseReviewResponse(raw)
      } catch {
        return undefined
      }
    }

    pending = {
      id,
      prompt,
      abort,
      promise: reviewTask()
    }
  })

  pi.on('agent_settled', async (_event, ctx) => {
    if (!pending) return
    const active = pending
    pending = null

    if (!ctx.hasUI || ctx.mode !== 'tui') return

    try {
      const decision = await active.promise
      if (!decision || decision.mode !== 'review') return
      if (active.abort.signal.aborted) return

      pi.appendEntry<PromptLensEntryData>(ENTRY_TYPE, {
        findings: decision.report.findings,
        rewrite: decision.report.rewrite,
        reviewedAt: Date.now()
      })
    } catch {
      // Non-blocking: side reviews never disturb the agent or throw to users
    }
  })

  const resetState = () => cancelPending()
  pi.on('session_start', resetState)
  pi.on('session_shutdown', resetState)
  pi.on('session_tree', resetState)

  return { cancelPending }
}
