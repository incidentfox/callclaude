#!/usr/bin/env node
/**
 * Sets up a Retell AI voice agent with tools for controlling Claude Code sessions.
 *
 * Prerequisites:
 *   1. Sign up at https://app.retell.ai
 *   2. Add billing (Settings > Billing)
 *   3. Get your API key (Settings > API Keys)
 *   4. Set RETELL_API_KEY in .env
 *
 * This script will:
 *   - Create an LLM with system prompt and tools
 *   - Create an agent linked to that LLM
 *   - Optionally purchase a phone number
 *   - Save IDs back to .env
 *
 * Usage: node scripts/setup-retell.js [--ngrok-url URL]
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Load .env
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (val && !process.env[key]) process.env[key] = val;
    }
  }
}

const API_KEY = process.env.RETELL_API_KEY;
if (!API_KEY) {
  console.error("RETELL_API_KEY not set. Add it to .env first.");
  console.error("Get your key at: https://app.retell.ai/settings");
  process.exit(1);
}

// Parse --ngrok-url from args
let ngrokUrl = process.argv.find((a) => a.startsWith("--ngrok-url="))?.split("=")[1];
if (!ngrokUrl) {
  const idx = process.argv.indexOf("--ngrok-url");
  if (idx >= 0 && process.argv[idx + 1]) ngrokUrl = process.argv[idx + 1];
}

// Try to auto-detect from running ngrok
if (!ngrokUrl) {
  try {
    const { execSync } = require("child_process");
    const tunnels = JSON.parse(
      execSync("curl -s http://localhost:4040/api/tunnels", { encoding: "utf-8" })
    );
    ngrokUrl = tunnels.tunnels[0]?.public_url;
    if (ngrokUrl) console.log(`Auto-detected ngrok URL: ${ngrokUrl}`);
  } catch {}
}

if (!ngrokUrl) {
  console.error("Could not detect ngrok URL. Pass --ngrok-url or start ngrok first.");
  process.exit(1);
}

// Ensure API_SECRET exists — generate one if not
let apiSecret = process.env.API_SECRET;
if (!apiSecret) {
  apiSecret = require("crypto").randomBytes(32).toString("hex");
  console.log(`Generated API_SECRET: ${apiSecret.slice(0, 8)}...`);
}

const WEBHOOK_URL = `${ngrokUrl}/retell/tool`;
const EVENTS_WEBHOOK = `${ngrokUrl}/retell/webhook`;

function retellAPI(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "api.retellai.com",
      path: endpoint,
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);

    const req = https.request(opts, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(`${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`${res.statusCode}: ${body}`));
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const TOOLS = [
  {
    type: "custom",
    name: "list_sessions",
    description: "List all Claude Code sessions (active and dead). Returns session IDs, projects, status, and topics.",
    url: WEBHOOK_URL + `?secret=${apiSecret}`,
    speak_during_execution: true,
    speak_after_execution: true,
    parameters: {
      type: "object",
      properties: {
        active_only: {
          type: "boolean",
          description: "If true, only show active (alive) sessions",
        },
      },
    },
  },
  {
    type: "custom",
    name: "send_message",
    description: "Send a message to an active Claude Code session. Can optionally wait for the response.",
    url: WEBHOOK_URL + `?secret=${apiSecret}`,
    speak_during_execution: true,
    speak_after_execution: true,
    execution_message_description: "Sending message to session...",
    parameters: {
      type: "object",
      properties: {
        session: {
          type: "string",
          description: "Session ID (partial OK) or project name to match",
        },
        message: {
          type: "string",
          description: "The message to send to the session",
        },
        wait_for_response: {
          type: "boolean",
          description: "If true, wait for the session's response before returning",
        },
        timeout: {
          type: "number",
          description: "Max seconds to wait for response (default 60)",
        },
      },
      required: ["session", "message"],
    },
  },
  {
    type: "custom",
    name: "read_session",
    description: "Read recent messages from a Claude Code session's conversation history.",
    url: WEBHOOK_URL + `?secret=${apiSecret}`,
    speak_during_execution: true,
    speak_after_execution: true,
    parameters: {
      type: "object",
      properties: {
        session: {
          type: "string",
          description: "Session ID (partial OK) or project name",
        },
        num_messages: {
          type: "number",
          description: "Number of recent messages to read (default 5)",
        },
      },
      required: ["session"],
    },
  },
  {
    type: "custom",
    name: "start_session",
    description: "Start a new Claude Code session in the background.",
    url: WEBHOOK_URL + `?secret=${apiSecret}`,
    speak_during_execution: true,
    speak_after_execution: true,
    execution_message_description: "Starting new session...",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the session (used as tmux window name)",
        },
        directory: {
          type: "string",
          description: "Working directory for the session",
        },
        prompt: {
          type: "string",
          description: "Initial prompt to send (runs non-interactively with -p)",
        },
      },
      required: ["name", "directory"],
    },
  },
  {
    type: "custom",
    name: "get_result",
    description: "Get the output from a session that was started with a prompt (-p flag).",
    url: WEBHOOK_URL + `?secret=${apiSecret}`,
    speak_during_execution: true,
    speak_after_execution: true,
    parameters: {
      type: "object",
      properties: {
        session: {
          type: "string",
          description: "Session name (as passed to start_session)",
        },
      },
      required: ["session"],
    },
  },
  {
    type: "custom",
    name: "kill_session",
    description: "Kill an active Claude Code session.",
    url: WEBHOOK_URL + `?secret=${apiSecret}`,
    speak_during_execution: true,
    speak_after_execution: true,
    parameters: {
      type: "object",
      properties: {
        session: {
          type: "string",
          description: "Session ID or project name",
        },
      },
      required: ["session"],
    },
  },
];

const SYSTEM_PROMPT = `You are a voice AI assistant that controls Claude Code sessions on the user's Mac.

RULES:
- Max 2 sentences per response. Talk like a human, not a robot.
- NEVER explain what tools do or narrate your actions. Just do it and report results.
- NEVER ask "are you still there" or "is there anything else."
- NEVER guess or make up information. If unsure, say "let me check" and use a tool.
- When reading session output, summarize briefly — don't read raw terminal output.
- Be direct. "3 sessions running, the main one is the busiest" not "I can see that you currently have..."

ARCHITECTURE:
There is a main orchestrator session (runs from ~) that has Telegram access and coordinates all other sessions. You are the voice interface to the same system. When the user asks you to do something, you're calling tools that interact with the same sessions the orchestrator manages. The orchestrator can also relay messages to the user via Telegram.

TOOLS:
- list_sessions: See what's running
- send_message: Talk to a session. IMPORTANT: when you want a response back, ALWAYS set wait_for_response=true. This waits for the session to reply and returns the answer. Without it you just send and get nothing back.
- read_session: See recent conversation from a session (use this to check what a session has been doing, NOT to get a response to something you just sent — use wait_for_response for that)
- start_session: Spin up a new session
- get_result: Check output from a background task started with a prompt
- kill_session: Stop a session`;

async function main() {
  console.log("Setting up Retell AI voice agent...\n");

  // Step 1: Create LLM
  console.log("1. Creating LLM configuration...");
  const llm = await retellAPI("POST", "/create-retell-llm", {
    model: "claude-sonnet-4-20250514",
    model_temperature: 0.3,
    general_prompt: SYSTEM_PROMPT,
    general_tools: TOOLS,
    begin_message: "Hey. What do you need?",
  });
  console.log(`   LLM created: ${llm.llm_id}`);

  // Step 2: Create Agent
  console.log("2. Creating voice agent...");
  const agent = await retellAPI("POST", "/create-agent", {
    agent_name: "CallClaude",
    response_engine: { type: "retell-llm", llm_id: llm.llm_id },
    voice_id: "11labs-Lily",
    language: "en-US",
    webhook_url: EVENTS_WEBHOOK,
    post_call_analysis_data: [
      { name: "call_summary", type: "string", description: "Brief summary of what was discussed and any actions taken" },
    ],
  });
  console.log(`   Agent created: ${agent.agent_id}`);

  // Step 3: Try to purchase a phone number
  console.log("3. Attempting to purchase phone number...");
  let phoneNumber = null;
  try {
    const phone = await retellAPI("POST", "/create-phone-number", {
      agent_id: agent.agent_id,
      area_code: 628, // SF area code, change as desired
    });
    phoneNumber = phone.phone_number;
    console.log(`   Phone number: ${phoneNumber}`);
  } catch (err) {
    console.log(`   Could not auto-purchase number: ${err.message}`);
    console.log("   Purchase manually at https://app.retell.ai and assign to this agent.");
  }

  // Step 4: Update .env
  console.log("\n4. Updating .env...");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  function setEnvVar(content, key, value) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    }
    return content + `\n${key}=${value}`;
  }

  envContent = setEnvVar(envContent, "API_SECRET", apiSecret);
  envContent = setEnvVar(envContent, "RETELL_AGENT_ID", agent.agent_id);
  envContent = setEnvVar(envContent, "RETELL_LLM_ID", llm.llm_id);
  if (phoneNumber) {
    envContent = setEnvVar(envContent, "RETELL_PHONE_NUMBER", phoneNumber);
  }

  fs.writeFileSync(envPath, envContent);
  console.log("   .env updated with agent and LLM IDs.");

  console.log("\n--- Setup Complete ---");
  console.log(`Agent ID:     ${agent.agent_id}`);
  console.log(`LLM ID:       ${llm.llm_id}`);
  if (phoneNumber) {
    console.log(`Phone Number: ${phoneNumber}`);
  }
  console.log(`\nTool webhook: ${WEBHOOK_URL}`);
  console.log(`Events webhook: ${EVENTS_WEBHOOK}`);
  console.log("\nMake sure ngrok and the bridge server are running!");
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
