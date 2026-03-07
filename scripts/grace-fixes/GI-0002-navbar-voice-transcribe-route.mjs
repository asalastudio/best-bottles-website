#!/usr/bin/env node

/**
 * GI-0002 smoke test
 *
 * Verifies the navbar voice-search route by:
 * 1. Generating a short spoken sample on macOS via `say`
 * 2. Posting it to a running local app at /api/voice/transcribe
 * 3. Printing the transcription response
 *
 * Usage:
 *   node scripts/grace-fixes/GI-0002-navbar-voice-transcribe-route.mjs
 *   node scripts/grace-fixes/GI-0002-navbar-voice-transcribe-route.mjs "round bottles"
 *   BASE_URL=http://localhost:3000 node scripts/grace-fixes/GI-0002-navbar-voice-transcribe-route.mjs
 */

import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const phrase = process.argv[2] || "round bottles";
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const outputPath = path.join(tmpdir(), "gi-0002-navbar-voice-test.aiff");

function runSay(text, destination) {
  return new Promise((resolve, reject) => {
    const child = spawn("say", ["-o", destination, text], { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`say exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

try {
  await runSay(phrase, outputPath);
  const audio = await readFile(outputPath);
  const form = new FormData();
  form.append("audio", new Blob([audio], { type: "audio/aiff" }), "gi-0002-test.aiff");

  const response = await fetch(`${baseUrl}/api/voice/transcribe`, {
    method: "POST",
    body: form,
  });

  const bodyText = await response.text();
  console.log(`Status: ${response.status}`);
  console.log(bodyText);

  if (!response.ok) {
    process.exitCode = 1;
  }
} finally {
  await unlink(outputPath).catch(() => {});
}
