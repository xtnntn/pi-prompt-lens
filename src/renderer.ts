/**
 * Fixed widget renderer for Prompt Lens.
 * Uses ctx.ui.setWidget('prompt-lens', ...) so the advice floats above the editor
 * in its own dedicated position rather than scrolling away with message history.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent'
import { Container, Text } from '@earendil-works/pi-tui'
import type { PromptFinding, PromptLensReport } from './core.ts'

export const WIDGET_KEY = 'prompt-lens'

function renderFindings(container: Container, findings: PromptFinding[], theme: any): void {
  if (findings.length === 0) return

  container.addChild(new Text(theme.fg('muted', 'Prompt Gaps & Suggestions'), 1, 0))

  for (const f of findings) {
    const title = theme.fg('accent', f.title || f.category)
    const reason = theme.fg('dim', `${f.problem} → ${f.suggestion}`)
    container.addChild(new Text(`${title}  ${reason}`, 1, 0))
  }
}

export function showPromptLensWidget(ctx: ExtensionContext, report: PromptLensReport): void {
  ctx.ui.setWidget(WIDGET_KEY, (_tui, theme) => {
    const container = new Container()

    // Header line
    container.addChild(new Text(theme.fg('accent', theme.bold('🔎 Prompt Lens')), 1, 0))

    // Suggested prompt rewrite with diamond bullet, styled just like writing tutor
    if (report.rewrite) {
      container.addChild(
        new Text(`${theme.fg('dim', '◇')} ${theme.fg('success', report.rewrite)}`, 1, 0)
      )
    }

    // Key prompt findings & suggestions
    renderFindings(container, report.findings, theme)

    return container
  })
}

export function hidePromptLensWidget(ctx: ExtensionContext): void {
  ctx.ui.setWidget(WIDGET_KEY, undefined)
}
