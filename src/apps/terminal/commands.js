/**
 * Command Prompt commands. Each handler gets (args, ctx) and prints through ctx.
 *
 * ctx: { print(...segments), blank(), clear(), state, cwd, setCwd(segs), fs, setColors(code),
 *        openApp(id, props), closeSelf(), runEffect(name), askPassword(prompt), system }
 * A segment is a string or { t, c?, b?, href? } (text, colour, bold, link).
 */
import config from '@config';
import { stripTags } from '@/data/sanitize.js';
import { selectProjects } from '@/data/store.js';
import { apps, getApp } from '@/os/apps/registry.js';
import { displayName, firstName } from '@/os/lib/format.js';
import { useDev } from '@/os/devmode.js';
import { tagLabel, relativeTime } from '../kit/format.js';
import { checkForUpdates } from '../update/liveCheck.js';
import { lookup, resolvePath, formatPath } from './filesystem.js';

export const CMD_COLORS = {
  0: '#0c0c0c', 1: '#0037da', 2: '#13a10e', 3: '#3a96dd', 4: '#c50f1f', 5: '#881798', 6: '#c19c00', 7: '#cccccc',
  8: '#767676', 9: '#3b78ff', a: '#16c60c', b: '#61d6d6', c: '#e74856', d: '#b4009e', e: '#f9f1a5', f: '#f2f2f2',
};

const ACCENT = '#61d6d6';
const DIM = '#767676';
const GOOD = '#16c60c';
const WARN = '#f9f1a5';
const BAD = '#e74856';

const h = (t) => ({ t, c: ACCENT, b: true });
const dim = (t) => ({ t, c: DIM });

/** ┌─ Title ───┐ boxes for the info commands. */
function box(ctx, title, rows, width = 64) {
  ctx.print({ t: `┌─ ${title} ${'─'.repeat(Math.max(0, width - title.length - 4))}┐`, c: ACCENT });
  for (const row of rows) ctx.print({ t: '│ ', c: ACCENT }, ...(Array.isArray(row) ? row : [row]));
  ctx.print({ t: `└${'─'.repeat(width - 1)}┘`, c: ACCENT });
}

const JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'I would tell you a UDP joke, but you might not get it.',
  'There are only two hard things in computer science: cache invalidation, naming things, and off-by-one errors.',
  'A SQL query walks into a bar, goes up to two tables and asks: "Can I join you?"',
  '!false — it\'s funny because it\'s true.',
  'My code doesn\'t have bugs. It has surprise features.',
  'Why did the neural network break up? It found someone with better weights.',
];

const COFFEE = [
  '      ( (',
  '       ) )',
  '    ........',
  '    |      |]',
  '    \\      /',
  "     `----'",
  'Brewing… ☕ coffee.exe has finished. Productivity +20%.',
];

export const VISIBLE_COMMANDS = {
  help: 'List all commands',
  whoami: 'Who owns this PC',
  about: 'Short introduction',
  experience: 'Work experience',
  projects: 'Projects (try: projects ai_ml)',
  skills: 'Skills by category',
  education: 'Education and coursework',
  achievements: 'Patents, certifications, awards',
  hobbies: 'What I do for fun',
  contact: 'How to reach me',
  open: 'Open an app (open projects, open minesweeper…)',
  resume: 'Download my resume',
  dir: 'List the current folder',
  cd: 'Change folder (cd Projects, cd ..)',
  tree: 'Show the folder tree',
  type: 'Print a file (type About.txt)',
  cls: 'Clear the screen',
  echo: 'Print text',
  date: 'Show the date',
  time: 'Show the time',
  ver: 'Show the version',
  color: 'Change colours, e.g. color 0a (color /? for codes)',
  systeminfo: 'System information',
  neofetch: 'Same, with a logo',
  sync: 'sync status: where the data comes from',
  git: 'git log: latest updates',
  gh: 'gh repo list: my GitHub repos',
  winget: 'winget upgrade: check for new projects',
  matrix: 'Follow the white rabbit',
  hack: 'Totally real hacking',
  joke: 'A programming joke',
  coffee: 'Refuel',
  sudo: 'Run as administrator',
  shutdown: 'Turn off the PC',
  exit: 'Close Command Prompt',
};

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function suggest(word) {
  const all = [...Object.keys(VISIBLE_COMMANDS), 'clear', 'ls', 'pwd', 'cat'];
  const best = all.map((c) => [c, levenshtein(word, c)]).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] <= Math.max(1, Math.floor(word.length / 3)) ? best[0] : null;
}

