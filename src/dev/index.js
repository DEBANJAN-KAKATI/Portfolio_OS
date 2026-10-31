/**
 * Dev Mode module, imported lazily by src/os/devmode.js after a valid session
 * check. The shell calls into it for menus, drops and the overlay chrome.
 */
import { Pencil, PenLine, EyeOff, Eye, Star, Copy, Trash2, Info, Plus, Wrench, LayoutGrid, Pin, PinOff, X, ClipboardPaste, Wallpaper } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useMenu } from '@/os/ui/ContextMenu.jsx';
import { setCsrf } from './api.js';
import { useStaging } from './store.js';
import { SECTIONS } from './sections.js';
import { deleteItem, toggleHidden, toggleFeatured, duplicateItem, togglePin, saveDesktopLayout, setDefaultWallpaper } from './actions.js';
import DevRoot, { useDevUi, openStudio, readTransfer } from './DevRoot.jsx';

export { DevRoot };
export { terminal } from './terminal.js';

export function start(session) {
  setCsrf(session.csrf);
  useStaging.getState().load();
}

export function stop() {
  setCsrf(null);
  useDevUi.setState({ quickAdd: null, drop: null, rename: null, props: null });
  useData.getState().resetOverlay();
}

const ui = (patch) => useDevUi.getState().set(patch);
const NEW_TYPES = ['projects', 'experiences', 'skills', 'education', 'achievements', 'hobbies', 'casualWorks', 'photos', 'videos', 'models', 'renders', 'shortcuts'];

/** Menu entries for one content item (shared by app windows and the desktop). */
function itemEntries(secKey, item) {
  const sec = SECTIONS[secKey];
  const flags = sec.fields.some((f) => f.key === 'hidden');
  const feature = sec.fields.some((f) => f.key === 'featured');
  return [
    { label: 'Edit in Portfolio Studio', icon: Pencil, onSelect: () => openStudio(secKey, item.id) },
    { label: 'Rename', icon: PenLine, onSelect: () => ui({ rename: { secKey, item } }) },
    ...(flags ? [{ label: item.hidden ? 'Show to visitors' : 'Hide from visitors', icon: item.hidden ? Eye : EyeOff, onSelect: () => toggleHidden(secKey, item) }] : []),
    ...(feature ? [{ label: item.featured ? 'Unfeature' : 'Feature', icon: Star, onSelect: () => toggleFeatured(secKey, item) }] : []),
    { label: 'Duplicate', icon: Copy, onSelect: () => duplicateItem(secKey, item) },
    { separator: true },
    { label: 'Delete', icon: Trash2, onSelect: () => deleteItem(secKey, item) },
    { label: 'Properties', icon: Info, onSelect: () => ui({ props: { secKey, item } }) },
  ];
}

/** Right-click on a project/experience/etc. inside an app window. */
export function openItemMenu(e, secKey, item) {
  if (!SECTIONS[secKey] || !item) return;
  useMenu.getState().open(e, itemEntries(secKey, item));
}

/** Desktop icon menu: visitor entries + pins / shortcut editing. */
export function iconMenu(items, item) {
  const layout = useData.getState().layout;
  if (item.kind === 'shortcut') {
    const sc = layout.shortcuts.find((s) => s.id === item.id);
    return [...items, { separator: true }, ...(sc ? itemEntries('shortcuts', sc) : [])];
  }
  const onTaskbar = layout.pinnedTaskbar.includes(item.appId);
  const onStart = layout.pinnedStart.includes(item.appId);
  return [
    ...items,
    { separator: true },
    { label: onTaskbar ? 'Unpin from taskbar (for visitors)' : 'Pin to taskbar (for visitors)', icon: onTaskbar ? PinOff : Pin, onSelect: () => togglePin('taskbar', item.appId) },
    { label: onStart ? 'Unpin from Start (for visitors)' : 'Pin to Start (for visitors)', icon: onStart ? PinOff : Pin, onSelect: () => togglePin('start', item.appId) },
    ...(item.appId !== 'recycle'
      ? [{ label: 'Remove from desktop (for visitors)', icon: X, onSelect: () => useStaging.getState().editDoc('layout', (l) => (l.desktopIcons = l.desktopIcons.filter((i) => i.app !== item.appId)), `Remove ${item.title} from desktop`) }]
      : []),
  ];
}

/** Desktop background menu: real "New" content types + layout tools. */
export function desktopMenu(items, { positions, items: desktopItems }) {
  const wallpapers = useData.getState().media.wallpapers;
  const current = useData.getState().layout.defaultWallpaper;
  const replaced = items.map((it) =>
    it.label === 'New'
      ? { ...it, items: NEW_TYPES.map((k) => ({ label: SECTIONS[k].one, icon: Plus, onSelect: () => ui({ quickAdd: { secKey: k, initial: {} } }) })) }
      : it,
  );
  return [
    ...replaced,
    { separator: true },
    { label: 'Portfolio Studio', icon: Wrench, onSelect: () => openStudio('dashboard') },
    {
      label: 'Paste',
      icon: ClipboardPaste,
      onSelect: async () => {
        try {
          const text = await navigator.clipboard.readText();
          const { links } = readTransfer({ getData: (t) => (t === 'text/plain' ? text : '') });
          if (links.length) ui({ drop: { files: [], links, key: Date.now() } });
        } catch {
          /* clipboard permission denied: Ctrl+V still works */
        }
      },
    },
    { label: 'Save icon layout as default', icon: LayoutGrid, onSelect: () => saveDesktopLayout(positions, desktopItems) },
    {
      label: 'Wallpaper for visitors',
      icon: Wallpaper,
      items: [
        { label: 'Automatic (time of day)', checked: current === 'auto', onSelect: () => setDefaultWallpaper('auto') },
        { separator: true },
        ...wallpapers.map((w) => ({ label: w.name, checked: current === w.id, onSelect: () => setDefaultWallpaper(w.id) })),
      ],
    },
  ];
}

/** Files or links dropped on the desktop. */
export function handleDrop(dataTransfer) {
  const { files, links } = readTransfer(dataTransfer);
  if (files.length || links.length) ui({ drop: { files, links, key: Date.now() } });
}

/** Shortcuts dragged onto the Recycle Bin. */
export function deleteShortcuts(ids) {
  const list = useData.getState().layout.shortcuts;
  for (const id of ids) {
    const sc = list.find((s) => s.id === id);
    if (sc) deleteItem('shortcuts', sc);
  }
}
