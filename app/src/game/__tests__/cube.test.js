import { describe, it, expect } from 'vitest';
import {
  newCube, canDouble, promiseDouble, acceptDouble, declineDouble,
  shouldAcceptDouble, CUBE_CAP,
} from '../cube.js';

describe('cube state', () => {
  it('starts centered at value 1', () => {
    expect(newCube()).toEqual({
      value: 1, owner: null, promised: null, used: { white: false, black: false },
    });
  });
});

describe('canDouble', () => {
  it('true initially for either player', () => {
    const c = newCube();
    expect(canDouble(c, 'white')).toBe(true);
    expect(canDouble(c, 'black')).toBe(true);
  });

  it('false once a player has used their once-per-game double', () => {
    const c = { ...newCube(), used: { white: true, black: false } };
    expect(canDouble(c, 'white')).toBe(false);
    expect(canDouble(c, 'black')).toBe(true);
  });

  it('false at the cap', () => {
    const c = { ...newCube(), value: CUBE_CAP };
    expect(canDouble(c, 'white')).toBe(false);
  });

  it('false when the opponent has already promised', () => {
    const c = { ...newCube(), promised: 'black' };
    expect(canDouble(c, 'white')).toBe(false);
    expect(canDouble(c, 'black')).toBe(true); // the promiser may still proceed
  });
});

describe('promiseDouble', () => {
  it('records the promise when allowed, no-ops otherwise', () => {
    expect(promiseDouble(newCube(), 'white').promised).toBe('white');
    const used = { ...newCube(), used: { white: true, black: false } };
    expect(promiseDouble(used, 'white')).toBe(used); // unchanged
  });
});

describe('acceptDouble', () => {
  it('doubles the value (capped), flips ownership, spends the offerer double', () => {
    const c = promiseDouble(newCube(), 'white');
    const after = acceptDouble(c, 'white');
    expect(after.value).toBe(2);
    expect(after.owner).toBe('black');
    expect(after.used.white).toBe(true);
    expect(after.promised).toBeNull();
  });

  it('caps the value at 4', () => {
    const c = { ...newCube(), value: 2 };
    expect(acceptDouble(c, 'black').value).toBe(4);
  });

  it('clamps to the cap even when value*2 would exceed it', () => {
    const c = { ...newCube(), value: 4 };
    expect(acceptDouble(c, 'black').value).toBe(4); // min(8, 4)
  });
});

describe('declineDouble', () => {
  it('offerer wins the pre-double value as a simple game', () => {
    const c = { ...newCube(), value: 2, promised: 'white' };
    const { cube, outcome } = declineDouble(c, 'white');
    expect(outcome).toEqual({ winner: 'white', winType: 'simple', points: 2 });
    expect(cube.promised).toBeNull();
  });
});

describe('shouldAcceptDouble', () => {
  it('accepts unless in marked disadvantage (threshold -25, exclusive)', () => {
    expect(shouldAcceptDouble(-10)).toBe(true);
    expect(shouldAcceptDouble(0)).toBe(true);
    expect(shouldAcceptDouble(-25)).toBe(false);
    expect(shouldAcceptDouble(-30)).toBe(false);
  });
});
