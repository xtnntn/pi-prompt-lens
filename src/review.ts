/**
 * Review orchestrator for Prompt Lens:
 * 1. Catches eligible user prompts in pi.on('input').
 * 2. Clears any previous floating review widget.
 * 3. Launches parallel side review in the background.
 * 4. Shows the result via ctx.ui.setWidget() as a fixed floating panel above the editor.
 */

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'
import { loadConfig } from './config.ts'
import {
  shouldReviewPrompt,
  buildReviewPrompt,
  parseReviewResponse,
  type ReviewDecision
} from './core.ts'
import { resolveModel, runPromptReview } from './llm.ts'
import { showPromptLensWidget, hidePromptLensWidget } from './renderer.ts'

interface PendingReview {
  id: string
  abort: AbortController
  promise: Promise<ReviewDecision | undefined>
}

export function registerReviewOrchestrator(pi: ExtensionAPI): {
  disable(ctx: ExtensionContext): void
} {
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

    // Every new input clears previous review panel so UI stays clean
    hidePromptLensWidget(ctx)
    cancelPending()

    const config = loadConfig()
    if (!config.enabled) return

    const prompt = event.text.trim()
    if (!shouldReviewPrompt(prompt)) return

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
      if (!decision || decision.mode !== 'review') {
        hidePromptLensWidget(ctx)
        return
      }
      if (active.abort.signal.aborted) return

      // Present the review as a fixed widget above the editor
      showPromptLensWidget(ctx, decision.report)
    } catch {
      hidePromptLensWidget(ctx)
    }
  })

  const clearWidget = (_event: unknown, ctx: ExtensionContext) => {
    cancelPending()
    hidePromptLensWidget(ctx)
  }

  pi.on('session_start', clearWidget)
  pi.on('session_shutdown', clearWidget)
  pi.on('session_tree', clearWidget)

  return {
    disable(ctx: ExtensionContext) {
      clearWidget(null, ctx)
    }
  }
}
