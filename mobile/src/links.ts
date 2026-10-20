export function inviteFromUrl(value: string, apiOrigin: string, scheme = 'socialplays'): string | null {
  try {
    const url = new URL(value);
    const native = url.protocol === `${scheme}:` && url.hostname === 'invite';
    const web = url.protocol === 'https:' && url.origin === new URL(apiOrigin).origin;
    if (!native && !web) return null;
    const token = native ? url.pathname.slice(1) : url.searchParams.get('invite');
    return token && /^[0-9a-f-]{72}$/.test(token) ? token : null;
  } catch { return null; }
}
