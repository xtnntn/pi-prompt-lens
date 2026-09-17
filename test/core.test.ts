import { describe, expect, it } from 'vitest'
import {
  shouldReviewPrompt,
  buildReviewPrompt,
  parseReviewResponse,
  normalizeConfig,
  MAX_PROMPT_CHARS,
  DEFAULT_CONFIG
} from '../src/core.ts'

describe('normalizeConfig', () => {
  it('returns default config when given invalid input', () => {
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG)
    expect(normalizeConfig('invalid')).toEqual(DEFAULT_CONFIG)
    expect(normalizeConfig({})).toEqual({ enabled: true })
  })

  it('normalizes enabled flag', () => {
    expect(normalizeConfig({ enabled: false })).toEqual({ enabled: false })
    expect(normalizeConfig({ enabled: true })).toEqual({ enabled: true })
  })

  it('normalizes model reference', () => {
    expect(normalizeConfig({ enabled: true, model: ' anthropic/claude-3-5-sonnet ' })).toEqual({
      enabled: true,
      model: 'anthropic/claude-3-5-sonnet'
    })
    expect(normalizeConfig({ enabled: true, model: '' })).toEqual({ enabled: true })
  })
})

describe('shouldReviewPrompt', () => {
  it('skips empty or whitespace-only inputs', () => {
    expect(shouldReviewPrompt('')).toBe(false)
    expect(shouldReviewPrompt('   \n  \t ')).toBe(false)
  })

  it('skips slash and bang commands', () => {
    expect(shouldReviewPrompt('/help')).toBe(false)
    expect(shouldReviewPrompt('/lens on')).toBe(false)
    expect(shouldReviewPrompt('!git status')).toBe(false)
    expect(shouldReviewPrompt('!npm test')).toBe(false)
  })

  it('skips oversized prompts (> MAX_PROMPT_CHARS)', () => {
    const longPrompt = 'a '.repeat(MAX_PROMPT_CHARS + 1)
    expect(shouldReviewPrompt(longPrompt)).toBe(false)
  })

  it('skips very short replies (<4 Latin words, <8 CJK chars)', () => {
    expect(shouldReviewPrompt('ok')).toBe(false)
    expect(shouldReviewPrompt('yes please')).toBe(false)
    expect(shouldReviewPrompt('done')).toBe(false)
    expect(shouldReviewPrompt('好的')).toBe(false)
    expect(shouldReviewPrompt('请继续')).toBe(false)
  })

  it('accepts valid Latin prompts with 4 or more words', () => {
    expect(shouldReviewPrompt('please refactor this function')).toBe(true)
    expect(shouldReviewPrompt('how do I install dependencies here?')).toBe(true)
  })

  it('accepts valid CJK prompts with 8 or more characters', () => {
    expect(shouldReviewPrompt('请帮我重构这个函数并且写单元测试')).toBe(true)
    expect(shouldReviewPrompt('这里的错误处理应该怎么写才合适')).toBe(true)
  })

  it('skips pure code blocks', () => {
    const code = '```typescript\nfunction test() {\n  return 1;\n}\n```'
    expect(shouldReviewPrompt(code)).toBe(false)
  })

  it('skips symbol and punctuation spam', () => {
    expect(shouldReviewPrompt('???? !!!!! ----- ===== +++++')).toBe(false)
    expect(shouldReviewPrompt('&&& ||| *** %%% $$$ ###')).toBe(false)
  })

  it('skips code-dense inputs', () => {
    const codey = 'const x = foo(bar); y->z; a[i] = {b: 1}; c.d(e);'
    expect(shouldReviewPrompt(codey)).toBe(false)
  })
})

describe('buildReviewPrompt', () => {
  it('includes the user prompt and key guidelines', () => {
    const prompt = buildReviewPrompt('optimize my sql query please')
    expect(prompt).toContain('Pi Prompt Lens')
    expect(prompt).toContain('optimize my sql query please')
    expect(prompt).toContain('{"mode": "skip"}')
    expect(prompt).toContain('"mode": "review"')
  })
})

describe('parseReviewResponse', () => {
  it('parses valid review mode JSON', () => {
    const response = JSON.stringify({
      mode: 'review',
      findings: [
        {
          category: 'scope',
          title: 'Unbounded query scope',
          problem: 'Does not specify which table or database',
          suggestion: 'Name the target table and expected columns'
        }
      ],
      rewrite: 'Optimize the SELECT query on user_orders table by indexing created_at'
    })

    const parsed = parseReviewResponse(response)
    expect(parsed.mode).toBe('review')
    if (parsed.mode === 'review') {
      expect(parsed.report.findings).toHaveLength(1)
      expect(parsed.report.findings[0].category).toBe('scope')
      expect(parsed.report.rewrite).toContain('Optimize the SELECT query')
    }
  })

  it('handles markdown fences in JSON response', () => {
    const raw = '```json\n{"mode": "skip"}\n```'
    expect(parseReviewResponse(raw)).toEqual({ mode: 'skip' })
  })

  it('clips findings at MAX_FINDINGS (3)', () => {
    const findings = [1, 2, 3, 4, 5].map((i) => ({
      category: 'validation',
      title: `Finding ${i}`,
      problem: `Problem ${i}`,
      suggestion: `Suggestion ${i}`
    }))

    const raw = JSON.stringify({
      mode: 'review',
      findings,
      rewrite: 'New prompt'
    })

    const parsed = parseReviewResponse(raw)
    expect(parsed.mode).toBe('review')
    if (parsed.mode === 'review') {
      expect(parsed.report.findings).toHaveLength(3)
    }
  })

  it('safely falls back to skip when findings or rewrite are empty', () => {
    expect(parseReviewResponse('{"mode": "review", "findings": [], "rewrite": "foo"}')).toEqual({
      mode: 'skip'
    })
    expect(
      parseReviewResponse(
        '{"mode": "review", "findings": [{"problem": "x", "suggestion": "y"}], "rewrite": ""}'
      )
    ).toEqual({ mode: 'skip' })
  })

  it('safely falls back to skip on garbage response', () => {
    expect(parseReviewResponse('Internal server error')).toEqual({ mode: 'skip' })
    expect(parseReviewResponse('{ invalid json')).toEqual({ mode: 'skip' })
  })
})
