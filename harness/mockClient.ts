/**
 * Local stand-in for `@devvit/web/client` (harness only — never bundled into
 * the app). Identity and post are chosen with URL params: ?user=alice&post=2
 */
type Toast = { text: string; appearance?: 'neutral' | 'success' };

const params = new URLSearchParams(location.search);
const user = params.get('user') ?? 'alice';
const post = params.get('post');
document.cookie = `bp_user=${user}; path=/`;
if (post !== null) document.cookie = `bp_post=${post}; path=/`;
else document.cookie = 'bp_post=; path=/; max-age=0';

const banner = (text: string) => {
  const el = document.createElement('div');
  el.textContent = text;
  el.setAttribute('data-harness-toast', '');
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    bottom: '16px',
    transform: 'translateX(-50%)',
    background: '#111',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: '8px',
    font: '14px system-ui',
    zIndex: '9999',
    maxWidth: '90vw',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
};

export const context = {
  postId: post !== null ? `harness_day${post}` : undefined,
  postData: post !== null ? { day: Number(post) } : undefined,
  username: user === 'anon' ? undefined : user,
  userId: user === 'anon' ? undefined : `t2_${user}`,
  subredditName: 'blurprint_dev',
};

export const requestExpandedMode = (_e: MouseEvent, entry: string) => {
  location.href = `/${entry}.html${location.search}`;
};
export const exitExpandedMode = () => history.back();
export const getWebViewMode = () => (location.pathname.includes('splash') ? 'inline' : 'expanded');
export const navigateTo = (url: string | { url: string }) => banner(`navigateTo → ${typeof url === 'string' ? url : url.url}`);
export const showToast = (t: string | Toast) => banner(typeof t === 'string' ? t : t.text);
export const showLoginPrompt = () => banner('showLoginPrompt()');

/** ?duel=<id> simulates opening a duel invite link. */
export const getShareData = (): string | undefined => {
  const id = params.get('duel');
  return id ? JSON.stringify({ t: 'duel', id }) : undefined;
};
export const showShareSheet = async (opts: { data?: string; title?: string; text?: string }) => {
  Object.assign(window, { __lastShare: opts });
  banner(`showShareSheet → ${opts.data ?? ''}`);
};
/** Realtime is not simulated locally: the duel screen falls back to polling. */
export const connectRealtime = (opts: { channel: string }) => {
  Object.assign(window, { __realtimeChannel: opts.channel });
  return { disconnect: async () => undefined };
};
export const disconnectRealtime = (_channel: string) => undefined;
