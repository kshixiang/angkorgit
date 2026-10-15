#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceIcon = join(root, 'apps/desktop/src-tauri/icons/icon.svg');
if (!existsSync(sourceIcon)) {
  console.error('Missing apps/desktop/src-tauri/icons/icon.svg');
  process.exit(1);
}

const result = spawnSync(
  'pnpm',
  ['--filter', '@gitmd/desktop', 'exec', 'tauri', 'icon', 'src-tauri/icons/icon.svg'],
  { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(result.status ?? 1);
