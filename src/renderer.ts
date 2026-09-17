/**
 * Custom entry renderer for Prompt Lens reviews.
 * Registered via pi.registerEntryRenderer('prompt-lens', ...).
 * Designed to mirror the clean, lightweight, two-column TUI aesthetic of Writing tutor:
 * - Diamond icon with high-contrast rewrite up front
 * - Low-key muted section headers
 * - Tight two-column layout: accented finding title on the left, dim actionable advice on the right
 * - Zero heavy markdown fences or redundant emojis
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Box, Container, Text } from '@earendil-works/pi-tui'
import type { PromptFinding, PromptLensReport } from './core.ts'

export const ENTRY_TYPE = 'prompt-lens'

export interface PromptLensEntryData extends PromptLensReport {
  reviewedAt: number
}

function renderFindings(container: Container, findings: PromptFinding[], theme: any): void {
  if (findings.length === 0) return

  container.addChild(new Text(theme.fg('muted', 'Prompt Gaps & Suggestions'), 0, 0))

  for (const f of findings) {
    const title = theme.fg('accent', f.title || f.category)
    const reason = theme.fg('dim', `${f.problem} → ${f.suggestion}`)
    container.addChild(new Text(`${title}  ${reason}`, 0, 0))
  }
}

export function registerPromptLensRenderer(pi: ExtensionAPI): void {
  pi.registerEntryRenderer<PromptLensEntryData>(ENTRY_TYPE, (entry, _options, theme) => {
    const data = entry.data
    if (!data || !data.findings || data.findings.length === 0) return undefined

    const box = new Box(1, 0, (t) => theme.bg('customMessageBg', t))
    const container = new Container()

    // Header line
    container.addChild(new Text(theme.fg('accent', theme.bold('🔎 Prompt Lens')), 0, 0))

    // Best practice / Suggested rewrite placed right under header, mirroring Writing tutor sentence
    if (data.rewrite) {
      container.addChild(
        new Text(`${theme.fg('dim', '◇')} ${theme.fg('success', data.rewrite)}`, 0, 0)
      )
    }

    // Two-column list of actionable findings
    renderFindings(container, data.findings, theme)

    box.addChild(container)
    return box
  })
}
