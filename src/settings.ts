/**
 * Settings command and interactive TUI menu for Prompt Lens.
 * Command: /lens [on|off|model]
 */

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'
import { getSelectListTheme, getSettingsListTheme } from '@earendil-works/pi-coding-agent'
import {
  Container,
  type SelectItem,
  SelectList,
  type SettingItem,
  SettingsList,
  Text
} from '@earendil-works/pi-tui'
import { loadConfig, saveConfig } from './config.ts'
import type { PromptLensConfig } from './core.ts'

export const STATUS_KEY = 'prompt-lens'

export function updateStatusBar(ctx: ExtensionContext, config: PromptLensConfig): void {
  if (!ctx.hasUI) return
  if (!config.enabled) {
    ctx.ui.setStatus(STATUS_KEY, '🔎 lens off')
  } else {
    ctx.ui.setStatus(STATUS_KEY, undefined)
  }
}

function getModelOptions(ctx: ExtensionContext): SelectItem[] {
  const available = ctx.modelRegistry.getAvailable()
  return [
    { value: 'default', label: 'default', description: 'follow the active session model' },
    ...available.map((m) => ({
      value: `${m.provider}/${m.id}`,
      label: `${m.provider}/${m.id}`,
      description: m.name
    }))
  ]
}

async function openModelPicker(ctx: ExtensionContext, config: PromptLensConfig): Promise<void> {
  const selected = await ctx.ui.custom<string | undefined>((tui, theme, _kb, done) => {
    const options = getModelOptions(ctx)
    const list = new SelectList(options, Math.min(options.length, 10), getSelectListTheme())
    const preselect = options.findIndex((o) => o.value === (config.model ?? 'default'))
    if (preselect >= 0) list.setSelectedIndex(preselect)

    list.onSelect = (item) => done(item.value)
    list.onCancel = () => done(undefined)

    return {
      render: (width: number) => [
        theme.fg('accent', theme.bold(' Prompt Lens Model')),
        '',
        ...list.render(width)
      ],
      invalidate: () => {},
      handleInput: (data: string) => {
        list.handleInput(data)
        tui.requestRender()
      }
    }
  })

  if (selected === undefined) return
  config.model = selected === 'default' ? undefined : selected
  saveConfig(config)
  updateStatusBar(ctx, config)
}

async function openSettingsMenu(ctx: ExtensionContext, config: PromptLensConfig): Promise<void> {
  await ctx.ui.custom((tui, theme, _kb, done) => {
    const modelSubmenu = (current: string, submenuDone: (value?: string) => void) => {
      const options = getModelOptions(ctx)
      const list = new SelectList(options, Math.min(options.length, 10), getSelectListTheme())
      const preselect = options.findIndex((o) => o.value === current)
      if (preselect >= 0) list.setSelectedIndex(preselect)

      list.onSelect = (item) => submenuDone(item.value)
      list.onCancel = () => submenuDone(undefined)

      return {
        render: (width: number) => [
          theme.fg('accent', theme.bold(' Prompt Lens Model')),
          '',
          ...list.render(width)
        ],
        invalidate: () => {},
        handleInput: (data: string) => list.handleInput(data)
      }
    }

    const items: SettingItem[] = [
      {
        id: 'enabled',
        label: 'Prompt Review',
        currentValue: config.enabled ? 'on' : 'off',
        values: ['on', 'off'],
        description:
          'Review prompts in the background and append improvement advice after responses'
      },
      {
        id: 'model',
        label: 'Review Model',
        currentValue: config.model ?? 'default',
        description: 'Model for side reviews — "default" follows the current session model',
        submenu: (current, submenuDone) => modelSubmenu(current, submenuDone)
      }
    ]

    const container = new Container()
    container.addChild(new Text(theme.fg('accent', theme.bold('🔎 Prompt Lens Settings')), 1, 0))

    const list = new SettingsList(
      items,
      items.length + 2,
      getSettingsListTheme(),
      (id, newValue) => {
        if (id === 'enabled') {
          config.enabled = newValue === 'on'
          saveConfig(config)
          updateStatusBar(ctx, config)
        } else if (id === 'model') {
          config.model = newValue === 'default' ? undefined : newValue
          saveConfig(config)
          updateStatusBar(ctx, config)
        }
      },
      () => done(undefined)
    )

    container.addChild(list)

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        list.handleInput?.(data)
        tui.requestRender()
      }
    }
  })
}

export function registerSettings(pi: ExtensionAPI, _deps: { cancelPending(): void }): void {
  pi.registerCommand('lens', {
    description:
      'Prompt review settings: /lens opens settings menu; /lens [on|off|model] sets options directly',
    handler: async (args, ctx) => {
      const config = loadConfig()
      const [sub, value] = args.trim().split(/\s+/).filter(Boolean)

      const notifyStatus = () => {
        ctx.ui.notify(
          `Prompt Lens: ${config.enabled ? 'on' : 'off'} | Model: ${config.model ?? 'default (session model)'}`,
          'info'
        )
      }

      if (!sub) {
        if (ctx.hasUI && ctx.mode === 'tui') {
          await openSettingsMenu(ctx, config)
        } else {
          notifyStatus()
        }
        return
      }

      switch (sub) {
        case 'on':
          config.enabled = true
          saveConfig(config)
          updateStatusBar(ctx, config)
          notifyStatus()
          break
        case 'off':
          config.enabled = false
          saveConfig(config)
          updateStatusBar(ctx, config)
          notifyStatus()
          break
        case 'model':
          if (!value) {
            if (ctx.hasUI && ctx.mode === 'tui') {
              await openModelPicker(ctx, config)
              notifyStatus()
            } else {
              ctx.ui.notify('Usage: /lens model <provider/id|default>', 'warning')
            }
            return
          }
          if (value === 'default') {
            config.model = undefined
          } else {
            config.model = value
          }
          saveConfig(config)
          updateStatusBar(ctx, config)
          notifyStatus()
          break
        default:
          ctx.ui.notify(
            'Usage: /lens  |  /lens on|off  |  /lens model [provider/id|default]',
            'warning'
          )
      }
    }
  })

  pi.on('session_start', (_event, ctx) => {
    updateStatusBar(ctx, loadConfig())
  })
}
