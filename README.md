# Claude Orchestrator

Manage multiple Claude Code sessions from anywhere — terminal, Telegram, or phone calls.

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
