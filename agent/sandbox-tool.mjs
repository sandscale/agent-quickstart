// A tool definition you can hand to any agent loop that supports function or tool calling.
// The model asks to run code; your loop calls runCodeTool(); the code runs in a fresh
// microVM, never on the machine running the agent.
//
// The schema is plain JSON Schema. Wrap it in whatever shape your model provider expects.

import { runUntrustedCode } from '../sandbox.mjs';

export const runCodeToolSchema = {
  name: 'run_code',
  description:
    'Run a short Python or Node.js program in a fresh, isolated sandbox and return its output. ' +
    'The sandbox has no access to the user\'s files or credentials. It is thrown away after the run.',
  parameters: {
    type: 'object',
    properties: {
      language: { type: 'string', enum: ['python', 'node'] },
      code: { type: 'string', description: 'The full program to run.' },
    },
    required: ['language', 'code'],
  },
};

const MAX_CHARS = 8000; // keep tool results small enough to send back to the model

export async function runCodeTool({ language, code }) {
  let r;
  try {
    r = await runUntrustedCode({ language, code });
  } catch (err) {
    // Hand the failure back to the model as a tool result instead of crashing the agent loop.
    return { error: `${err.status ?? ''} ${err.code ?? ''} ${err.message}`.trim() };
  }
  const clip = (s) => (s.length > MAX_CHARS ? s.slice(0, MAX_CHARS) + '\n[truncated]' : s);
  return {
    exit_code: r.exitCode,
    timed_out: r.timedOut,
    out_of_memory: r.oomKilled,
    stdout: clip(r.stdout),
    stderr: clip(r.stderr),
  };
}
