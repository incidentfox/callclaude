# CallClaude

This repo lets you manage multiple Claude Code sessions from Telegram and phone calls.

## What This Does

- **`claude-sessions` CLI**: List, resume, start, send messages to, read from, and kill Claude Code sessions
- **Bridge server**: HTTP server that connects voice agents (Retell AI) and other services to `claude-sessions`
- **Telegram integration**: Uses Claude Code's built-in Telegram plugin for chat-based control
- **Voice agent**: Phone number you can call to control your sessions by voice (via Retell AI)

## Setup Instructions (for Claude Code)

When a user asks you to set this up, follow these steps in order:

### 1. Install Dependencies

```bash
# Install claude-sessions CLI
cp bin/claude-sessions ~/.local/bin/claude-sessions
chmod +x ~/.local/bin/claude-sessions

# Install bridge server dependencies
cd bridge && npm install && cd ..
```

### 2. Create `.env` File

Copy `.env.example` to `.env` and fill in all values. Ask the user for any you don't have.

Required:
- `RETELL_API_KEY` — From https://app.retell.ai/settings (API Keys section)

Optional (voice agent):
- `RETELL_AGENT_ID` — Created automatically by setup script, or manually at https://app.retell.ai
- `RETELL_PHONE_NUMBER` — Purchased through Retell dashboard

Optional (Vapi alternative):
- `VAPI_PRIVATE_KEY` — From https://dashboard.vapi.ai

### 3. Configure Telegram Plugin

The user needs to enable the Telegram plugin in Claude Code:

```bash
# This should already be in ~/.claude/settings.json
# If not, the user needs to run Claude Code with:
claude --channels plugin:telegram@claude-plugins-official
```

Then pair their Telegram account by messaging the bot.

### 4. Set Up Voice Agent (Retell AI)

Run the setup script:
```bash
node scripts/setup-retell.js
```

This will:
1. Create a Retell AI agent with the correct system prompt and tools
2. Purchase a phone number (requires billing set up in Retell dashboard)
3. Save the agent ID and phone number to `.env`

### 5. Start the Bridge Server

```bash
# Start ngrok tunnel (in a separate terminal/tmux pane)
ngrok http 3456

# Start the bridge server
node bridge/server.js
```

### 6. Update Retell Webhook URL

After ngrok starts, update the Retell agent's webhook URL:
```bash
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import json,sys; print(json.load(sys.stdin)['tunnels'][0]['public_url'])")
node scripts/update-retell-url.js "$NGROK_URL"
```

## Architecture

```
Phone Call → Retell AI → ngrok → bridge/server.js → claude-sessions CLI → Claude Code sessions
Telegram   → Claude Code Telegram Plugin → This session (orchestrator)
```

## Platform Requirements

- **macOS only** — Uses AppleScript for cross-session message injection (Terminal.app + Accessibility permissions required)
- **tmux** — For running sessions in background
- **Claude Code CLI** — `claude` must be in PATH
- **ngrok** — For exposing local bridge server (or use Cloudflare Tunnel)

## Default Session Flags

All sessions started by `claude-sessions` include:
- `--dangerously-skip-permissions` — No permission prompts
- `--chrome` — Chrome browser tools
- `--channels plugin:telegram@claude-plugins-official` — Telegram access

Edit `DEFAULT_FLAGS` in `bin/claude-sessions` to customize.

## Common Issues

- **"not allowed to send keystrokes"** — Grant Terminal.app Accessibility permissions: System Preferences > Privacy & Security > Accessibility
- **Telegram not responding** — Check for duplicate bun processes: `ps aux | grep telegram | grep bun`. Kill extras.
- **Voice agent tools failing** — Check ngrok is running and URLs match. Run `scripts/update-retell-url.js`.
- **Session stuck on trust prompt** — Use `-p` flag for non-interactive sessions, or pre-trust the workspace.
