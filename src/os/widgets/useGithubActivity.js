/**
 * Live GitHub activity for the widgets panel (unauthenticated, cached 30 min so
 * visitors stay far below the 60 requests/hour limit).
 *  - pushes:        api.github.com public events
 *  - contributions: github-contributions-api.jogruber.de (public mirror of the profile
 *                   graph; GitHub's own API needs a token). Phase 4's sync can bake this
 *                   into portfolio.json instead.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import config from '@config';
import { load, save } from '../lib/storage.js';

const KEY = 'os.githubActivity';
const TTL = 30 * 60 * 1000;
const user = config.owner.githubUser;

const useStore = create(() => ({ data: load(KEY, null), loading: false, error: false }));

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function refresh() {
  const { data, loading } = useStore.getState();
  if (loading || (data && Date.now() - data.fetchedAt < TTL)) return;
  useStore.setState({ loading: true });
  const [events, contrib] = await Promise.allSettled([
    getJson(`https://api.github.com/users/${user}/events/public?per_page=40`),
    getJson(`https://github-contributions-api.jogruber.de/v4/${user}?y=last`),
  ]);
  const pushes =
    events.status === 'fulfilled'
      ? events.value
          .filter((e) => e.type === 'PushEvent')
          .slice(0, 6)
          .map((e) => ({
            repo: e.repo.name.split('/')[1],
            url: `https://github.com/${e.repo.name}`,
            commits: e.payload?.size ?? e.payload?.commits?.length ?? 1,
            message: e.payload?.commits?.at(-1)?.message?.split('\n')[0] ?? null,
            at: e.created_at,
          }))
      : data?.pushes ?? [];
  const contributions =
    contrib.status === 'fulfilled'
      ? { total: contrib.value.total?.lastYear ?? null, days: contrib.value.contributions.map((d) => ({ date: d.date, count: d.count, level: d.level })) }
      : data?.contributions ?? null;
  const next = { fetchedAt: Date.now(), pushes, contributions };
  save(KEY, next);
  useStore.setState({ data: next, loading: false, error: events.status === 'rejected' && contrib.status === 'rejected' });
}

export function useGithubActivity() {
  const state = useStore();
  useEffect(() => {
    refresh();
  }, []);
  return state;
}
