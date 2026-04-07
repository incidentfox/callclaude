# CallClaude

**[:gb: English](#install)** | **[:cn: 简体中文](#chinese)**

> Call your local Claude Code sessions. Literally, from a phone call.

![Claude Code](https://img.shields.io/badge/Claude_Code-000?style=flat&logo=anthropic&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Retell AI](https://img.shields.io/badge/Retell_AI-FF6B35?style=flat&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

## Install

Fire up [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and paste:

```
Clone https://github.com/incidentfox/callclaude.git into ~/development/, read the CLAUDE.md, run setup.sh, then walk me through the full setup. I want to manage my Claude Code sessions from my phone by the end of this.
```

Requires macOS, [tmux](https://github.com/tmux/tmux), [ngrok](https://ngrok.com/), Node.js 18+, [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code).

## Demo (real call, ~1 min)

I called the agent over the phone and recorded my Claude Code terminal in the meantime. It relayed commands to the terminal and understood the outputs.

https://github.com/user-attachments/assets/9514e65d-3f81-4f93-9f16-83522bbbf8e3

## Why

I run a bunch of Claude Code sessions on my laptop and lose track of which terminal is doing what. I wanted to check on them from my car — but I drive a Tesla and didn't want to deal with getting an app on the Tesla browser. A phone call bypasses all of that.

This whole thing was built in a single Claude Code session. The voice agent, the bridge server, the CLI, the cross-session messaging — all of it. Claude Code set itself up.

## What you can do

| Command | What it does |
|---------|-------------|
| "What sessions are running?" | Lists all active Claude Code sessions |
| "What's the main session working on?" | Reads recent conversation from a session |
| "Tell the forta session to check the build" | Injects a message into any running session |
| "Start a new session in ~/projects/myapp" | Spins up a new background session |
| "Kill the test session" | Stops a session |

Or use the CLI directly:

```bash
claude-sessions list -a                          # See all active sessions
claude-sessions send myapp "check build" -w      # Send message + wait for response
claude-sessions read myapp -n 20                 # Read last 20 messages
claude-sessions fork myapp -b                    # Fork a session with full context
claude-sessions start demo ~/code -b -p "run tests"  # New session with prompt
```

## How it works

```
Your phone → Retell AI (STT + LLM) → ngrok → bridge server → claude-sessions → Terminal.app → Claude Code
```

You get a phone number via [Retell AI](https://www.retellai.com/) (also works with [Vapi](https://vapi.ai/)). When you call it, Retell does speech-to-text, sends the text to [Claude Sonnet](https://docs.anthropic.com/en/docs/about-claude/models) which decides what tool to call, and hits your bridge server through an [ngrok](https://ngrok.com/) tunnel. The bridge server runs on your Mac and translates tool calls into `claude-sessions` CLI commands — which find the right Terminal.app tab by tty device path, inject keystrokes via AppleScript, and watch the JSONL conversation file with macOS kqueue for the response.

Everything runs locally. Retell only sees tool call names and results.

## Features

- **Voice control** — call a phone number, talk to your sessions hands-free
- **Cross-session messaging** — sessions can talk to each other via AppleScript keystroke injection
- **Session management** — list, start, kill, resume, fork, archive sessions
- **Orchestrator pattern** — one session acts as the hub with Telegram + voice access
- **Telegram integration** — check on sessions from your phone via text
- **Auto-recording** — every call is recorded and transcribed with timestamps
- **Phone allowlist** — only your number can control your machine
- **API secret** — bridge server rejects unauthenticated requests

## Security

- **API secret** — the bridge server rejects all requests without a secret token. Without it, discovering your ngrok URL does nothing.
- **Phone allowlist** — set `ALLOWED_PHONE_NUMBERS` in `.env`. Only your number gets through.
- **`--dangerously-skip-permissions`** — sessions run with permissions disabled so the voice agent can execute without prompts. The phone allowlist is your access control.
- **ngrok** — kill ngrok and nothing is reachable.

## Project structure

```
callclaude/
├── CLAUDE.md                 # Setup instructions for Claude Code
├── setup.sh                  # One-shot installer
├── .env.example              # Config template
├── bin/
│   └── claude-sessions       # Session management CLI (Python)
├── bridge/
│   └── server.js             # HTTP bridge (Express, Retell + Vapi)
└── scripts/
    ├── setup-retell.js       # Create voice agent + phone number
    └── update-retell-url.js  # Fix webhook URLs after ngrok restart
```

## License

MIT — built by [@incidentfox](https://github.com/incidentfox)

---

<h1 id="chinese">:cn: 简体中文</h1>

## 这是啥

打电话遥控你本地的 Claude Code。对，真的打电话。

Mac上同时开五六个 Claude Code 终端，搞着搞着就不知道哪个在干嘛了。笔记本一合直接全部失联。所以搞了个电话号码，打过去就能语音操控所有 session。

为啥是电话？因为我开特斯拉，懒得折腾车载浏览器。电话在哪都能打，不香吗。

整个项目是在一个 Claude Code session 里从零搭出来的。AI自己造了个遥控自己的工具。

## 安装

打开 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)，粘贴这段：

```
Clone https://github.com/incidentfox/callclaude.git into ~/development/, read the CLAUDE.md, run setup.sh, then walk me through the full setup. I want to manage my Claude Code sessions from my phone by the end of this.
```

需要：macOS、[tmux](https://github.com/tmux/tmux)、[ngrok](https://ngrok.com/)、Node.js 18+、[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

## 咋实现的

```
你的手机 → Retell AI (语音识别 + Claude Sonnet) → ngrok → 本地桥接服务器 → claude-sessions CLI → Terminal.app → Claude Code
```

Retell AI 把你说的话转成文字，Claude Sonnet 当大脑决定调哪个工具，通过 ngrok 隧道回到你 Mac 上的桥接服务器。服务器把工具调用转成 CLI 命令——用 AppleScript 找到对应终端标签页往里打字，用 kqueue 零轮询监听响应。

全程本地跑。Retell 只看得到工具名称和结果，看不到你的代码。

## 功能

- **语音操控** — 打电话就能管session，堵车也能让AI干活
- **跨session通信** — session之间通过 AppleScript 按键注入互发消息
- **session管理** — 列出、启动、终止、恢复、分叉、归档
- **编排器模式** — 一个主session当枢纽，连Telegram和语音
- **电话白名单** — 只有你的号码能控制你的电脑
- **自动录音** — 每通电话自动录音+带时间戳转写

## 许可证

MIT
