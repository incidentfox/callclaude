# Claude Orchestrator

**Call your AI agents from your car. Manage 10 Claude Code sessions from your phone. Let them work while you sleep.**

I run 6+ Claude Code sessions simultaneously — one automating medical billing, one scraping job listings, one refactoring a codebase, others just doing random research. I was drowning in terminal tabs, losing track of what's running, and the moment I closed my laptop everything went dark.

So I built this in a single Claude Code session. Now I call a phone number from my car and say "what are the active sessions?" and it tells me. I say "tell the forta session to start working on the PA automation" and it sends that message to the right terminal. I check Telegram while walking and get status updates. My sessions run 12+ hours overnight while I sleep.

**This whole thing was built by Claude Code, for Claude Code.** The setup is literally: fire up Claude Code, paste one prompt, and it installs itself.

## Listen to a real call (2 min)

[**demo-call.mp3**](https://github.com/incidentfox/claude-orchestrator/raw/main/demo-call.mp3) — me calling the voice agent while driving, checking on 6 running sessions and delegating a task:

> **Agent:** Hey. What's up?
>
> **Me:** What are the active sessions?
>
> **Agent:** One sec! Looks like you've got 6 active sessions running — forta, evolve, job search, and a couple others at the home directory.
>
> **Me:** Can you check what files are in my downloads folder?
>
> **Agent:** I can send that command to one of your sessions — one sec!
>
> **Me:** Actually, you should spin up a fresh session for that. And be patient — it sometimes takes time to execute.
>
> **Agent:** Got it — I'll spin up a fresh session and give it time to run before checking the output.

The voice agent calls `list_sessions`, `send_message`, and `start_session` behind the scenes. You just talk.

## How it works

```
Phone Call  →  Retell AI  →  ngrok  →  Bridge Server  →  claude-sessions CLI  →  Claude Code
Telegram    →  Claude Code Plugin   →  Orchestrator Session
Terminal    →  claude-sessions CLI  →  Any session
```

The secret sauce: sessions talk to each other via [AppleScript keystroke injection](bin/claude-sessions) — we find the Terminal.app tab by tty device path, bring it to front, type into it via System Events, and watch the JSONL conversation file with macOS kqueue for instant response detection. It's a hack. It's cursed. It works flawlessly.

## Install (one prompt)

Fire up [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and paste:

```
Clone https://github.com/incidentfox/claude-orchestrator.git into ~/development/, read the CLAUDE.md, run setup.sh, then walk me through the full setup including getting a Retell AI API key and creating the voice agent. I want to manage Claude Code sessions from my phone and Telegram by the end of this.
```

Claude Code clones the repo, installs the CLI, sets up the bridge server, creates your Retell AI voice agent, buys you a phone number, and wires everything together. You just follow along.

### Manual setup

```bash
git clone https://github.com/incidentfox/claude-orchestrator.git
cd claude-orchestrator
bash setup.sh

# Edit .env with your Retell API key, then:
ngrok http 3456                    # Terminal 1
node bridge/server.js              # Terminal 2
node scripts/setup-retell.js       # Creates voice agent + buys phone number
```

## What you can do

### From your phone (voice)
```
"What sessions are running?"
"Tell the forta session to check the build status"
"Read me what the refactor session has been doing"
"Start a new session in ~/projects/myapp"
"Kill the test session, it's done"
```

### From Telegram
Message your bot for quick check-ins, send commands, get status updates — all from your pocket.

### From the terminal
```bash
claude-sessions list                              # See everything
claude-sessions list -a                           # Active only
claude-sessions send forta "check build status"   # Inject a message
claude-sessions send forta "status?" -w           # Send + wait for response
claude-sessions read forta -n 20                  # Read last 20 messages
claude-sessions start myproject ~/code/app -b     # New background session
claude-sessions kill forta                        # Stop a session
claude-sessions resume forta                      # Bring back a dead session
```

## Why I built this

I have a problem. I spin up Claude Code sessions in random terminals all day and within an hour I've lost track of what's running where. The context switching is brutal. I tried Conductor, Agent Deck, Orca — their UIs confused me more than the terminals did. Half the time I don't even have a repo, I just fire up Claude Code in `~` and start asking it things.

What I wanted was simple: all my Claude Code sessions aware of each other, a way to check on them from anywhere, and the ability to keep long-running agents working while I'm away from my desk. The dream is an always-on orchestrator that spawns subagents, keeps them on task for hours, and reports back. Haven't fully cracked that yet — but this is the infrastructure.

The voice part came from driving. Stuck in Bay Area traffic on FSD, bored out of my mind, wanting to talk to my agents. Every other voice AI I tried hallucinates constantly. This one calls real tools connected to real sessions running real code on my machine.

## Requirements

- **macOS** (AppleScript keystroke injection is mac-only for now)
- **tmux** (background sessions)
- **ngrok** (tunnel to your machine)
- **Node.js 18+**
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)

## Architecture

`claude-sessions` reads Claude Code's internal files:
- `~/.claude/sessions/*.json` — PID files (which sessions are alive)
- `~/.claude/projects/*/SESSION_ID.jsonl` — Full conversation history

Cross-session messaging: AppleScript finds the Terminal.app tab matching a tty device path, sends keystrokes via System Events, then watches the JSONL file with kqueue for the response. Zero polling, instant notification.

The bridge server translates HTTP requests from Retell AI (or Vapi) into `claude-sessions` CLI calls. Your voice → Retell STT → Claude Sonnet → tool call → bridge → CLI → Terminal.app → Claude Code session → response bubbles back up.

## File structure

```
claude-orchestrator/
├── CLAUDE.md                 # Instructions for Claude Code to self-setup
├── setup.sh                  # One-shot installer
├── .env.example              # Config template
├── demo-call.mp3             # Real voice call recording
├── bin/
│   └── claude-sessions       # Session management CLI (Python, 660 lines)
├── bridge/
│   ├── package.json
│   └── server.js             # HTTP bridge (Express, handles Retell + Vapi)
└── scripts/
    ├── setup-retell.js       # Auto-create Retell voice agent + phone number
    └── update-retell-url.js  # Fix webhook URLs after ngrok restart
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "not allowed to send keystrokes" | System Preferences > Privacy > Accessibility > add Terminal.app |
| Voice agent tools fail | Check ngrok is running, run `node scripts/update-retell-url.js` |
| Telegram not responding | Kill duplicate bun processes: `ps aux \| grep telegram \| grep bun` |
| Sessions stuck on trust prompt | Use `-p` flag or pre-trust the workspace |

## License

MIT