/** App lookup for "open": id, title, or a friendly alias. */
const APP_ALIASES = { minesweeper: 'games', snake: 'games', tictactoe: 'games', memory: 'games', cmd: 'terminal', explorer: 'projects', notepad: 'about', taskmgr: 'skills', 'task manager': 'skills', contact: 'mail', email: 'mail', cv: 'resume', '3d': 'viewer3d', music: 'videos' };
export function findApp(name) {
  const q = name.toLowerCase().trim();
  if (!q) return null;
  if (APP_ALIASES[q]) return getApp(APP_ALIASES[q]);
  return apps.find((a) => a.id === q || a.title.toLowerCase() === q) ?? apps.find((a) => a.title.toLowerCase().startsWith(q) || a.id.startsWith(q)) ?? null;
}

function neofetch(ctx, withLogo) {
  const s = ctx.state;
  const p = s.portfolio;
  const langs = Object.entries(p.github?.languageTotals ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => l);
  const uptime = Math.round(performance.now() / 60000);
  const info = [
    [h(`guest@${firstName(p.profile.name).toLowerCase()}-pc`)],
    [dim('─'.repeat(24))],
    [h('OS: '), 'PortfolioOS 26.10 (web)'],
    [h('Host: '), displayName(p.profile.name)],
    [h('Kernel: '), 'React 19 + Vite'],
    [h('Uptime: '), `${uptime} min`],
    [h('Shell: '), 'cmd.exe (portfolio edition)'],
    [h('Resolution: '), `${window.innerWidth}x${window.innerHeight}`],
    [h('Location: '), p.profile.location ?? 'Earth'],
    [h('Projects: '), String(selectProjects(s).length)],
    [h('Skills: '), String(p.skills.reduce((n, g) => n + g.skills.length, 0))],
    [h('Top languages: '), langs.join(', ') || '—'],
    [h('GitHub: '), p.github ? `${p.github.publicRepos} repos, ${p.github.totalStars} ★` : '—'],
  ];
  const logo = withLogo
    ? ['  ██████╗ ██╗  ██╗', '  ██╔══██╗██║ ██╔╝', '  ██║  ██║█████╔╝ ', '  ██║  ██║██╔═██╗ ', '  ██████╔╝██║  ██╗', '  ╚═════╝ ╚═╝  ╚═╝', '', '']
    : [];
  const rows = Math.max(logo.length, info.length);
  for (let i = 0; i < rows; i++) {
    ctx.print({ t: (logo[i] ?? '').padEnd(withLogo ? 22 : 0), c: '#3b78ff', b: true }, ...(info[i] ?? []));
  }
  if (withLogo) ctx.print(...Object.values(CMD_COLORS).map((c) => ({ t: '███', c })));
}

