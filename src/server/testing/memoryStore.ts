import type { Store } from '../store';

type Value = { kind: 'str'; v: string } | { kind: 'hash'; v: Map<string, string> } | { kind: 'zset'; v: Map<string, number> };

/**
 * In-memory implementation of `Store` with Devvit Redis semantics for the
 * commands we use. Used by unit tests and the local browser harness.
 */
export class MemoryStore implements Store {
  private data = new Map<string, Value>();
  private expiry = new Map<string, number>();
  constructor(private readonly clock: () => number = () => Date.now()) {}

  /** Test helper: raw key listing. */
  keys(): string[] {
    this.sweep();
    return [...this.data.keys()].sort();
  }

  private sweep(): void {
    const now = this.clock();
    for (const [k, t] of this.expiry) {
      if (t <= now) {
        this.data.delete(k);
        this.expiry.delete(k);
      }
    }
  }
  private read(key: string): Value | undefined {
    this.sweep();
    return this.data.get(key);
  }
  private str(key: string): string | undefined {
    const v = this.read(key);
    if (!v) return undefined;
    if (v.kind !== 'str') throw new Error(`WRONGTYPE ${key}`);
    return v.v;
  }
  private hash(key: string, create: boolean): Map<string, string> | undefined {
    const v = this.read(key);
    if (v) {
      if (v.kind !== 'hash') throw new Error(`WRONGTYPE ${key}`);
      return v.v;
    }
    if (!create) return undefined;
    const m = new Map<string, string>();
    this.data.set(key, { kind: 'hash', v: m });
    return m;
  }
  private zset(key: string, create: boolean): Map<string, number> | undefined {
    const v = this.read(key);
    if (v) {
      if (v.kind !== 'zset') throw new Error(`WRONGTYPE ${key}`);
      return v.v;
    }
    if (!create) return undefined;
    const m = new Map<string, number>();
    this.data.set(key, { kind: 'zset', v: m });
    return m;
  }
  private sorted(key: string): { member: string; score: number }[] {
    const z = this.zset(key, false);
    if (!z) return [];
    return [...z.entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => a.score - b.score || (a.member < b.member ? -1 : a.member > b.member ? 1 : 0));
  }

  async get(key: string): Promise<string | undefined> {
    return this.str(key);
  }
  async set(key: string, value: string, options?: { nx?: boolean; xx?: boolean; expiration?: Date }): Promise<string> {
    const exists = this.read(key) !== undefined;
    if (options?.nx && exists) return '';
    if (options?.xx && !exists) return '';
    this.data.set(key, { kind: 'str', v: value });
    if (options?.expiration) this.expiry.set(key, options.expiration.getTime());
    else this.expiry.delete(key);
    return 'OK';
  }
  async del(...keys: string[]): Promise<void> {
    for (const k of keys) {
      this.data.delete(k);
      this.expiry.delete(k);
    }
  }
  async incrBy(key: string, value: number): Promise<number> {
    const n = Number(this.str(key) ?? '0') + value;
    this.data.set(key, { kind: 'str', v: String(n) });
    return n;
  }
  async mGet(keys: string[]): Promise<(string | null)[]> {
    return keys.map((k) => {
      const v = this.read(k);
      return v && v.kind === 'str' ? v.v : null;
    });
  }
  async expire(key: string, seconds: number): Promise<void> {
    if (this.read(key)) this.expiry.set(key, this.clock() + seconds * 1000);
  }
  async hGet(key: string, field: string): Promise<string | undefined> {
    return this.hash(key, false)?.get(field);
  }
  async hSet(key: string, fieldValues: { [field: string]: string }): Promise<number> {
    const h = this.hash(key, true)!;
    let added = 0;
    for (const [f, v] of Object.entries(fieldValues)) {
      if (!h.has(f)) added++;
      h.set(f, v);
    }
    return added;
  }
  async hSetNX(key: string, field: string, value: string): Promise<number> {
    const h = this.hash(key, true)!;
    if (h.has(field)) return 0;
    h.set(field, value);
    return 1;
  }
  async hGetAll(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(this.hash(key, false) ?? []);
  }
  async hIncrBy(key: string, field: string, value: number): Promise<number> {
    const h = this.hash(key, true)!;
    const n = Number(h.get(field) ?? '0') + value;
    h.set(field, String(n));
    return n;
  }
  async hDel(key: string, fields: string[]): Promise<number> {
    const h = this.hash(key, false);
    if (!h) return 0;
    let n = 0;
    for (const f of fields) if (h.delete(f)) n++;
    return n;
  }
  async hMGet(key: string, fields: string[]): Promise<(string | null)[]> {
    const h = this.hash(key, false);
    return fields.map((f) => h?.get(f) ?? null);
  }
  async zAdd(key: string, ...members: { member: string; score: number }[]): Promise<number> {
    const z = this.zset(key, true)!;
    let added = 0;
    for (const m of members) {
      if (!z.has(m.member)) added++;
      z.set(m.member, m.score);
    }
    return added;
  }
  async zIncrBy(key: string, member: string, value: number): Promise<number> {
    const z = this.zset(key, true)!;
    const n = (z.get(member) ?? 0) + value;
    z.set(member, n);
    return n;
  }
  async zRange(
    key: string,
    start: number | string,
    stop: number | string,
    options?: { reverse?: boolean; by: 'score' | 'lex' | 'rank' }
  ): Promise<{ member: string; score: number }[]> {
    if (options && options.by !== 'rank') throw new Error('MemoryStore.zRange: only by rank is implemented');
    const list = this.sorted(key);
    if (options?.reverse) list.reverse();
    const n = list.length;
    let s = Number(start);
    let e = Number(stop);
    if (s < 0) s = n + s;
    if (e < 0) e = n + e;
    return list.slice(Math.max(0, s), Math.max(0, e + 1));
  }
  async zRank(key: string, member: string): Promise<number | undefined> {
    const i = this.sorted(key).findIndex((m) => m.member === member);
    return i < 0 ? undefined : i;
  }
  async zScore(key: string, member: string): Promise<number | undefined> {
    return this.zset(key, false)?.get(member);
  }
  async zCard(key: string): Promise<number> {
    return this.zset(key, false)?.size ?? 0;
  }
  async zRem(key: string, members: string[]): Promise<number> {
    const z = this.zset(key, false);
    if (!z) return 0;
    let n = 0;
    for (const m of members) if (z.delete(m)) n++;
    return n;
  }
}
