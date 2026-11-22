# Run your AI agent's code in a microVM

Your agent writes code. This repo runs that code somewhere other than your laptop: a fresh [Sandscale](https://sandscale.dev) sandbox, which is a Firecracker microVM with its own kernel. Each run gets a new sandbox, and the sandbox is stopped when the run ends.

It has three parts:

- `run.mjs`: run any `.py` or `.js` file in a new sandbox and stream its output.
- `agent/sandbox-tool.mjs`: a `run_code` tool you can give to any agent that supports tool calling.
- `curl/run.sh`: the same thing with plain REST calls, if you don't want the SDK.

Nothing from your machine goes into the sandbox unless you send it: not your files, not your environment, not your SSH keys or cloud credentials.

The code targets [`@sandscale/sdk`](https://www.npmjs.com/package/@sandscale/sdk) 1.0.0. If something here doesn't work the way this README says, please [open an issue](https://github.com/sandscale/agent-quickstart/issues).

## What you need

- Node.js 22 or later (the SDK needs it).
- A Sandscale account. The Free plan is enough: 100 awake vCPU-hours a month, up to 3 sandboxes at once, up to 2 vCPU each.

## 1. Sign up and create an API key

1. [Sign up at cloud.sandscale.dev](https://cloud.sandscale.dev/auth/signup?utm_source=github&utm_medium=readme&utm_campaign=agent-quickstart).
2. In the console, open your account settings and create a personal API key with the `sandboxes:create` and `sandboxes:use` permissions.
3. The key starts with `nia_` and is shown once. Every key expires within 90 days.

## 2. Clone and configure

```sh
git clone https://github.com/sandscale/agent-quickstart.git
cd agent-quickstart
npm install
cp .env.example .env    # then paste your key into .env
```

`.env` is in `.gitignore`. Don't commit it. If `SANDSCALE_API_KEY` is already set in your shell, that value wins over the one in `.env`.

## 3. Run some agent-written code

`examples/untrusted.py` stands in for code an agent wrote. It reports the kernel it is running on, the names (not values) of the environment variables it can see, whether your usual credential folders exist, and whether it can reach the internet.

```sh
node --env-file=.env run.mjs examples/untrusted.py
```

What you'll see:

- A `> running examples/untrusted.py in a new Sandscale sandbox` line, then the script's output as it streams back.
- `kernel:` and `hostname:` lines from inside the sandbox. They belong to the sandbox, not your machine.
- `env var names:` lists only what exists inside the sandbox. `credential-looking variables:` should say `none`, and the `~/.ssh`, `~/.aws` and `~/.config/gh` lines should say `False`, because nothing from your laptop was copied in.
- A `network:` line that says whether `example.com:443` was reachable. Network access follows your plan and your organization's policy, and a sandbox can reach only what your egress allowlist allows.
- A last line with the exit code and `sandbox ... stopped`.

## 4. Watch a runaway get stopped

```sh
node --env-file=.env run.mjs examples/runaway.py
```

`runaway.py` never ends. It prints `still running` every few seconds until the run limit (`runTimeoutSeconds`, 30 in `sandscale.config.json`) ends it, and the last line is marked `(timed out)`. The sandbox is stopped either way, and the sandbox's own limit (`timeoutSeconds`, 300) stops it even if your script crashes first.

## 5. Give it to your agent

`agent/sandbox-tool.mjs` exports a JSON Schema tool definition (`runCodeToolSchema`) and a handler (`runCodeTool`). Pass the schema to your model as a tool. When the model calls it, run the handler and send the result back. If Sandscale refuses the run, the handler returns `{ error }` instead of throwing, so your agent loop keeps going.

```sh
# A stand-in agent: no model call, it just runs examples/untrusted.py through the tool.
node --env-file=.env agent/demo-agent.mjs
```

It prints `model asked for tool: run_code`, then the JSON result your loop would send back to the model: `exit_code`, `timed_out`, `out_of_memory`, `stdout` and `stderr`.

Your model API key stays on the machine running your agent loop. The sandbox only ever sees the code.

## If it fails

- `401 unauthorized`: the key is wrong, expired or revoked. Check `.env`, or create a new key.
- `403 access_denied: you do not have permission to start sandboxes here`: the key, or your account in this organization, can't start sandboxes. A key like that may still be able to list sandboxes. Create a key that has `sandboxes:create`, or ask your organization's administrator for that permission.
- `429 quota_exceeded`: you're at your plan's limit, for example 3 sandboxes at once on Free.

## How it works

`sandbox.mjs` makes four calls with the [TypeScript SDK](https://sandscale.dev/docs/sdks/typescript):

```js
const box = await sandscale.sandboxes.create({ template: 'builtin:python', timeoutSeconds: 300 });
await sandscale.sandboxes.writeFile(box.id, '/workspace/main.py', code, { region: box.region });
const run = await sandscale.sandboxes.run(box.id, ['python3', 'main.py'], { region: box.region, timeoutSeconds: 30 });
await sandscale.sandboxes.stop(box.id, { region: box.region }); // in a finally block
```

`run` returns the exit code, stdout, stderr, duration, and whether the command timed out or ran out of memory. Every run is recorded: `GET /api/v1/sandbox/runs/{id}` with the run ID returns its details and cost.

To change the template, timeouts or languages, edit `sandscale.config.json`. Built-in templates include `builtin:python`, `builtin:node`, `builtin:go` and `builtin:base`.

## Without the SDK: REST

```sh
# Needs curl, jq and base64.
SANDSCALE_API_KEY=nia_... sh curl/run.sh examples/untrusted.py
```

It calls `POST /instances`, `PUT /instances/{id}/files`, `POST /instances/{id}/exec` and `DELETE /instances/{id}` on `https://api.sandscale.dev/api/v1/sandbox`. If the start is refused, it prints the server's error code and message and stops. See [Run code in a sandbox with the API](https://sandscale.dev/docs/guides/sandboxes-api).

## What this does not do

- **It is not a guarantee.** A kernel per run is a stronger boundary than a container that shares the host kernel. It does not make hostile code harmless: anything you send into the sandbox, including secrets, is readable by the code running there.
- **US only for now.** Sandboxes run in N. Virginia on AWS. Europe (Frankfurt) is coming soon.
- **No GPU sandboxes**, and no Windows or macOS sandboxes.
- **No certifications.** Sandscale doesn't hold SOC 2 or ISO 27001.
- **TypeScript only.** The Python SDK is coming soon. The REST path works from any language.

## Next

- [Give a run a secret](https://sandscale.dev/docs/guides/vault-secrets) with Vault, without the value passing through your code or logs.
- [Containers, gVisor or Firecracker](https://sandscale.dev/blog/isolating-ai-agent-code-containers-gvisor-firecracker): the trade-offs.
- [Awake-time billing](https://sandscale.dev/blog/awake-time-billing-agent-sandboxes): what a sandbox costs when it sits idle.
- [Run your AI agent's code in a microVM](https://sandscale.dev/blog/run-agent-code-in-a-microvm-quickstart): the post that goes with this repo.

## License

MIT. See [LICENSE](LICENSE).
