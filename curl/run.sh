#!/usr/bin/env sh
# Usage: SANDSCALE_API_KEY=nia_... sh curl/run.sh examples/untrusted.py
# Endpoints from https://sandscale.dev/docs/guides/sandboxes-api
set -eu

FILE="${1:-examples/untrusted.py}"
API=https://api.sandscale.dev/api/v1/sandbox
AUTH="Authorization: Bearer $SANDSCALE_API_KEY"

# 1. Start a sandbox. It stops by itself after ttl_seconds even if this script dies.
CREATED=$(curl -sS -X POST "$API/instances" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"template_id": "builtin:python", "ttl_seconds": 300, "name": "agent-quickstart"}')
ID=$(printf '%s' "$CREATED" | jq -r '.id // empty')
if [ -z "$ID" ]; then
  echo "> Sandscale refused the start: $(printf '%s' "$CREATED" | jq -r '.error.code + ": " + .error.message')" >&2
  exit 1
fi
echo "> sandbox $ID" >&2

# Stop it on exit, whatever happens.
trap 'curl -sS -X DELETE "$API/instances/$ID" -H "$AUTH" >/dev/null; echo "> sandbox $ID stopped" >&2' EXIT

# 2. Write the file. content is base64.
CONTENT=$(base64 < "$FILE" | tr -d '\n')
jq -n --arg c "$CONTENT" '{path: "/workspace/main.py", content: $c}' |
  curl -sS -X PUT "$API/instances/$ID/files" -H "$AUTH" -H "Content-Type: application/json" -d @- >/dev/null

# 3. Run it. The answer has exit_code, stdout, stderr, duration_ms, timed_out and oom_killed.
curl -sS -X POST "$API/instances/$ID/exec" -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"command": ["python3", "/workspace/main.py"], "timeout_sec": 30}' |
  jq -r '.stdout, "> exit code \(.exit_code) timed_out=\(.timed_out) oom_killed=\(.oom_killed)"'
