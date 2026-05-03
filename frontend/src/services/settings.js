const KEY = 'viberater_settings';

const DEFAULTS = {
  batchGapSeconds: 5,
};

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

function save(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export function getSetting(key) {
  return load()[key] ?? DEFAULTS[key];
}

export function setSetting(key, value) {
  save({ ...load(), [key]: value });
}
