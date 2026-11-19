/**
 * Stand-in for `@devvit/web/client` in the standalone demo page. There is no
 * Reddit here: navigation and login show a note, the share sheet brings in a
 * computer rival, and "realtime" is delivered in-page by the demo server.
 */
import { readSettings } from './settings';

type Toast = { text: string; appearance?: 'neutral' | 'success' };

const player = readSettings().player;

export const context = {
  postId: 'demo_post',
  postData: { day: readSettings().day },
  username: player,
  userId: `t2_${player}`,
  subredditName: 'blurprint',
};

export const toast = (text: string): void => {
  const el = document.createElement('div');
  el.className = 'demo-toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
};

export const showToast = (t: string | Toast): void => toast(typeof t === 'string' ? t : t.text);
export const showLoginPrompt = (): void => toast('In the demo you are always logged in.');
export const navigateTo = (_url: string | { url: string }): void => toast('That opens Reddit — not available in this demo.');
export const requestExpandedMode = (): void => undefined;
export const exitExpandedMode = (): void => undefined;
export const getWebViewMode = (): 'expanded' => 'expanded';
export const getShareData = (): string | undefined => undefined;

/** The demo server listens for this to send a computer rival into the duel. */
export const showShareSheet = async (opts: { data?: string }): Promise<void> => {
  window.dispatchEvent(new CustomEvent('bp-invite', { detail: opts.data ?? '' }));
  toast('Demo: no friends here, so a computer rival accepts your duel…');
};

type Listener = (msg: unknown) => void;
const channels = new Map<string, Set<Listener>>();

export const connectRealtime = (opts: { channel: string; onMessage: Listener }) => {
  const set = channels.get(opts.channel) ?? new Set<Listener>();
  set.add(opts.onMessage);
  channels.set(opts.channel, set);
  return { disconnect: async () => void set.delete(opts.onMessage) };
};
export const disconnectRealtime = (channel: string): void => void channels.delete(channel);

/** Called by the demo server's platform.publish. */
export const deliverRealtime = (channel: string, msg: unknown): void => {
  channels.get(channel)?.forEach((l) => l(msg));
};
