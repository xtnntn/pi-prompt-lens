/**
 * Extension composition root for Pi Prompt Lens.
 * Wires together review orchestration, entry renderer, and settings.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { registerPromptLensRenderer } from './renderer.ts'
import { registerReviewOrchestrator } from './review.ts'
import { registerSettings } from './settings.ts'

export default function (pi: ExtensionAPI): void {
  registerPromptLensRenderer(pi)
  const orchestrator = registerReviewOrchestrator(pi)
  registerSettings(pi, orchestrator)
}
