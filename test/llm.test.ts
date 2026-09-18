import { describe, expect, it } from 'vitest'
import { runPromptReview } from '../src/llm.ts'

describe('runPromptReview', () => {
  it('uses the registry provider once and extracts text content', async () => {
    const calls: { model: unknown; context: unknown; options: unknown }[] = []
    const model = { provider: 'custom', id: 'reviewer', api: 'custom-api' }
    const provider = {
      streamSimple: (requestModel: unknown, context: unknown, options: unknown) => {
        calls.push({ model: requestModel, context, options })
        return {
          result: async () => ({
            content: [
              { type: 'reasoning', text: 'ignore this' },
              { type: 'text', text: 'first part' },
              { type: 'text', text: 'second part' }
            ]
          })
        }
      }
    }
    const ctx = {
      modelRegistry: {
        getApiKeyAndHeaders: async () => ({
          ok: true,
          apiKey: 'secret',
          headers: { 'x-test': 'header' },
          baseUrl: 'https://example.test',
          env: { TEST_ENV: '1' }
        }),
        getProvider: () => provider
      }
    }

    const result = await runPromptReview(
      ctx as never,
      model as never,
      'review prompt',
      new AbortController().signal
    )

    expect(result).toBe('first part\nsecond part')
    expect(calls).toHaveLength(1)
    expect(calls[0].model).toEqual({ ...model, baseUrl: 'https://example.test' })
    expect(calls[0].context).toEqual({
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'review prompt' }],
          timestamp: expect.any(Number)
        }
      ]
    })
    expect(calls[0].options).toMatchObject({
      apiKey: 'secret',
      headers: { 'x-test': 'header' },
      env: { TEST_ENV: '1' }
    })
  })

  it('returns undefined when authentication cannot be resolved', async () => {
    let providerCalled = false
    const ctx = {
      modelRegistry: {
        getApiKeyAndHeaders: async () => ({ ok: false, error: 'not configured' }),
        getProvider: () => {
          providerCalled = true
          return undefined
        }
      }
    }

    const result = await runPromptReview(
      ctx as never,
      { provider: 'custom', id: 'reviewer', api: 'custom-api' } as never,
      'review prompt'
    )

    expect(result).toBeUndefined()
    expect(providerCalled).toBe(false)
  })
})
