/**
 * Extension composition root for Pi Prompt Lens.
 * Wires review orchestrator and settings.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { registerReviewOrchestrator } from './review.ts'
import { registerSettings } from './settings.ts'

export default function (pi: ExtensionAPI): void {
  const orchestrator = registerReviewOrchestrator(pi)
  registerSettings(pi, orchestrator)
}
