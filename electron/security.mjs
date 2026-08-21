const SAFE_EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:']);

function parseUrl(value) {
  try {
    return new URL(value);
  } catch (_) {
    return null;
  }
}

export function isAllowedExternalUrl(value) {
  const url = parseUrl(value);
  return Boolean(url && SAFE_EXTERNAL_PROTOCOLS.has(url.protocol));
}

export function isAllowedRendererNavigation(value, { isDev = false, packagedEntryUrl = null } = {}) {
  const url = parseUrl(value);
  if (!url) return false;

  if (isDev) {
    const isViteHost = (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && url.port === '5173';
    return url.protocol === 'http:' && isViteHost;
  }

  const packagedEntry = parseUrl(packagedEntryUrl);
  return url.protocol === 'file:'
    && packagedEntry?.protocol === 'file:'
    && url.href === packagedEntry.href;
}
