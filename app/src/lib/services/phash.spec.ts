import { describe, it, expect } from 'vitest';
import type { PaiHashMap } from '../types.js';
import { findClosestMatch, EmptyHashMapError } from './phash.js';

describe('findClosestMatch', () => {
  it('完全一致するエントリを返す', () => {
    const hashMap: PaiHashMap = {
      'pai_001.png': 'abcd1234abcd1234',
      'pai_002.png': '1234abcd1234abcd',
    };

    const result = findClosestMatch('abcd1234abcd1234', hashMap);

    expect(result.paiId).toBe('pai_001.png');
    expect(result.distance).toBe(0);
  });

  it('最も距離が近いエントリを返す', () => {
    const hashMap: PaiHashMap = {
      'pai_a.png': '0000000000000000', // 距離1
      'pai_b.png': 'ffffffffffffffff', // 距離63
    };

    const result = findClosestMatch('0000000000000001', hashMap);

    expect(result.paiId).toBe('pai_a.png');
    expect(result.distance).toBe(1);
  });

  it('1エントリのhashMapでも動作する', () => {
    const hashMap: PaiHashMap = { 'only.png': '1234abcd1234abcd' };

    const result = findClosestMatch('abcd1234abcd1234', hashMap);

    expect(result.paiId).toBe('only.png');
    expect(result.distance).toBeGreaterThanOrEqual(0);
    expect(result.distance).toBeLessThanOrEqual(64);
  });

  it('同一距離の複数候補がある場合も確定的に返す', () => {
    const hashMap: PaiHashMap = {
      'pai_a.png': '0000000000000001', // 距離1
      'pai_b.png': '0000000000000002', // 距離1
    };

    const result1 = findClosestMatch('0000000000000000', hashMap);
    const result2 = findClosestMatch('0000000000000000', hashMap);

    expect(result1.distance).toBe(1);
    expect(result1.paiId).toBe(result2.paiId);
  });

  it('空のhashMapでEmptyHashMapErrorをスローする', () => {
    expect(() => findClosestMatch('abcd1234abcd1234', {})).toThrow(EmptyHashMapError);
  });
});
