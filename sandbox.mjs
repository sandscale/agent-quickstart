// Runs one piece of untrusted code in a fresh Sandscale sandbox (a Firecracker microVM
// with its own kernel), returns what happened, and always stops the sandbox.
//
// Only calls documented at https://sandscale.dev/docs/sdks/typescript are used:
// sandboxes.create, sandboxes.writeFile, sandboxes.run, sandboxes.stop.

import { readFile } from 'node:fs/promises';
import { Sandscale } from '@sandscale/sdk';

const config = JSON.parse(
  await readFile(new URL('./sandscale.config.json', import.meta.url), 'utf8'),
);

let client;
const sandscale = () => (client ??= new Sandscale()); // reads SANDSCALE_API_KEY from the environment

/**
 * @param {object} args
 * @param {string} args.code      The code to run. Treat it as hostile.
 * @param {string} [args.language] A key of config.languages ("python" or "node").
 * @param {boolean} [args.stream]  Print output live as it arrives.
 * @returns {Promise<{exitCode:number, stdout:string, stderr:string, timedOut:boolean, oomKilled:boolean, durationMs:number, runId:string, sandboxId:string}>}
 */
export async function runUntrustedCode({ code, language = 'python', stream = false }) {
  const lang = config.languages[language];
  if (!lang) throw new Error(`Unknown language "${language}". Add it to sandscale.config.json.`);

  // A new sandbox for every run: nothing from an earlier run is there, and nothing
  // from your machine (files, environment, credentials) is copied in unless you send it.
  const box = await sandscale().sandboxes.create({
    template: lang.template,
    timeoutSeconds: config.timeoutSeconds, // the sandbox stops itself if this script dies
    labels: config.labels,
  });

  try {
    const path = `${config.workdir}/${lang.file}`;
    await sandscale().sandboxes.writeFile(box.id, path, code, { region: box.region });

    let stdout = '';
    let stderr = '';
    const run = await sandscale().sandboxes.run(box.id, lang.command, {
      region: box.region,
      workdir: config.workdir,
      timeoutSeconds: config.runTimeoutSeconds,
      onStdout: (text) => { stdout += text; if (stream) process.stdout.write(text); },
      onStderr: (text) => { stderr += text; if (stream) process.stderr.write(text); },
    });

    return {
      exitCode: run.exitCode,
      stdout: stdout || run.stdout || '',
      stderr: stderr || run.stderr || '',
      timedOut: run.timedOut,
      oomKilled: run.oomKilled,
      durationMs: run.durationMs,
      runId: run.runId,
      sandboxId: box.id,
    };
  } finally {
    await sandscale().sandboxes.stop(box.id, { region: box.region });
  }
}
