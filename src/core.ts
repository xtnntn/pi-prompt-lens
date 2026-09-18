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
 * Builds the high-leverage LLM review prompt.
 * Focuses on practical coding-agent leverage: negative constraints, acceptance gates,
 * and eliminating hollow placeholders in rewrites.
 */
export function buildReviewPrompt(userPrompt: string): string {
  return [
    'You are Pi Prompt Lens, a sharp, pragmatic prompt coach for software engineers communicating with AI coding agents.',
    'Your mission: Pinpoint the real operational blindspots in the user prompt that cause wasted turns, risky edits, or vague answers.',
    '',
    '## CORE REVIEW PRINCIPLES (Focus on practical engineering gaps):',
    '1. NEGATIVE CONSTRAINTS (What NOT to touch): Did the user forget to specify what must be preserved? (e.g. "do not change public API", "keep existing tests passing", "no new dependencies")',
    '2. ACCEPTANCE GATES (Done Criteria): Did the user provide a verifiable definition of done? (e.g. "run npm test", "provide benchmark", "check type errors")',
    '3. AMBIGUITY OF "OPTIMIZE/REFACTOR": If asking to improve code, did they clarify whether the goal is latency, memory, readability, or reducing dependencies?',
    '4. NO NITPICKING: If the prompt is already bounded, clear, and actionable, output {"mode": "skip"}. Never invent trivial or pedantic complaints.',
    '',
    '## REWRITE RULES (Critical for useful output):',
    '- NEVER use hollow fill-in placeholders like "[insert file path]", "[function name]", or "[module]".',
    '- Write a ready-to-use, natural prompt. If details are missing, frame them as explicit clauses or natural alternatives instead of blanks.',
    "- Preserve the user's exact goal, intent, and tone. Do not turn a quick 1-line question into a 5-paragraph RFC.",
    '',
    '## LANGUAGE MATCHING:',
    'Output findings and rewrite in the DOMINANT natural language of the user prompt (Chinese for Chinese, English for English, etc.).',
    '',
    '## FEW-SHOT EXAMPLES:',
    'Example 1 (Chinese):',
    'Prompt: "重构一下这个函数让它跑快点"',
    'Output: {',
    '  "mode": "review",',
    '  "findings": [',
    '    {"category": "constraint", "title": "未设保护边界", "problem": "未限制是否可修改签名或破坏兼容性", "suggestion": "声明保持现有参数与返回值不变"},',
    '    {"category": "validation", "title": "缺少验证指标", "problem": "未指定基准测试或完成标准", "suggestion": "要求给出改动前后的复杂度对比并跑通单测"}',
    '  ],',
    '  "rewrite": "请分析此函数的性能瓶颈，在不改变函数签名与对外行为的前提下进行优化，并附带改动说明及单元测试。"',
    '}',
    '',
    'Example 2 (English):',
    'Prompt: "add redis caching to user profile"',
    'Output: {',
    '  "mode": "review",',
    '  "findings": [',
    '    {"category": "scope", "title": "Missing TTL & Invalidation", "problem": "Cache strategy is undefined, risking stale data", "suggestion": "Specify TTL duration and cache invalidation triggers"},',
    '    {"category": "constraint", "title": "Fallback Behavior", "problem": "No instruction for Redis downtime", "suggestion": "Clarify if it should gracefully fall back to DB"}',
    '  ],',
    '  "rewrite": "Add Redis caching to the user profile lookup with a 15-minute TTL and DB fallback on connection failure. Ensure cache invalidates on profile update." ',
    '}',
    '',
    '## RESPONSE FORMAT (Strict JSON only, no markdown codeblocks):',
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
