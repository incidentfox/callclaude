# CallClaude

**Talk to your local Claude Code sessions from your phone. No cloud. No UI. Just a phone call.**

## The problem

You're running 5+ Claude Code sessions on your laptop. You close the lid and have no idea what's happening. You open it back up and can't remember which terminal is doing what. You want to check on them from your car but there's no way to reach your local machine from your phone.

We solved it with a phone number. Call it, say "what's running," get an answer. Say "tell the main session to check the build" and it types that into the right terminal on your Mac. No cloud-hosted agents, no fancy UI, no app store review process — just a phone call that reaches your local Claude Code sessions through an ngrok tunnel.

Why a phone call? Because I drive a Tesla and I didn't want to deal with getting an app approved for the Tesla browser. You know what works in every car? The phone.

## What it sounds like

> **Agent:** Hey. What's up?
>
> **You:** What sessions are running?
>
> **Agent:** One sec! You've got 6 active sessions — a couple on projects, a few at the home directory.
>
> **You:** Tell the main session to check the build status.
>
> **Agent:** Got it, sending that over now. Give it a moment and I'll check back for results.

## Install

Fire up [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and paste:

```
Clone https://github.com/incidentfox/callclaude.git into ~/development/, read the CLAUDE.md, run setup.sh, then walk me through the full setup. I want to manage my Claude Code sessions from my phone by the end of this.
```

That's it. Claude Code sets itself up.

## What's in the box

**`claude-sessions` CLI** — list, send messages to, read from, start, kill, and resume Claude Code sessions. Cross-session messaging works via an [AppleScript keystroke injection hack](bin/claude-sessions) that finds Terminal.app tabs by tty path. Cursed. Works.

```bash
claude-sessions list -a                           # What's running?
claude-sessions send myapp "check build status"   # Talk to a session
claude-sessions send myapp "status?" -w           # Send + wait for response
claude-sessions read myapp -n 20                  # Read last 20 messages
claude-sessions start myproject ~/code/app -b     # New background session
```

**Bridge server** — HTTP server that translates voice agent tool calls into `claude-sessions` commands. Retell AI and Vapi supported.

**Voice agent** — A phone number (via Retell AI) that connects to the bridge server through ngrok. Call it, talk to your sessions.

**Telegram** — Uses Claude Code's built-in Telegram plugin for text-based control.

## Requirements

macOS, tmux, ngrok, Node.js 18+, Claude Code CLI.

## How it works

```
Your phone → Retell AI → ngrok → bridge server → claude-sessions CLI → Terminal.app → Claude Code
```

The CLI reads `~/.claude/sessions/*.json` (PIDs) and `~/.claude/projects/*/*.jsonl` (conversation history). Messages are injected via AppleScript keystrokes and responses are detected via macOS kqueue file watching. Zero polling.

## License

MIT
