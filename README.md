# pi-prompt-lens

<p align="center">
  <strong>Review how you asked, after the agent answers.</strong><br />
  A <a href="https://pi.dev">pi</a> extension that analyzes your prompt in the background and appends actionable feedback—highlighting missing context, ambiguities, and concrete rewrites without polluting your conversation context.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/pi-prompt-lens"><img src="https://img.shields.io/npm/v/pi-prompt-lens" alt="npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/pi-prompt-lens" alt="license" /></a>
</p>

<p align="center">
  English · <a href="README.zh-CN.md">简体中文</a>
</p>

---

## What is Pi Prompt Lens?

When asking coding assistants to solve problems, small omissions in prompt scope, context, or validation criteria often lead to wasted round-trips.

**Pi Prompt Lens** watches your prompt while the agent works. Once the response finishes settling, it quietly appends a **Prompt Lens** card highlighting 1–3 concrete gaps in your request and provides a structured rewrite.

- **Zero Blocking**: Your message is sent to the agent immediately. The review evaluates concurrently.
- **Context-Isolated**: Review cards are saved as custom transcript entries; they are **never sent back to the LLM**, avoiding context bloat.
- **Noise-Free**: If your prompt was already clear, specific, and bounded, no card is shown.
- **Language Aware**: Explanations and rewrites match the language you typed in.

## Installation

```sh
pi install npm:pi-prompt-lens
```

Or install from git:

```sh
pi install git:github.com/xtnntn/pi-prompt-lens
```

For local development or testing:

```sh
git clone https://github.com/xtnntn/pi-prompt-lens.git
ln -s "$(pwd)/pi-prompt-lens" ~/.pi/agent/extensions/pi-prompt-lens
```

## How It Works

1. Send an instruction to the coding agent as usual:

   ```text
   refactor the database query
   ```

2. The agent executes your task immediately.
3. When the agent finishes, a card appears underneath the response:

   ```text
   🔎 Prompt Lens

   [SCOPE] Unbounded query target
   - Issue: Does not state which query, file, or table needs refactoring.
   - Suggestion: Specify the database function name and target table.

   [VALIDATION] Missing acceptance criteria
   - Issue: The agent cannot know if performance, readability, or typing is the goal.
   - Suggestion: State the optimization goal (e.g. index usage, query latency, or clean types).

   ---
   Suggested Rewrite:
   > Refactor the getUserOrders query in src/db/orders.ts to optimize latency and add index hints. Ensure existing tests pass.
   ```

4. If your prompt is already clear and specific, Prompt Lens quietly skips rendering.

## Commands & Settings

Type `/lens` to open the interactive settings menu, or configure directly:

| Command                     | Action                                                                |
| --------------------------- | --------------------------------------------------------------------- |
| `/lens`                     | Interactive TUI settings menu                                         |
| `/lens on`                  | Enable background prompt reviews                                      |
| `/lens off`                 | Disable background prompt reviews                                     |
| `/lens model`               | Interactive model picker for reviews                                  |
| `/lens model <provider/id>` | Set a dedicated model for reviews (e.g. `anthropic/claude-3-5-haiku`) |
| `/lens model default`       | Follow the active session model                                       |

Settings persist in `~/.pi/agent/prompt-lens.json`.

## Principles

1. **Independent Evaluation**: Reviews inspect only your prompt—never the assistant's output and never past conversation history.
2. **Never Waste Agent Time**: The review runs parallel to the agent and settles after the response is rendered.
3. **Keep Chat History Clean**: Review cards live strictly in the terminal UI and do not cost tokens in subsequent turns.

## Development

```sh
npm install
npm run check      # typecheck (tsc --noEmit)
npm test           # unit tests (vitest)
npm run lint       # oxlint
npm run fmt:check  # formatting check
```

## License

[MIT](LICENSE) © 2026 xtnntn
