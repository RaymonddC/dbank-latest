#!/usr/bin/env node
// Rewrites the imports emitted by `dfx generate` from the deprecated
// @dfinity/* packages to their @icp-sdk/* replacements. dfx still emits
// the legacy paths as of dfx 0.24+, so this runs as a postprocess in
// the frontend's prebuild script.

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/ → frontend/ → dbank-latest-frontend/ → src/ → declarations/
const declarationsRoot = resolve(__dirname, '..', '..', 'declarations');

const replacements = [
  [/(['"])@dfinity\/agent(['"])/g, '$1@icp-sdk/core/agent$2'],
  [/(['"])@dfinity\/principal(['"])/g, '$1@icp-sdk/core/principal$2'],
  [/(['"])@dfinity\/candid(['"])/g, '$1@icp-sdk/core/candid$2'],
];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
    } else if (/\.(d\.ts|ts|js|mjs|cjs)$/.test(entry)) {
      const original = readFileSync(path, 'utf8');
      let updated = original;
      for (const [pattern, replacement] of replacements) {
        updated = updated.replace(pattern, replacement);
      }
      if (updated !== original) {
        writeFileSync(path, updated);
        console.log(`rewrote ${path}`);
      }
    }
  }
}

try {
  walk(declarationsRoot);
} catch (err) {
  if (err && err.code === 'ENOENT') {
    console.warn(`[rewrite-icp-imports] ${declarationsRoot} not found — has dfx generate run yet?`);
    process.exit(0);
  }
  throw err;
}
