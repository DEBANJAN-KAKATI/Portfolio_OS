/**
 * Every app the OS knows about. Components are lazy-loaded so each app is its
 * own chunk. Phase 2 points content apps at a placeholder; later phases swap in
 * the real modules without touching the shell.
 */
import { lazy } from 'react';
import {
  User, FolderGit2, Briefcase, Activity, Trophy, GraduationCap, NotebookPen, Heart, Image, Clapperboard,
  Box, SquareTerminal, Gamepad2, Mail, FileText, RefreshCw, Settings, Palette, Trash2, Wrench, Globe,
} from 'lucide-react';

const placeholder = () => import('@/apps/Placeholder.jsx');

/**
 * @typedef {object} AppDef
 * @property {string} id
 * @property {string} title
 * @property {import('react').ComponentType} icon      lucide glyph drawn on a coloured tile
 * @property {[string, string]} colors                 tile gradient
 * @property {() => Promise<{default: any}>} load
 * @property {{w:number,h:number}} size                default window size
 * @property {{w:number,h:number}} [minSize]
 * @property {boolean} [single]                        only one window at a time
 * @property {string[]} [keywords]                     extra search terms
 * @property {boolean} [devOnly]                       Dev Mode only: hidden from Start, search and the terminal
 */

/** @type {AppDef[]} */
const APPS = [
  { id: 'about', title: 'About Me', icon: User, colors: ['#4f9cff', '#1f5fd1'], load: placeholder, size: { w: 720, h: 520 }, single: true, keywords: ['profile', 'bio', 'notepad', 'system properties'] },
  { id: 'projects', title: 'Projects', icon: FolderGit2, colors: ['#ffd25a', '#f0a518'], load: placeholder, size: { w: 980, h: 640 }, single: true, keywords: ['github', 'repos', 'portfolio', 'file explorer'] },
  { id: 'experience', title: 'Work Experience', icon: Briefcase, colors: ['#c79565', '#8d5b32'], load: placeholder, size: { w: 900, h: 600 }, single: true, keywords: ['jobs', 'internship', 'career', 'timeline'] },
  { id: 'skills', title: 'Task Manager', icon: Activity, colors: ['#4fd18b', '#16884d'], load: placeholder, size: { w: 880, h: 600 }, single: true, keywords: ['skills', 'tech stack', 'performance'] },
  { id: 'achievements', title: 'Achievements', icon: Trophy, colors: ['#ffcf4d', '#d68a00'], load: placeholder, size: { w: 860, h: 600 }, single: true, keywords: ['awards', 'patents', 'certifications', 'trophy'] },
  { id: 'education', title: 'Education', icon: GraduationCap, colors: ['#8b8bff', '#4b3fcf'], load: placeholder, size: { w: 820, h: 560 }, single: true, keywords: ['university', 'coursework', 'bits pilani', 'system information'] },
  { id: 'casual', title: 'Casual Works', icon: NotebookPen, colors: ['#ff9f6b', '#e0582b'], load: placeholder, size: { w: 860, h: 580 }, single: true, keywords: ['experiments', 'blog', 'doodles', 'my documents'] },
  { id: 'hobbies', title: 'Hobbies', icon: Heart, colors: ['#ff7aa8', '#d6336c'], load: placeholder, size: { w: 760, h: 520 }, single: true, keywords: ['music', 'gaming', 'fun'] },
  { id: 'photos', title: 'Photos', icon: Image, colors: ['#5cc8ff', '#1a7fd1'], load: placeholder, size: { w: 920, h: 620 }, single: true, keywords: ['gallery', 'pictures'] },
  { id: 'videos', title: 'Media Player', icon: Clapperboard, colors: ['#ff6b6b', '#c92a2a'], load: placeholder, size: { w: 900, h: 600 }, single: true, keywords: ['videos', 'youtube'] },
  { id: 'viewer3d', title: '3D Viewer', icon: Box, colors: ['#b18cff', '#6f3fd8'], load: placeholder, size: { w: 920, h: 640 }, single: true, keywords: ['3d', 'models', 'renders', 'blender'] },
  { id: 'terminal', title: 'Command Prompt', icon: SquareTerminal, colors: ['#4a4a4a', '#141414'], load: placeholder, size: { w: 760, h: 480 }, minSize: { w: 420, h: 260 }, keywords: ['cmd', 'terminal', 'shell', 'console'] },
  { id: 'browser', title: 'Browser', icon: Globe, colors: ['#4fb6ff', '#0a64c8'], load: placeholder, size: { w: 1000, h: 680 }, minSize: { w: 480, h: 320 }, keywords: ['web', 'edge', 'internet', 'test', 'relay', 'proxy'] },
  { id: 'games', title: 'Games', icon: Gamepad2, colors: ['#7ee36a', '#2f9e44'], load: placeholder, size: { w: 760, h: 560 }, single: true, keywords: ['minesweeper', 'snake', 'tic tac toe', 'memory'] },
  { id: 'mail', title: 'Mail', icon: Mail, colors: ['#5aa9ff', '#0a64c8'], load: placeholder, size: { w: 880, h: 600 }, single: true, keywords: ['contact', 'email', 'hire', 'message', 'outlook'] },
  { id: 'resume', title: 'Resume', icon: FileText, colors: ['#ff6b5a', '#c4321f'], load: placeholder, size: { w: 860, h: 680 }, single: true, keywords: ['cv', 'pdf'] },
  { id: 'update', title: 'Windows Update', icon: RefreshCw, colors: ['#4fb6ff', '#0067c0'], load: placeholder, size: { w: 760, h: 560 }, single: true, keywords: ['sync', 'changelog', 'updates'] },
  { id: 'settings', title: 'Settings', icon: Settings, colors: ['#9aa4b2', '#5b6573'], load: placeholder, size: { w: 900, h: 620 }, single: true, keywords: ['theme', 'wallpaper', 'accent', 'dark mode', 'personalize'] },
  { id: 'paint', title: 'Paint', icon: Palette, colors: ['#ffb84d', '#e8590c'], load: placeholder, size: { w: 860, h: 600 }, single: true, keywords: ['draw', 'doodle', 'canvas'] },
  { id: 'studio', title: 'Portfolio Studio', icon: Wrench, colors: ['#6ee7b7', '#0f766e'], load: placeholder, size: { w: 1120, h: 720 }, minSize: { w: 520, h: 360 }, single: true, devOnly: true },
  { id: 'recycle', title: 'Recycle Bin', icon: Trash2, colors: ['#a5d8ff', '#4c8fd6'], load: placeholder, size: { w: 720, h: 480 }, single: true, keywords: ['trash', 'bin', 'ideas', 'bugs'] },
];

