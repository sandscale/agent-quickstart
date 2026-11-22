// Usage: node --env-file=.env run.mjs examples/untrusted.py
//        node --env-file=.env run.mjs examples/runaway.py
// Runs the file in a fresh microVM and prints what happened. Nothing runs on your machine.

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { runUntrustedCode } from './sandbox.mjs';

const file = process.argv[2] ?? 'examples/untrusted.py';
const language = { '.py': 'python', '.js': 'node' }[extname(file)];
if (!language) {
  console.error(`Don't know how to run ${file}. Use a .py or .js file, or add a language to sandscale.config.json.`);
  process.exit(2);
}

const code = await readFile(file, 'utf8');
console.error(`> running ${file} in a new Sandscale sandbox`);

try {
  const r = await runUntrustedCode({ code, language, stream: true });
  console.error(
    `\n> exit code ${r.exitCode}` +
      (r.timedOut ? ' (timed out)' : '') +
      (r.oomKilled ? ' (out of memory)' : '') +
      ` · sandbox ${r.sandboxId} stopped`,
  );
  process.exit(r.exitCode === 0 ? 0 : 1);
} catch (err) {
  // Every API error is a SandscaleError with the server's status, code and message.
  // Common ones: 401 (bad or expired key), 429 quota_exceeded, 403 policy_denied.
  console.error(`> Sandscale call failed: ${err.status ?? ''} ${err.code ?? ''} ${err.message}`);
  if (err.requestId) console.error(`> request id: ${err.requestId}`);
  if (err.code === 'access_denied') {
    console.error('> Your key or your account may not have the sandboxes:create permission. Check the key in the console.');
  }
  process.exit(1);
}
