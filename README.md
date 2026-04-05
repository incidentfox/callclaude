# CallClaude

Call your local Claude Code sessions. Literally, from a phone call.

## Why

I run a bunch of Claude Code sessions on my laptop and lose track of which terminal is doing what. I wanted to check on them from my car — but I drive a Tesla and didn't want to deal with getting an app on the Tesla browser. A phone call bypasses all of that.

## How it works

You get a phone number via Retell AI. When you call it, Retell does speech-to-text, sends the text to Claude Sonnet which decides what tool to call, and hits your bridge server through an ngrok tunnel. The bridge server runs on your Mac and translates tool calls into `claude-sessions` CLI commands — which find the right Terminal.app tab by tty device path, inject keystrokes via AppleScript, and watch the JSONL conversation file with kqueue for the response. Everything runs locally. Retell only sees tool call names and results.

```
Your phone → Retell AI (STT + LLM) → ngrok → bridge server → claude-sessions → Terminal.app → Claude Code
```

## Security

- **API secret** — the bridge server rejects all requests without a secret token (generated during setup, passed as query param on Retell tool URLs). Without it, discovering your ngrok URL does nothing.
- **Phone allowlist** — set `ALLOWED_PHONE_NUMBERS` in `.env` to restrict who can call your agent. Only your number gets through.
- **`--dangerously-skip-permissions`** — sessions started by this tool run with permissions disabled so the voice agent can actually do things without getting stuck on confirmation prompts. This is a tradeoff: the voice agent (and anyone who can call your number) can run arbitrary commands. The phone allowlist is your access control.
- **ngrok** — the tunnel is the only thing exposed to the internet. Kill ngrok and nothing is reachable.

## Install

Fire up [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and paste:

```
Clone https://github.com/incidentfox/callclaude.git into ~/development/, read the CLAUDE.md, run setup.sh, then walk me through the full setup. I want to manage my Claude Code sessions from my phone by the end of this.
```

Requires macOS, tmux, ngrok, Node.js 18+, Claude Code CLI.

## License

MIT
