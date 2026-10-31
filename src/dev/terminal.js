/** Command Prompt commands available while Dev Mode is active. Returns true when handled. */
import { useDev } from '@/os/devmode.js';
import { useStaging } from './store.js';
import { SECTIONS } from './sections.js';
import { useDevUi, openStudio } from './DevRoot.jsx';

const ACCENT = '#61d6d6';
const DIM = '#767676';
const GOOD = '#16c60c';
const BAD = '#e74856';

// Friendly names for `add <type>`.
const TYPES = {
  project: 'projects', experience: 'experiences', work: 'experiences', skill: 'skills', skills: 'skills', education: 'education',
  achievement: 'achievements', cert: 'achievements', hobby: 'hobbies', casual: 'casualWorks', blog: 'casualWorks', photo: 'photos',
  video: 'videos', model: 'models', render: 'renders', wallpaper: 'wallpapers', shortcut: 'shortcuts', link: 'shortcuts',
};

function pickFiles() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.click();
  });
}

export async function terminal(cmd, args, argStr, ctx) {
  const session = useDev.getState().session;
  switch (cmd) {
    case 'status': {
      const { staged, published } = useStaging.getState();
      ctx.print({ t: 'Developer Mode', c: ACCENT, b: true }, { t: ` · publishing to ${session?.target === 'github' ? `GitHub (${session.reviewMode})` : session?.target === 'local' ? 'this folder' : 'nowhere (not configured)'}`, c: DIM });
      ctx.print(`Session ends ${new Date(session?.expiresAt ?? Date.now()).toLocaleTimeString()}`);
      if (!staged.log.length) ctx.print({ t: 'No unpublished changes.', c: GOOD });
      for (const l of staged.log) ctx.print({ t: '  M ', c: '#c19c00' }, l.label);
      if (published) ctx.print({ t: `Last publish waiting for deploy (${published.mode})`, c: DIM });
      return true;
    }
    case 'add': {
      const secKey = TYPES[(args[0] ?? '').toLowerCase()] ?? (SECTIONS[args[0]] ? args[0] : null);
      if (!secKey) {
        ctx.print(`Usage: add <${Object.keys(TYPES).join('|')}>`);
        return true;
      }
      useDevUi.getState().set({ quickAdd: { secKey, initial: {} } });
      ctx.print({ t: `Opening "New ${SECTIONS[secKey].one.toLowerCase()}"…`, c: DIM });
      return true;
    }
    case 'upload': {
      ctx.print({ t: 'Choose files…', c: DIM });
      const files = await pickFiles();
      if (files.length) useDevUi.getState().set({ drop: { files, links: [], key: Date.now() } });
      else ctx.print('No files chosen.');
      return true;
    }
    case 'publish': {
      const { staged } = useStaging.getState();
      if (!staged.log.length) {
        ctx.print('Nothing to publish.');
        return true;
      }
      if (session?.target === 'none') {
        ctx.print({ t: "Publishing isn't configured on this server.", c: BAD });
        return true;
      }
      const message = argStr || `Dev Mode: ${staged.log.map((l) => l.label).slice(0, 3).join('; ')}`;
      ctx.print(`Publishing ${staged.log.length} change${staged.log.length > 1 ? 's' : ''}…`);
      try {
        const r = await useStaging.getState().publish({ message, mode: session.reviewMode ?? 'pr', target: session.target });
        if (r.local) ctx.print({ t: 'Saved into this project folder.', c: GOOD });
        else if (r.prUrl) ctx.print({ t: 'Pull request opened: ', c: GOOD }, { t: r.prUrl, href: r.prUrl });
        else ctx.print({ t: 'Committed. The site redeploys in a minute or two.', c: GOOD });
      } catch (err) {
        ctx.print({ t: `Publish failed: ${err.message}`, c: BAD });
      }
      return true;
    }
    case 'studio':
      openStudio(args[0] && SECTIONS[args[0]] ? args[0] : 'dashboard');
      ctx.print({ t: 'Opening Portfolio Studio…', c: DIM });
      return true;
    case 'logout':
      await useDev.getState().logout();
      ctx.print('Logged out of Dev Mode.');
      return true;
    case 'exit':
      if ((args[0] ?? '').toLowerCase() !== 'devmode') return false;
      await useDev.getState().logout();
      ctx.print('Logged out of Dev Mode.');
      return true;
    default:
      return false;
  }
}
