// A stand-in for your agent. It does not call a model: it pretends the model asked to run
// the code in examples/untrusted.py, runs it through the tool, and prints the tool result
// your loop would send back to the model.
//
// To use a real model, replace fakeModelTurn() with your provider's tool-calling API and
// pass runCodeToolSchema as the tool. Your model API key stays on your machine; the sandbox
// never sees it.

import { readFile } from 'node:fs/promises';
import { runCodeTool, runCodeToolSchema } from './sandbox-tool.mjs';

async function fakeModelTurn() {
  const code = await readFile(new URL('../examples/untrusted.py', import.meta.url), 'utf8');
  return { tool: runCodeToolSchema.name, arguments: { language: 'python', code } };
}

const call = await fakeModelTurn();
console.log(`model asked for tool: ${call.tool}`);
const result = await runCodeTool(call.arguments);
console.log('tool result to send back to the model:');
console.log(JSON.stringify(result, null, 2));
