/**
 * Pure domain logic for Pi Prompt Lens:
 * heuristics, prompt formatting, response parsing, and configuration normalization.
 * Zero pi or Node I/O imports — completely testable in isolation.
 */

export const MAX_PROMPT_CHARS = 8000
export const MIN_LATIN_WORDS = 4
export const MIN_CJK_CHARS = 8
export const MAX_FINDINGS = 3

export type FindingCategory =
  | 'goal'
  | 'context'
  | 'scope'
  | 'constraint'
  | 'ambiguity'
  | 'validation'

export interface PromptFinding {
  category: FindingCategory
  title: string
  problem: string
  suggestion: string
}

export interface PromptLensReport {
  findings: PromptFinding[]
  rewrite: string
}

export type ReviewDecision = { mode: 'review'; report: PromptLensReport } | { mode: 'skip' }

export interface PromptLensConfig {
  enabled: boolean
  model?: string
}

export const DEFAULT_CONFIG: PromptLensConfig = {
  enabled: true
}

/**
 * Normalizes an arbitrary object into a valid PromptLensConfig.
 */
export function normalizeConfig(raw: unknown): PromptLensConfig {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_CONFIG }
  }
  const obj = raw as Record<string, unknown>
  const enabled = obj.enabled !== false
  const model =
    typeof obj.model === 'string' && obj.model.trim().length > 0 ? obj.model.trim() : undefined

  return {
    enabled,
    ...(model ? { model } : {})
  }
}

/**
 * Evaluates whether an interactive user prompt should be analyzed.
 * Local filter rules:
 * - Non-empty string
 * - Does not start with slash or bang command
 * - Unicode character length <= MAX_PROMPT_CHARS
 * - At least MIN_LATIN_WORDS words or MIN_CJK_CHARS CJK characters
 * - Natural language density >= 45%
 * - Code/syntax token density < 35%
 */
export function shouldReviewPrompt(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/') || trimmed.startsWith('!')) return false
  if (trimmed.length > MAX_PROMPT_CHARS) return false

  // Code block fence check: prompts that are mostly raw fenced code are not actionable requests
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    const lines = trimmed.split('\n')
    if (lines.length > 2) {
      // Fenced block with no surrounding prose
      return false
    }
  }

  const words = trimmed.split(/\s+/).filter(Boolean)
  const cjkChars = trimmed.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu)?.length ?? 0

  if (words.length < MIN_LATIN_WORDS && cjkChars < MIN_CJK_CHARS) {
    return false
  }

  const nonWhitespace = trimmed.replace(/\s+/g, '')
  if (nonWhitespace.length === 0) return false

  const letters = nonWhitespace.match(/\p{L}|\p{N}/gu)?.length ?? 0
  const naturalRatio = letters / nonWhitespace.length
  if (naturalRatio < 0.45) {
    return false
  }

  // Detect token patterns characteristic of pure code/stacktraces
  const codeyTokens = words.filter((w) => /[{}()[\];=<>\\`$]|::|->|\.[a-z]{1,4}$|\//.test(w)).length
  if (words.length > 0 && codeyTokens / words.length >= 0.35) {
    return false
  }

  return true
}

/**
 * Builds the LLM system prompt instructing the model to act as a prompt reviewer.
 */
export function buildReviewPrompt(userPrompt: string): string {
  return [
    'You are Pi Prompt Lens, an expert assistant that reviews how a user asks AI coding assistants for work.',
    'Your goal is to evaluate ONLY the provided user prompt and point out actionable gaps or ambiguities.',
    '',
    'CRITICAL GUIDELINES:',
    '1. Evaluate ONLY the user prompt itself. Do NOT judge code correctness or expect prior assistant answers.',
    '2. If the user prompt is already clear, specific, bounded, and actionable, you MUST reply with:',
    '   {"mode": "skip"}',
    '3. Never manufacture nitpicks or fake complaints. Only point out material issues that could genuinely confuse an AI or cause wasted turns.',
    '4. Available categories: "goal", "context", "scope", "constraint", "ambiguity", "validation".',
    '5. Limit findings to at most 3 points. Each finding must have:',
    '   - category: one of the allowed categories',
    '   - title: concise summary of the issue (under 8 words)',
    '   - problem: why this hurts execution or clarity',
    '   - suggestion: concrete action to improve it',
    '6. Provide one "rewrite" that preserves the user\'s exact original intent while adding necessary structure.',
    '   Do NOT invent hypothetical project facts or pretend to know unstated file paths.',
    '7. LANGUAGE MATCHING: Write the title, problem, suggestion, and rewrite in the PRIMARY natural language of the user prompt (e.g. Chinese for Chinese prompt, English for English prompt).',
    '',
    'Output MUST be raw JSON without markdown code blocks:',
    '{"mode": "review", "findings": [{"category": "...", "title": "...", "problem": "...", "suggestion": "..."}], "rewrite": "..."}',
    'or',
    '{"mode": "skip"}',
    '',
    'User prompt to review:',
    '<<<',
    userPrompt,
    '>>>'
  ].join('\n')
}

/**
 * Extracts a JSON object from a model response string.
 */
export function extractJson<T>(raw: string): T | undefined {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as T
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined
  } catch {
    return undefined
  }
}

const VALID_CATEGORIES = new Set<FindingCategory>([
  'goal',
  'context',
  'scope',
  'constraint',
  'ambiguity',
  'validation'
])

/**
 * Validates and parses the raw string response from the side review LLM.
 */
export function parseReviewResponse(raw: string): ReviewDecision {
  const obj = extractJson<Record<string, unknown>>(raw)
  if (!obj) return { mode: 'skip' }

  if (obj.mode === 'skip') {
    return { mode: 'skip' }
  }

  if (obj.mode !== 'review') {
    return { mode: 'skip' }
  }

  const rawFindings = Array.isArray(obj.findings) ? obj.findings : []
  const findings: PromptFinding[] = []

  for (const item of rawFindings) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const category =
      typeof record.category === 'string' &&
      VALID_CATEGORIES.has(record.category as FindingCategory)
        ? (record.category as FindingCategory)
        : 'ambiguity'
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const problem = typeof record.problem === 'string' ? record.problem.trim() : ''
    const suggestion = typeof record.suggestion === 'string' ? record.suggestion.trim() : ''

    if (problem && suggestion) {
      findings.push({
        category,
        title: title || category,
        problem,
        suggestion
      })
    }
  }

  const rewrite = typeof obj.rewrite === 'string' ? obj.rewrite.trim() : ''

  if (findings.length === 0 || !rewrite) {
    return { mode: 'skip' }
  }

  return {
    mode: 'review',
    report: {
      findings: findings.slice(0, MAX_FINDINGS),
      rewrite
    }
  }
}
