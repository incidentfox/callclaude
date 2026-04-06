const express = require("express");
const { execSync, exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "10mb" }));

// Load .env if present (simple key=value parsing, no dotenv dependency)
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

const HOME = process.env.HOME || require("os").homedir();
const TRANSCRIPTS_DIR = path.join(HOME, ".claude/voice-transcripts");
fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });

const PORT = process.env.PORT || 3456;
const CLAUDE_SESSIONS = process.env.CLAUDE_SESSIONS_PATH || "claude-sessions";
const API_SECRET = process.env.API_SECRET;
const ALLOWED_PHONE_NUMBERS = (process.env.ALLOWED_PHONE_NUMBERS || "")
  .split(",")
  .map((n) => n.trim())
  .filter(Boolean);

if (!API_SECRET) {
  console.error("FATAL: API_SECRET not set in .env — refusing to start without auth.");
  console.error("Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  process.exit(1);
}

// Auth middleware — every request must include the API secret
function requireAuth(req, res, next) {
  const token =
    req.headers["x-api-secret"] ||
    req.headers["authorization"]?.replace("Bearer ", "") ||
    req.query?.secret;

  if (token !== API_SECRET) {
    console.log(`[auth] Rejected request from ${req.ip} to ${req.path}`);
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.use("/retell", requireAuth);
app.use("/vapi", requireAuth);

// Strip ANSI codes and control characters that break JSON
function clean(str) {
  return str
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, "");
}

// Run claude-sessions command and return stdout
function runSessions(args, timeout = 30000) {
  try {
    const result = execSync(`${CLAUDE_SESSIONS} ${args}`, {
      timeout,
      encoding: "utf-8",
      env: {
        ...process.env,
        PATH: process.env.PATH + `:${HOME}/.local/bin`,
        NO_COLOR: "1",
      },
    });
    return clean(result.trim());
  } catch (err) {
    return clean(`Error: ${err.stderr || err.message}`);
  }
}

// Run claude-sessions send with --wait asynchronously
function runSendWait(session, message, timeout = 120) {
  return new Promise((resolve) => {
    const escaped = message.replace(/"/g, '\\"');
    const cmd = `${CLAUDE_SESSIONS} send "${session}" -w -t ${timeout} "${escaped}"`;
    exec(
      cmd,
      {
        timeout: (timeout + 10) * 1000,
        encoding: "utf-8",
        env: {
          ...process.env,
          PATH: process.env.PATH + `:${HOME}/.local/bin`,
        },
      },
      (err, stdout) => {
        if (err) resolve(`Error: ${err.message}`);
        else resolve(stdout.trim());
      }
    );
  });
}

// ============================================================
// Tool implementations (shared between Vapi and Retell)
// ============================================================

async function handleToolCall(name, params) {
  switch (name) {
    case "list_sessions": {
      const flag = params?.active_only ? "-a" : "";
      return runSessions(`list ${flag}`);
    }

    case "send_message": {
      const { session, message, wait_for_response } = params;
      if (!session || !message) return "Error: session and message are required";

      // Prefix so the receiving session knows this is from a live phone call
      const prefixed = `[LIVE VOICE CALL — respond quickly and concisely, someone is waiting on the phone] ${message}`;

      if (wait_for_response) {
        const timeout = params.timeout || 60;
        const output = await runSendWait(session, prefixed, timeout);
        return clean(output);
      } else {
        const escaped = prefixed.replace(/"/g, '\\"');
        return runSessions(`send "${session}" "${escaped}"`);
      }
    }

    case "read_session": {
      const { session, num_messages } = params;
      if (!session) return "Error: session is required";
      const n = num_messages || 5;
      return runSessions(`read "${session}" -n ${n}`);
    }

    case "start_session": {
      const { name: sessionName, directory, prompt } = params;
      if (!sessionName || !directory) return "Error: name and directory required";
      const dir = directory === "~" ? HOME : directory;
      if (prompt) {
        const escapedPrompt = prompt.replace(/"/g, '\\"');
        return runSessions(
          `start "${sessionName}" "${dir}" -b -p "${escapedPrompt}"`
        );
      }
      return runSessions(`start "${sessionName}" "${dir}" -b`);
    }

    case "resume_session": {
      const { session } = params;
      if (!session) return "Error: session is required";
      return runSessions(`resume "${session}" -b`);
    }

    case "get_result": {
      const { session } = params;
      if (!session) return "Error: session name is required";

      const resultDir = path.join(HOME, ".claude/voice-results");
      const resultFile = path.join(resultDir, `${session}.txt`);

      // Poll for up to 20s waiting for output
      for (let i = 0; i < 10; i++) {
        try {
          const content = fs.readFileSync(resultFile, "utf-8").trim();
          if (content) return clean(content);
        } catch {}
        await new Promise((r) => setTimeout(r, 2000));
      }

      return "Session is still running. Try again in a moment.";
    }

    case "kill_session": {
      const { session } = params;
      if (!session) return "Error: session is required";
      return runSessions(`kill "${session}"`);
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ============================================================
// Retell AI tool endpoint
// Retell POSTs {name, args} and expects {result}
// ============================================================

app.post("/retell/tool", async (req, res) => {
  const { name, args } = req.body;
  console.log(`[retell] Tool call: ${name}`, args);

  let result;
  try {
    result = await handleToolCall(name, args || {});
    result = result.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    if (result.length > 2000) result = result.slice(0, 2000) + "...";
  } catch (err) {
    result = `Error: ${err.message}`;
  }

  console.log(
    `[retell] Result (${result.length} chars): ${result.slice(0, 100)}...`
  );
  return res.json({ result });
});

// ============================================================
// Retell Webhook — real-time call events
// ============================================================

const LIVE_TRANSCRIPT_FILE = path.join(TRANSCRIPTS_DIR, "live-call.json");

app.post("/retell/webhook", async (req, res) => {
  const { event, call } = req.body;
  if (!event) return res.status(200).json({});

  console.log(
    `[retell-webhook] ${event} | call: ${call?.call_id?.slice(0, 20)}`
  );

  switch (event) {
    case "call_started": {
      const from = call?.from_number;
      console.log(`[retell-webhook] Call started from ${from}`);

      // Phone number allowlist
      if (ALLOWED_PHONE_NUMBERS.length > 0 && from && !ALLOWED_PHONE_NUMBERS.includes(from)) {
        console.log(`[retell-webhook] BLOCKED call from ${from} — not in allowlist`);
        return res.status(200).json({});
      }
      fs.writeFileSync(
        LIVE_TRANSCRIPT_FILE,
        JSON.stringify(
          {
            status: "active",
            call_id: call?.call_id,
            started: new Date().toISOString(),
            transcript: [],
          },
          null,
          2
        )
      );
      break;
    }

    case "transcript_updated": {
      const turns = call?.transcript_with_tool_calls || [];
      const transcript = turns.map((t) => ({
        role: t.role,
        content: t.content,
        words: t.words?.length || 0,
        // Preserve word-level timestamps for latency analysis
        first_word_ts: t.words?.[0]?.start,
        last_word_ts: t.words?.[t.words.length - 1]?.end,
      }));

      fs.writeFileSync(
        LIVE_TRANSCRIPT_FILE,
        JSON.stringify(
          {
            status: "active",
            call_id: call?.call_id,
            updated: new Date().toISOString(),
            turn_count: transcript.length,
            transcript,
          },
          null,
          2
        )
      );

      const latest = transcript[transcript.length - 1];
      if (latest) {
        console.log(
          `[retell-webhook] [${latest.role}] ${latest.content?.slice(0, 100)}`
        );
      }
      break;
    }

    case "call_ended": {
      console.log(
        `[retell-webhook] Call ended. Reason: ${call?.disconnection_reason}`
      );
      // Read the last live transcript snapshot (has per-turn timestamps)
      let detailedTranscript = [];
      try {
        const live = JSON.parse(fs.readFileSync(LIVE_TRANSCRIPT_FILE, "utf-8"));
        detailedTranscript = live.transcript || [];
      } catch {}

      const callId = call?.call_id || "unknown";
      const filepath = path.join(TRANSCRIPTS_DIR, `retell_${callId}.json`);
      fs.writeFileSync(
        filepath,
        JSON.stringify(
          {
            callId,
            platform: "retell",
            timestamp: new Date().toISOString(),
            duration: (call?.duration_ms || 0) / 1000,
            transcript: call?.transcript || "",
            transcript_detailed: detailedTranscript,
            recording: call?.recording_url || "",
            disconnection_reason: call?.disconnection_reason,
          },
          null,
          2
        )
      );
      try {
        fs.unlinkSync(LIVE_TRANSCRIPT_FILE);
      } catch {}
      break;
    }

    case "call_analyzed":
      console.log(
        `[retell-webhook] Analysis: ${call?.call_analysis?.call_summary?.slice(0, 100)}`
      );
      break;
  }

  return res.status(200).json({});
});

// ============================================================
// Vapi Server URL endpoint (alternative to Retell)
// ============================================================

app.post("/vapi/webhook", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message in body" });

  switch (message.type) {
    case "function-call": {
      const { functionCall } = message;
      const { name, parameters } = functionCall;
      const toolCallId =
        message.toolCallList?.[0]?.id || functionCall.id || "";

      console.log(`[vapi] Tool call: ${name} (id: ${toolCallId})`, parameters);

      let result;
      try {
        result = await handleToolCall(name, parameters);
        result = result.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
      } catch (err) {
        result = `Error executing ${name}: ${err.message}`;
      }

      return res.json({ results: [{ toolCallId, result }] });
    }

    case "end-of-call-report": {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const callId = message.call?.id || "unknown";
      const record = {
        callId,
        platform: "vapi",
        timestamp: new Date().toISOString(),
        duration: message.durationSeconds || 0,
        endedReason: message.endedReason,
        summary: message.summary || "",
        transcript: message.transcript || "",
      };
      const filepath = path.join(
        TRANSCRIPTS_DIR,
        `vapi_${timestamp}_${callId}.json`
      );
      fs.writeFileSync(filepath, JSON.stringify(record, null, 2));
      console.log(`[vapi] Transcript saved: ${filepath}`);
      return res.json({});
    }

    default:
      return res.json({});
  }
});

// ============================================================
// Health check
// ============================================================

app.get("/health", (req, res) => {
  const sessions = runSessions("list -a --json");
  try {
    const data = JSON.parse(sessions);
    res.json({ status: "ok", active_sessions: data.length });
  } catch {
    res.json({ status: "ok", raw: sessions.slice(0, 200) });
  }
});

// ============================================================
// Start server
// ============================================================

app.listen(PORT, () => {
  console.log(`Bridge server running on http://localhost:${PORT}`);
  console.log(`Retell tool endpoint: POST /retell/tool`);
  console.log(`Retell webhook:      POST /retell/webhook`);
  console.log(`Vapi webhook:        POST /vapi/webhook`);
  console.log(`Health check:        GET  /health`);
  console.log();
  console.log("Next: run ngrok http " + PORT);
});
