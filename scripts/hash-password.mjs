#!/usr/bin/env node
/**
 * npm run hash-password
 * Asks for the Dev Mode password (hidden input, twice) and prints the value for
 * DEV_MODE_PASSWORD_HASH, plus a fresh SESSION_SECRET. Nothing is written to disk
 * unless you pass --env-local (then .env.local is created/updated for local dev).
 */
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hashPassword } from '../api/_lib/password.js';

function ask(prompt) {
  return new Promise((resolveAnswer, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) return reject(new Error('Run this in an interactive terminal.'));
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off('data', onData);
        stdout.write('\n');
        resolveAnswer(value);
      } else if (ch === '\u0003') {
        stdout.write('\n');
        process.exit(130);
      } else if (ch === '\u007f' || ch === '\b') {
        value = value.slice(0, -1);
      } else value += ch; // nothing is echoed, like sudo
    };
    stdin.on('data', onData);
  });
}

async function upsertEnvLocal(entries) {
  const file = resolve(process.cwd(), '.env.local');
  let text = '';
  try {
    text = await readFile(file, 'utf8');
  } catch {
    /* new file */
  }
  for (const [k, v] of Object.entries(entries)) {
    // Vite expands $VARS in .env files, which would mangle the scrypt$N$r$p$… hash.
    const line = `${k}=${v.replaceAll('$', '\\$')}`;
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, () => line) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
  }
  await writeFile(file, text);
  return file;
}

const password = await ask('New Dev Mode password: ');
if (password.length < 12) {
  console.error('Use at least 12 characters.');
  process.exit(1);
}
if ((await ask('Repeat password: ')) !== password) {
  console.error('Passwords did not match.');
  process.exit(1);
}
const hash = await hashPassword(password);
const secret = randomBytes(48).toString('base64url');

if (process.argv.includes('--env-local')) {
  const file = await upsertEnvLocal({ DEV_MODE_PASSWORD_HASH: hash, SESSION_SECRET: secret });
  console.log(`\nSaved to ${file} (git-ignored). Restart \`npm run dev\`.`);
} else {
  console.log('\nAdd these as environment variables (Vercel → Settings → Environment Variables):\n');
  console.log(`DEV_MODE_PASSWORD_HASH=${hash}`);
  console.log(`SESSION_SECRET=${secret}`);
  console.log('\nFor local dev, run `npm run hash-password -- --env-local` instead.');
}
