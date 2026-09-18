# pi-prompt-lens

<p align="center">
  <strong>在 AI 回答后，复盘你的提示词。</strong><br />
  一个 <a href="https://pi.dev">pi</a> 扩展：在后台分析你的 prompt，并在回答结束后安静展示建议组件——指出缺失上下文、模糊范围与改进建议，且绝不污染上下文。
</p>

<p align="center">
  <a href="package.json"><img src="https://img.shields.io/github/package-json/v/xtnntn/pi-prompt-lens?label=npm&logo=npm" alt="npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/xtnntn/pi-prompt-lens" alt="license" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · 简体中文
</p>

---

## 为什么需要 Pi Prompt Lens？

在向 AI 编程助手交代任务时，提示词中遗漏的关键范围、上下文或验收标准往往会导致多轮无效沟通。

**Pi Prompt Lens** 会在 agent 执行任务的同时在后台并行分析你的 prompt。当回答结束后，它会在编辑器上方以独立组件的形式列出 1 到 3 处影响执行的关键缺陷，并给出保留原意的改进写法。

- **绝不阻塞**：你的消息立即发送给 agent；复盘分析在后台并行完成。
- **绝不污染上下文**：复盘组件只存在于终端界面中，**绝不回传给模型**，不增加后续对话 token 成本。
- **没有无谓打扰**：如果你的 prompt 已经足够具体、清晰且有边界，将不会展示组件。
- **语言自适应**：分析与改写会自动采用你的 prompt 所用的主语言。

## 安装

```sh
pi install npm:pi-prompt-lens
```

或从 git 安装：

```sh
pi install git:github.com/xtnntn/pi-prompt-lens
```

本地开发或测试：

```sh
git clone https://github.com/xtnntn/pi-prompt-lens.git
ln -s "$(pwd)/pi-prompt-lens" ~/.pi/agent/extensions/pi-prompt-lens
```

## 使用效果

1. 像平时一样向 agent 发送一条需求：

   ```text
   帮我重构一下数据库查询
   ```

2. agent 照常开始工作。
3. 当回答完成后，编辑器上方会出现复盘组件：

   ```text
   🔎 Prompt Lens

   [SCOPE] 目标范围不明确
   - Issue: 未指明需要重构的具体查询函数、所在文件或涉及的数据表。
   - Suggestion: 指出目标文件名与函数名称。

   [VALIDATION] 缺少验收目标
   - Issue: agent 无法判断此次重构是为了性能优化、代码可读性还是类型补全。
   - Suggestion: 明确说明成功标准（例如降低延迟、添加索引或通过现有测试）。

   ---
   Suggested Rewrite:
   > 请重构 src/db/orders.ts 中的 getUserOrders 查询以优化查询延迟，添加必要索引提示，并确保现有测试通过。
   ```

4. 如果你的 prompt 已经写得很清晰，Prompt Lens 会安静跳过，不输出任何内容。

## 命令与设置

输入 `/lens` 打开交互式设置菜单，也可以通过命令快速切换：

| 命令                        | 说明                                                        |
| --------------------------- | ----------------------------------------------------------- |
| `/lens`                     | 打开交互式 TUI 设置菜单                                     |
| `/lens on`                  | 开启后台提示词复盘                                          |
| `/lens off`                 | 关闭后台提示词复盘                                          |
| `/lens model`               | 打开交互式模型选择菜单                                      |
| `/lens model <provider/id>` | 指定专用的轻量复盘模型（例如 `anthropic/claude-3-5-haiku`） |
| `/lens model default`       | 恢复跟随当前会话主模型                                      |

配置文件保存在 `~/.pi/agent/prompt-lens.json`。

## 设计原则

1. **独立评估**：只分析用户当前的 prompt，绝不读取主 AI 的回答，也不抓取过往会话历史。
2. **不浪费执行时间**：复盘与任务并行处理，仅在回答结束后落卡。
3. **保持上下文纯净**：组件只存在于终端界面中，后续提问时不会带入模型上下文。

## 本地开发

```sh
npm install
npm run check      # 类型检查 (tsc --noEmit)
npm test           # 单元测试 (vitest)
npm run lint       # oxlint
npm run fmt:check  # 格式检查
```

## 许可证

[MIT](LICENSE) © 2026 xtnntn
