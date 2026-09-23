import { describe, it, expect } from 'vitest';
import { clientEnvDefine, publicEnvNames, PUBLIC_ENV_PREFIX } from './env.js';

describe('clientEnvDefine', () => {
  it('always defines NODE_ENV as the build mode', () => {
    const dev = clientEnvDefine('development', {});
    expect(dev['process.env.NODE_ENV']).toBe(JSON.stringify('development'));
    const prod = clientEnvDefine('production', {});
    expect(prod['process.env.NODE_ENV']).toBe(JSON.stringify('production'));
  });

  it('exposes STREETUI_PUBLIC_* variables to the browser bundle', () => {
    const define = clientEnvDefine('production', {
      STREETUI_PUBLIC_API: 'https://api.example.com',
    });
    expect(define['process.env.STREETUI_PUBLIC_API']).toBe(
      JSON.stringify('https://api.example.com'),
    );
  });

  it('never exposes non-public (secret) variables', () => {
    const define = clientEnvDefine('production', {
      DATABASE_URL: 'postgres://secret',
      SECRET_KEY: 'nope',
      STREETUI_PUBLIC_OK: 'yes',
    });
    expect(define['process.env.DATABASE_URL']).toBeUndefined();
    expect(define['process.env.SECRET_KEY']).toBeUndefined();
    expect(define['process.env.STREETUI_PUBLIC_OK']).toBe(JSON.stringify('yes'));
  });
});

describe('publicEnvNames', () => {
  it('lists only the public variable names', () => {
    const names = publicEnvNames({
      STREETUI_PUBLIC_A: '1',
      STREETUI_PUBLIC_B: '2',
      PRIVATE: '3',
    });
    expect(names.sort()).toEqual(['STREETUI_PUBLIC_A', 'STREETUI_PUBLIC_B']);
  });
});

describe('PUBLIC_ENV_PREFIX', () => {
  it('is the documented prefix', () => {
    expect(PUBLIC_ENV_PREFIX).toBe('STREETUI_PUBLIC_');
  });
});
