import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const path = (...parts) => resolve(ROOT, ...parts);

export const PATHS = {
  vault: path('data/vault.public.json'),
  inbox: path('data/vault.inbox.json'),
  github: path('data/github.snapshot.json'),
  portfolio: path('src/data/generated/portfolio.json'),
  changelog: path('src/data/generated/changelog.json'),
  extras: path('content/extras.json'),
  media: path('content/media.json'),
  layout: path('content/layout.json'),
  trash: path('content/trash.json'),
};

/** Returns parsed JSON, or `fallback` when the file does not exist. */
export async function readJson(file, fallback = undefined) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    if (err instanceof SyntaxError) throw new Error(`${file} is not valid JSON: ${err.message}`);
    throw err;
  }
}

export async function writeJson(file, data) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

export const rel = (file) => file.slice(ROOT.length + 1).replace(/\\/g, '/');