// Real app modules; anything not listed still uses the placeholder (Phases 4, 7, 8).
const LOADERS = {
  about: () => import('@/apps/About.jsx'),
  projects: () => import('@/apps/Projects.jsx'),
  experience: () => import('@/apps/Experience.jsx'),
  skills: () => import('@/apps/TaskManager.jsx'),
  achievements: () => import('@/apps/Achievements.jsx'),
  education: () => import('@/apps/Education.jsx'),
  casual: () => import('@/apps/CasualWorks.jsx'),
  hobbies: () => import('@/apps/Hobbies.jsx'),
  mail: () => import('@/apps/Mail.jsx'),
  resume: () => import('@/apps/Resume.jsx'),
  settings: () => import('@/apps/Settings.jsx'),
  paint: () => import('@/apps/Paint.jsx'),
  recycle: () => import('@/apps/RecycleBin.jsx'),
  update: () => import('@/apps/update/WindowsUpdate.jsx'),
  terminal: () => import('@/apps/terminal/Terminal.jsx'),
  browser: () => import('@/apps/browser/Browser.jsx'),
  viewer3d: () => import('@/apps/viewer3d/Viewer3D.jsx'),
  photos: () => import('@/apps/Photos.jsx'),
  videos: () => import('@/apps/MediaPlayer.jsx'),
  studio: () => import('@/dev/studio/Studio.jsx'),
};

// Fluent color icons (src/os/icons/fluent/<app id>.svg), bundled as asset URLs.
const ICON_FILES = import.meta.glob('../icons/fluent/*.svg', { eager: true, query: '?url', import: 'default' });
const iconUrl = (id) => ICON_FILES[`../icons/fluent/${id}.svg`] ?? null;

const byId = new Map(
  APPS.map((a) => {
    const load = LOADERS[a.id] ?? a.load;
    return [a.id, { ...a, load, iconUrl: iconUrl(a.id), component: lazy(load), minSize: a.minSize ?? { w: 360, h: 240 } }];
  }),
);

/** Apps visitors can find (Start, search, terminal). getApp() still resolves Dev Mode apps. */
export const apps = [...byId.values()].filter((a) => !a.devOnly);
export const getApp = (id) => byId.get(id);
