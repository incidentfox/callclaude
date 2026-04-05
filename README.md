# Claude Orchestrator

Control your Claude Code sessions from your phone.

## Why

I built this because I have a problem: I spin up Claude Code sessions in random terminals all day — one on a refactor, one researching something, one just answering a question I had — and within an hour I've lost track of what's running where. The context switching is brutal. I tried Conductor, Agent Deck, Orca, but their UIs confused me more than the terminals did. Half the time I don't even have a repo, I just fire up Claude Code in `~` and start asking it things.

What I actually wanted was simple: all my Claude Code sessions talking to each other, a way to check on them without being at my laptop, and the ability to keep long-running agents working while I'm away. The dream is an always-on orchestrator that spawns subagents, keeps them on task for hours, and reports back — haven't fully cracked that yet, but this is the infrastructure for it.

The voice agent part came from driving. I'm stuck in traffic on FSD, bored, and I want to talk to my Claude Code sessions — check if they're still working, give them new instructions, explore ideas. Every other voice AI I tried (looking at you, Grok) hallucinates constantly. This one calls real tools and talks to real sessions.

The whole thing is held together by an [AppleScript keystroke injection hack](bin/claude-sessions) that sends messages to Terminal.app tabs by matching tty device paths. It's cursed and it works.

```
Phone Call → Retell AI → ngrok → Bridge Server → claude-sessions → Claude Code
Telegram   → Claude Code Plugin → Orchestrator Session
Terminal   → claude-sessions CLI → Claude Code
```

## Install

Fire up [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and paste this:

```
Clone https://github.com/incidentfox/claude-orchestrator.git into ~/development/, read the CLAUDE.md, run setup.sh, then walk me through the full setup including getting a Retell AI API key and creating the voice agent. I want to manage Claude Code sessions from my phone and Telegram by the end of this.
```

That's it. Claude Code will clone the repo, install everything, and walk you through the rest.

### Manual Setup

```bash
git clone https://github.com/incidentfox/claude-orchestrator.git
cd claude-orchestrator
bash setup.sh

# Edit .env with your API keys, then:
ngrok http 3456                    # Terminal 1
node bridge/server.js              # Terminal 2
node scripts/setup-retell.js       # One-time: creates voice agent + phone number
```

## What This Looks Like

Here's a real phone call transcript — calling the voice agent to check on running Claude Code sessions and delegate a task:

> **Agent:** Hey. What's up?
>
> **You:** What are the active sessions?
>
> **Agent:** One sec!
>
> **Agent:** Looks like you've got 6 active sessions running — forta, evolve, job search, and a couple others at the home directory.
>
> **You:** Can you check what files are in my downloads folder?
>
> **Agent:** I can send that command to one of your sessions — one sec!
>
> **You:** Actually, you should spin up a fresh session for that. And be patient — it sometimes takes time to execute. It might not be immediately available.
>
> **Agent:** Got it, that makes total sense — I'll spin up a fresh session and give it time to run before checking the output.
>
> **You:** Yeah. So go ahead, check what files are in my downloads folder.
>
> **Agent:** One sec, let me start a fresh session for that! Alright, I sent it over — give it a moment to run and I'll check back for the results.

The voice agent calls `list_sessions`, `send_message`, and `start_session` tools behind the scenes — you just talk naturally.

## What You Get

### `claude-sessions` CLI
```bash
claude-sessions list              # See all sessions
claude-sessions list -a           # Active only
claude-sessions send forta "check the build status"  # Inject message
claude-sessions send forta "status?" -w              # Send + wait for response
claude-sessions read forta -n 20  # Read last 20 messages
claude-sessions start myproject ~/code/project -b    # New background session
claude-sessions kill forta        # Stop a session
claude-sessions resume forta      # Bring back a dead session
```

### Voice Agent (Phone)
Call your Retell AI number to:
- List what sessions are running
- Send messages to any session
- Read back what a session has been doing
- Start new sessions
- Kill sessions

### Telegram
Run Claude Code with `--channels plugin:telegram@claude-plugins-official` to get Telegram access. Message your bot to control sessions.

## Requirements

- **macOS** (uses AppleScript for cross-session messaging)
- **tmux** (background sessions)
- **ngrok** (expose bridge server)
- **Node.js 18+**
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)

## Architecture

`claude-sessions` reads Claude Code's internal files:
- `~/.claude/sessions/*.json` — PID files for active sessions
- `~/.claude/projects/*/SESSION_ID.jsonl` — Full conversation history

Cross-session messaging works via AppleScript keystroke injection into Terminal.app tabs (requires Accessibility permissions). Response detection uses macOS kqueue for instant file-change notification.

The bridge server translates HTTP requests from voice platforms (Retell AI, Vapi) into `claude-sessions` CLI calls.

## File Structure

```
claude-orchestrator/
├── CLAUDE.md              # Instructions for Claude Code to self-setup
├── setup.sh               # Automated setup script
├── .env.example           # Configuration template
├── bin/
│   └── claude-sessions    # Session management CLI (Python)
├── bridge/
│   ├── package.json
│   └── server.js          # HTTP bridge server (Node.js)
└── scripts/
    ├── setup-retell.js    # Create Retell AI voice agent
    └── update-retell-url.js  # Update webhook URLs after ngrok restart
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "not allowed to send keystrokes" | System Preferences > Privacy > Accessibility > add Terminal.app |
| Voice agent tools fail | Check ngrok is running, run `node scripts/update-retell-url.js` |
| Telegram not responding | Check for duplicate bun processes: `ps aux \| grep telegram \| grep bun` |
| Sessions stuck on trust prompt | Use `-p` flag or pre-trust the workspace in Claude Code |
| ANSI codes in output | Bridge server strips them automatically; ensure `NO_COLOR=1` is set |
