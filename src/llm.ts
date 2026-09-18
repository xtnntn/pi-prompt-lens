/**
 * Side-channel LLM invocation for Prompt Lens.
 * Sends a single prompt without conversation history or tools, ensuring zero cache pollution
 * and avoiding accidental tool executions.
 */

import type { Context, Message, SimpleStreamOptions } from '@earendil-works/pi-ai/compat'
import type { ExtensionContext } from '@earendil-works/pi-coding-agent'
import type { PromptLensConfig } from './core.ts'

export type ResolvedModel = NonNullable<ExtensionContext['model']>

/**
 * Resolves the model to use: configured override or the session model.
 */
export function resolveModel(
  ctx: ExtensionContext,
  config: PromptLensConfig
): ResolvedModel | undefined {
  if (config.model && config.model !== 'default') {
    const available = ctx.modelRegistry.getAvailable()
    const match = available.find(
      (m) =>
        `${m.provider}/${m.id}`.toLowerCase() === config.model?.toLowerCase() ||
        m.id.toLowerCase() === config.model?.toLowerCase()
    )
    if (match) return match
  }
  return ctx.model
}

/**
 * Executes a single prompt completion with the resolved model.
 */
export async function runPromptReview(
  ctx: ExtensionContext,
  model: ResolvedModel,
  prompt: string,
  signal?: AbortSignal
): Promise<string | undefined> {
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model)
  if (!auth.ok) {
    return undefined
  }

  const userMessage: Message = {
    role: 'user',
    content: [{ type: 'text', text: prompt }],
    timestamp: Date.now()
  }

  const context: Context = {
    messages: [userMessage]
  }

  const provider = ctx.modelRegistry.getProvider(model.provider)
  if (!provider) {
    return undefined
  }

  const options: SimpleStreamOptions = {
    apiKey: auth.apiKey,
    headers: auth.headers,
    env: auth.env,
    signal
  }
  const requestModel = auth.baseUrl ? { ...model, baseUrl: auth.baseUrl } : model
  const response = await provider.streamSimple(requestModel, context, options).result()

  return response.content
    .filter(
      (content): content is { type: 'text'; text: string } =>
        content.type === 'text' && typeof content.text === 'string'
    )
    .map((content) => content.text)
    .join('\n')
    .trim()
}
