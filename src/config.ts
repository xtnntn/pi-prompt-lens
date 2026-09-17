/**
 * Configuration loader and saver for Pi Prompt Lens.
 * Stored at ~/.pi/agent/prompt-lens.json.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { normalizeConfig, DEFAULT_CONFIG, type PromptLensConfig } from './core.ts'

const CONFIG_PATH = path.join(os.homedir(), '.pi', 'agent', 'prompt-lens.json')

export function loadConfig(): PromptLensConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
    return normalizeConfig(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config: PromptLensConfig): void {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  } catch {
    // Non-fatal persistence failure
  }
}
