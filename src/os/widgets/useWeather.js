import { useEffect } from 'react';
import { create } from 'zustand';
import config from '@config';
import { load, save } from '../lib/storage.js';

const CACHE_KEY = 'os.weather';
const TTL = 30 * 60 * 1000;

// WMO weather codes used by Open-Meteo.
export function describeWeather(code) {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  return 'Thunderstorm';
}

const useWeatherStore = create(() => ({ data: load(CACHE_KEY, null), loading: false }));

async function refresh() {
  const { data, loading } = useWeatherStore.getState();
  if (loading || (data && Date.now() - data.fetchedAt < TTL)) return;
  useWeatherStore.setState({ loading: true });
  const { latitude, longitude, label } = config.owner.weather;
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      '&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,is_day' +
      '&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=4';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const next = {
      fetchedAt: Date.now(),
      label,
      temperature: j.current.temperature_2m,
      code: j.current.weather_code,
      humidity: j.current.relative_humidity_2m,
      wind: j.current.wind_speed_10m,
      isDay: j.current.is_day === 1,
      daily: j.daily.time.map((d, i) => ({ date: d, max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], code: j.daily.weather_code[i] })),
    };
    save(CACHE_KEY, next);
    useWeatherStore.setState({ data: next, loading: false });
  } catch {
    useWeatherStore.setState({ loading: false }); // keep any stale cache; widget shows "unavailable" otherwise
  }
}

/** Owner's current weather, or null while loading / offline. */
export function useWeather() {
  const data = useWeatherStore((s) => s.data);
  useEffect(() => {
    refresh();
  }, []);
  return data;
}