export async function runCommand(raw, ctx) {
  const line = raw.trim();
  if (!line) return;
  const [cmdRaw, ...rest] = line.split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const args = rest;
  const argStr = line.slice(cmdRaw.length).trim();
  const s = ctx.state;
  const p = s.portfolio;

  // Dev Mode adds its own commands (status, add, upload, publish, studio, logout).
  const dev = useDev.getState();
  if (dev.active && (await dev.module.terminal(cmd, args, argStr, ctx))) return;

  switch (cmd) {
    case 'help':
    case '/?': {
      ctx.print(dim('For more information on a specific command, just try it.'));
      const entries = Object.entries(VISIBLE_COMMANDS);
      for (const [k, v] of entries) ctx.print({ t: k.toUpperCase().padEnd(12), c: ACCENT }, v);
      if (dev.active) ctx.print(dim('Dev Mode: STATUS, ADD <type>, UPLOAD, PUBLISH [message], STUDIO, LOGOUT'));
      return;
    }
    case 'whoami':
      ctx.print(`${firstName(p.profile.name).toLowerCase()}-pc\\guest`);
      ctx.print(dim(`(You're visiting ${displayName(p.profile.name)}'s PC as a guest.)`));
      return;
    case 'about':
      box(ctx, displayName(p.profile.name), [[h(s.extras.tagline)], '', ...wrap(s.extras.intro, 60), '', [dim('Location: '), p.profile.location ?? '—']]);
      return;
    case 'experience':
      if (!p.experiences.length) return ctx.print('No experience listed yet.');
      for (const e of p.experiences) {
        ctx.print(h(e.role), dim(' @ '), { t: e.company, b: true });
        ctx.print(dim(`  ${e.duration}${e.location ? ` · ${e.location}` : ''}`));
        for (const b of e.bullets[2]) for (const [i, l] of wrap(stripTags(b), 74).entries()) ctx.print(i === 0 ? '  • ' : '    ', l);
        ctx.blank();
      }
      return;
    case 'projects': {
      const tag = args[0]?.toLowerCase();
      const list = selectProjects(s).filter((pr) => !tag || pr.tags.some((t) => t === tag || tagLabel(t).toLowerCase().replace(/\s/g, '') === tag.replace(/\s/g, '')));
      if (!list.length) return ctx.print(`No projects tagged "${tag}". Tags: ${[...new Set(selectProjects(s).flatMap((x) => x.tags))].join(', ')}`);
      ctx.print(h(`${list.length} project${list.length > 1 ? 's' : ''}${tag ? ` tagged ${tag}` : ''}`));
      list.forEach((pr, i) => {
        ctx.print(dim(`${String(i + 1).padStart(2)}. `), { t: pr.title, b: true }, pr.github ? { t: `  ★${pr.github.stars}`, c: WARN } : dim('  (not on GitHub yet)'));
        if (pr.tech.length) ctx.print(dim(`    ${pr.tech.slice(0, 5).join(' · ')}`));
      });
      ctx.print(dim('Details: cd Projects, then type "<name>.md" — or run: open projects'));
      return;
    }
    case 'skills':
      for (const g of p.skills) {
        ctx.print(h(g.label));
        for (const sk of g.skills) {
          const bar = '█'.repeat(Math.round(sk.usage / 10)).padEnd(10, '░');
          ctx.print('  ', { t: bar, c: sk.usageSource === 'github' ? GOOD : '#3b78ff' }, ` ${String(sk.usage).padStart(3)}%  `, sk.name);
        }
      }
      ctx.print(dim('Green = measured from GitHub code · blue = ranked by the career vault'));
      return;
    case 'education':
      for (const e of p.education) {
        ctx.print(h(e.institution));
        ctx.print(`  ${e.degree}`, dim(`  ${e.duration}`), e.gpa ? dim(`  GPA ${e.gpa}`) : '');
      }
      for (const g of p.coursework) ctx.print({ t: `  ${g.label}: `, c: ACCENT }, g.courses.join(', '));
      return;
    case 'achievements':
      for (const a of p.achievements) ctx.print({ t: `[${a.label}] `, c: WARN }, { t: a.title, b: true }, dim(a.details ? ` — ${stripTags(a.details)}` : ''));
      return;
    case 'hobbies':
      for (const hb of s.extras.hobbies.filter((x) => !x.hidden)) ctx.print(`${hb.icon}  `, { t: hb.name, b: true }, dim(` — ${hb.blurb}`));
      return;
    case 'contact':
      box(ctx, 'Contact', [
        ...(p.profile.linkedin ? [[h('LinkedIn  '), { t: p.profile.linkedin, href: p.profile.linkedin }]] : []),
        ...(p.profile.github ? [[h('GitHub    '), { t: p.profile.github, href: p.profile.github }]] : []),
        ...(p.profile.email ? [[h('Email     '), { t: p.profile.email, href: `mailto:${p.profile.email}` }]] : []),
        [h('Message   '), 'run: open mail'],
      ]);
      return;
    case 'open':
    case 'start': {
      if (!argStr) return ctx.print('Usage: open <app>   e.g. open projects, open paint, open minesweeper');
      const app = findApp(argStr);
      if (!app) return ctx.print({ t: `The system cannot find the app "${argStr}".`, c: BAD }, dim(' Try: open projects'));
      const game = ['minesweeper', 'snake', 'tictactoe', 'memory'].includes(argStr.toLowerCase()) ? argStr.toLowerCase() : null;
      ctx.openApp(app.id, game ? { game } : {});
      ctx.print(dim(`Opening ${app.title}…`));
      return;
    }
    case 'resume': {
      const a = document.createElement('a');
      a.href = s.extras.resume.url;
      a.download = s.extras.resume.fileName;
      a.click();
      ctx.print({ t: `Downloading ${s.extras.resume.fileName}…`, c: GOOD });
      return;
    }
    case 'dir':
    case 'ls': {
      const target = lookup(ctx.fs, resolvePath(ctx.cwd, argStr));
      if (!target) return ctx.print({ t: 'File Not Found', c: BAD });
      if (target.node.type === 'file') return ctx.print(target.path.at(-1));
      ctx.print(dim(` Directory of ${formatPath(target.path)}`));
      ctx.blank();
      const entries = Object.entries(target.node.children);
      const today = new Date(p.meta.generatedAt);
      const stamp = `${today.toLocaleDateString('en-GB')}  ${today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      for (const [name, node] of entries) ctx.print(dim(stamp), node.type === 'dir' ? { t: '    <DIR>          ', c: WARN } : '                   ', node.type === 'dir' ? { t: name, c: ACCENT } : name);
      const files = entries.filter(([, n]) => n.type === 'file').length;
      ctx.print(dim(`               ${files} File(s)`));
      ctx.print(dim(`               ${entries.length - files} Dir(s)   ∞ bytes free`));
      return;
    }
    case 'cd':
    case 'chdir': {
      if (!argStr) return ctx.print(formatPath(ctx.cwd));
      const target = lookup(ctx.fs, resolvePath(ctx.cwd, argStr));
      if (!target || target.node.type !== 'dir') return ctx.print({ t: 'The system cannot find the path specified.', c: BAD });
      ctx.setCwd(target.path);
      return;
    }
    case 'pwd':
      ctx.print(formatPath(ctx.cwd));
      return;
    case 'tree': {
      const target = lookup(ctx.fs, resolvePath(ctx.cwd, argStr));
      if (!target || target.node.type !== 'dir') return ctx.print({ t: 'Invalid path', c: BAD });
      ctx.print(formatPath(target.path));
      const walk = (node, prefix) => {
        const entries = Object.entries(node.children);
        entries.forEach(([name, child], i) => {
          const last = i === entries.length - 1;
          ctx.print(dim(prefix + (last ? '└───' : '├───')), child.type === 'dir' ? { t: name, c: ACCENT } : name);
          if (child.type === 'dir') walk(child, prefix + (last ? '    ' : '│   '));
        });
      };
      walk(target.node, '');
      return;
    }
    case 'type':
    case 'cat': {
      if (!argStr) return ctx.print('The syntax of the command is incorrect.');
      const target = lookup(ctx.fs, resolvePath(ctx.cwd, argStr.replace(/^"|"$/g, '')));
      if (!target) return ctx.print({ t: 'The system cannot find the file specified.', c: BAD });
      if (target.node.type === 'dir') return ctx.print({ t: 'Access is denied.', c: BAD }, dim(' (that is a folder — try dir)'));
      for (const l of target.node.content()) for (const w of wrap(l, 78)) ctx.print(w);
      return;
    }
    case 'cls':
    case 'clear':
      ctx.clear();
      return;
    case 'echo':
      if (!argStr || argStr.toLowerCase() === 'on' || argStr.toLowerCase() === 'off') return ctx.print('ECHO is on.');
      ctx.print(argStr.replace(/^"|"$/g, ''));
      return;
    case 'date':
      ctx.print(`The current date is: ${new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })}`);
      return;
    case 'time':
      ctx.print(`The current time is: ${new Date().toLocaleTimeString(undefined, { hour12: false })}.${String(new Date().getMilliseconds()).slice(0, 2)}`);
      return;
    case 'ver':
      ctx.print('PortfolioOS [Version 26.10.0]');
      return;
    case 'color': {
      const code = (args[0] ?? '').toLowerCase();
      if (code === '/?' || code === '') {
        ctx.print('Sets the console foreground and background colors.  COLOR [bg][fg]');
        const names = ['Black', 'Blue', 'Green', 'Aqua', 'Red', 'Purple', 'Yellow', 'White', 'Gray', 'Light Blue', 'Light Green', 'Light Aqua', 'Light Red', 'Light Purple', 'Light Yellow', 'Bright White'];
        Object.entries(CMD_COLORS).forEach(([k, c], i) => ctx.print({ t: '■ ', c }, `${k.toUpperCase()} = ${names[i]}`));
        ctx.print(dim('Example: color 0a  (black background, light green text) · color 07 resets'));
        return;
      }
      if (!/^[0-9a-f]{1,2}$/.test(code)) return ctx.print({ t: 'Invalid colour code. Try color /?', c: BAD });
      const [bg, fg] = code.length === 1 ? ['0', code] : [code[0], code[1]];
      if (bg === fg) return ctx.print({ t: 'Background and foreground cannot be the same colour.', c: BAD });
      ctx.setColors({ bg: CMD_COLORS[bg], fg: CMD_COLORS[fg] });
      return;
    }
    case 'systeminfo':
      neofetch(ctx, false);
      return;
    case 'neofetch':
    case 'fastfetch':
      neofetch(ctx, true);
      return;
    case 'sync': {
      if ((args[0] ?? '').toLowerCase() !== 'status') return ctx.print('Usage: sync status');
      const labels = { vault: 'jstMyRB vault', github: 'GitHub', linkedin: 'LinkedIn (via vault)' };
      ctx.print(h('Data sources'), dim(`   last build ${relativeTime(p.meta.generatedAt)}`));
      for (const [k, src] of Object.entries(p.meta.sources)) {
        const color = src.status === 'ok' ? GOOD : src.status === 'never' ? DIM : WARN;
        ctx.print(`  ${(labels[k] ?? k).padEnd(22)}`, { t: src.status.toUpperCase().padEnd(7), c: color }, dim(src.at ? relativeTime(src.at) : 'not imported yet'));
      }
      return;
    }
    case 'git': {
      if ((args[0] ?? '').toLowerCase() !== 'log') return ctx.print(`git: '${args[0] ?? ''}' is not a git command here. Try: git log`);
      const entries = s.changelog.entries.slice(0, 10);
      if (!entries.length) return ctx.print('fatal: your current branch has no commits yet');
      for (const e of entries) {
        const hash = e.id.replace(/\D/g, '').slice(-7).padStart(7, '0');
        ctx.print({ t: hash, c: WARN }, ' ', e.title, dim(` (+${e.added.length} ~${e.updated.length} -${e.removed.length}, ${relativeTime(e.date)})`));
      }
      return;
    }
    case 'gh': {
      if (`${args[0]} ${args[1]}`.toLowerCase() !== 'repo list') return ctx.print('Usage: gh repo list');
      const byName = new Map(selectProjects(s).filter((x) => x.github).map((x) => [x.github.fullName, x]));
      const repos = p.github?.knownRepos ?? [];
      ctx.print(dim(`Showing ${repos.length} repositories in @${p.github?.login ?? config.owner.githubUser}`));
      for (const full of repos) {
        const proj = byName.get(full);
        ctx.print({ t: full.padEnd(56), c: ACCENT }, proj ? { t: `★${proj.github.stars}`, c: WARN } : dim('—'));
      }
      return;
    }
    case 'winget': {
      if ((args[0] ?? '').toLowerCase() !== 'upgrade') return ctx.print('Usage: winget upgrade');
      ctx.print(dim('Checking GitHub for new projects…'));
      try {
        const r = await checkForUpdates(p);
        if (!r.newRepos.length && !r.updatedRepos.length) return ctx.print({ t: 'No installed package found matching input criteria. You are up to date.', c: GOOD });
        ctx.print(h('Name'.padEnd(36) + 'Status'));
        for (const repo of r.newRepos) ctx.print(repo.name.padEnd(36), { t: 'Available (new project)', c: GOOD });
        for (const repo of r.updatedRepos) ctx.print(repo.name.padEnd(36), { t: `Update available (${relativeTime(repo.pushedAt)})`, c: WARN });
        ctx.print(dim('They will be installed by the next daily sync.'));
      } catch (err) {
        ctx.print({ t: err.message, c: BAD });
      }
      return;
    }
    case 'joke':
      ctx.print(JOKES[Math.floor(Math.random() * JOKES.length)]);
      return;
    case 'coffee':
      COFFEE.forEach((l, i) => ctx.print(i < COFFEE.length - 1 ? { t: l, c: '#c19c00' } : l));
      return;
    case 'matrix':
      await ctx.runEffect('matrix');
      return;
    case 'hack':
      await ctx.runEffect('hack');
      return;
    case 'sudo':
    case 'runas': {
      if ((args[0] ?? '').toLowerCase() === 'devmode') return ctx.devMode();
      ctx.print({ t: 'Nice try, this is Windows. 🙃', c: WARN });
      return;
    }
    case 'rm':
    case 'del':
    case 'rmdir':
    case 'format': {
      if (/-rf\s+\/|\/s|c:\\?$/i.test(argStr) || cmd === 'format') return ctx.runEffect('panic');
      ctx.print({ t: 'Access is denied. Visitors can look, not delete. 😉', c: BAD });
      return;
    }
    case 'shutdown':
      ctx.print('Shutting down…');
      setTimeout(() => ctx.system.shutDown(), 600);
      return;
    case 'exit':
    case 'quit':
      ctx.closeSelf();
      return;
    default: {
      const app = findApp(cmd);
      if (app && cmd.length > 2 && !/\s/.test(line)) {
        ctx.openApp(app.id, {});
        ctx.print(dim(`Opening ${app.title}…`));
        return;
      }
      ctx.print({ t: `'${cmdRaw}' is not recognized as an internal or external command,`, c: '#cccccc' });
      ctx.print('operable program or batch file.');
      const s2 = suggest(cmd);
      if (s2) ctx.print(dim(`Did you mean '${s2}'?`));
    }
  }
}

/** Word-wrap to a column width (monospace). */
export function wrap(text, width) {
  const words = String(text ?? '').split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur || !lines.length) lines.push(cur);
  return lines;
}

/** Completion candidates for Tab (devmode is deliberately never suggested). */
export function complete(input, ctx) {
  const parts = input.split(/\s+/);
  if (parts.length <= 1) {
    return Object.keys(VISIBLE_COMMANDS).filter((c) => c.startsWith(parts[0].toLowerCase())).map((c) => c);
  }
  const [cmd, ...rest] = parts;
  const partial = rest.join(' ');
  const c = cmd.toLowerCase();
  if (c === 'open' || c === 'start') {
    const names = [...new Set([...apps.map((a) => a.id), ...Object.keys(APP_ALIASES)])];
    return names.filter((n) => n.startsWith(partial.toLowerCase())).map((n) => `${cmd} ${n}`);
  }
  if (['cd', 'dir', 'type', 'cat', 'tree', 'ls'].includes(c)) {
    const slash = partial.lastIndexOf('\\');
    const base = slash >= 0 ? partial.slice(0, slash + 1) : '';
    const stem = partial.slice(base.length).replace(/^"/, '');
    const target = lookup(ctx.fs, resolvePath(ctx.cwd, base || '.'));
    if (!target || target.node.type !== 'dir') return [];
    return Object.entries(target.node.children)
      .filter(([name, node]) => name.toLowerCase().startsWith(stem.toLowerCase()) && (c !== 'cd' || node.type === 'dir'))
      .map(([name]) => `${cmd} ${base}${/\s/.test(name) ? `"${name}"` : name}`);
  }
  if (c === 'projects') {
    const tags = [...new Set(selectProjects(ctx.state).flatMap((x) => x.tags))];
    return tags.filter((t) => t.startsWith(partial.toLowerCase())).map((t) => `${cmd} ${t}`);
  }
  return [];
}
