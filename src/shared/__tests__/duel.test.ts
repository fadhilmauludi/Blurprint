import { describe, expect, it } from 'vitest';
import { duelShareData, isDuelId, parseDuelShare } from '../duel';

describe('duel share data', () => {
  it('round-trips a valid id', () => {
    expect(parseDuelShare(duelShareData('abc123xyz0'))).toBe('abc123xyz0');
  });
  it('rejects tampered or foreign payloads', () => {
    expect(parseDuelShare(undefined)).toBeNull();
    expect(parseDuelShare('not json')).toBeNull();
    expect(parseDuelShare(JSON.stringify({ t: 'duel', id: '../../etc' }))).toBeNull();
    expect(parseDuelShare(JSON.stringify({ t: 'other', id: 'abc123xyz0' }))).toBeNull();
    expect(parseDuelShare(JSON.stringify({ t: 'duel', id: 'ABC123XYZ0' }))).toBeNull();
    expect(parseDuelShare('x'.repeat(2000))).toBeNull();
    expect(isDuelId('abc123xyz0')).toBe(true);
    expect(isDuelId(42)).toBe(false);
  });
});
