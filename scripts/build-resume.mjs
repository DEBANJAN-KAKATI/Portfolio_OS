#!/usr/bin/env node
/**
 * npm run resume
 * Prints resume/resume.html to public/resume.pdf with a local Chromium browser
 * (Chrome, Edge or Brave; or set RESUME_BROWSER to its path) and warns if it
 * runs past one page.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'resume/resume.html');
const out = resolve(root, 'public/resume.pdf');

const candidates = [
  process.env.RESUME_BROWSER,
  ...(process.platform === 'win32'
    ? ['PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'].flatMap((v) =>
        process.env[v]
          ? [
              `${process.env[v]}\\Google\\Chrome\\Application\\chrome.exe`,
              `${process.env[v]}\\Microsoft\\Edge\\Application\\msedge.exe`,
              `${process.env[v]}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
            ]
          : [],
      )
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge']),
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) {
  console.error('No Chrome, Edge or Brave found. Set RESUME_BROWSER to a Chromium-based browser.');
  process.exit(1);
}

const before = existsSync(out) ? statSync(out).mtimeMs : 0;
const r = spawnSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${out}`, pathToFileURL(src).href], { stdio: 'pipe', timeout: 60_000 });
if (!existsSync(out) || statSync(out).mtimeMs === before) {
  console.error('Printing failed.', r.stderr?.toString().slice(0, 400) ?? '');
  process.exit(1);
}

const pages = (readFileSync(out, 'latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
console.log(`✔ public/resume.pdf written (${pages} page${pages === 1 ? '' : 's'}) with ${browser.split(/[\\/]/).pop()}`);
if (pages > 1) {
  console.warn('⚠ The resume runs past one page; trim resume/resume.html.');
  process.exitCode = 2;
}
