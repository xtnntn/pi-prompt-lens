/**
 * Custom entry renderer for Prompt Lens reviews.
 * Registered via pi.registerEntryRenderer('prompt-lens', ...).
 * Custom entries are persisted in the session transcript for user viewing
 * but NEVER injected into subsequent LLM conversation turns.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { getMarkdownTheme } from '@earendil-works/pi-coding-agent'
import { Box, Markdown, Text } from '@earendil-works/pi-tui'
import type { PromptFinding, PromptLensReport } from './core.ts'

export const ENTRY_TYPE = 'prompt-lens'

export interface PromptLensEntryData extends PromptLensReport {
  reviewedAt: number
}

function formatMarkdownCard(findings: PromptFinding[], rewrite: string): string {
  const parts: string[] = []

  for (const f of findings) {
    const categoryBadge = `**[${f.category.toUpperCase()}] ${f.title}**`
    parts.push(
      `${categoryBadge}\n- ⚠️ **Issue:** ${f.problem}\n- 💡 **Suggestion:** ${f.suggestion}`
    )
  }

  parts.push(`---\n**Suggested Rewrite:**\n\n> ${rewrite.replace(/\n/g, '\n> ')}`)

  return parts.join('\n\n')
}

export function registerPromptLensRenderer(pi: ExtensionAPI): void {
  pi.registerEntryRenderer<PromptLensEntryData>(ENTRY_TYPE, (entry, _options, theme) => {
    const data = entry.data
    if (!data || !data.findings || data.findings.length === 0) return undefined

    const box = new Box(1, 0, (t) => theme.bg('customMessageBg', t))
    box.addChild(new Text(theme.fg('accent', theme.bold('🔎 Prompt Lens')), 0, 0))

    const markdownContent = formatMarkdownCard(data.findings, data.rewrite)
    box.addChild(new Markdown(markdownContent, 0, 0, getMarkdownTheme()))

    return box
  })
}
