import { describe, expect, test } from 'bun:test';

import { devApiUrlFrom } from './dev-api-url';

describe('devApiUrlFrom', () => {
  test('the Metro host on the API port', () => {
    expect(devApiUrlFrom('172.24.180.102:8081')).toBe('http://172.24.180.102:3000');
    expect(devApiUrlFrom('192.168.0.5:8081')).toBe('http://192.168.0.5:3000');
    expect(devApiUrlFrom('10.0.2.2:8081')).toBe('http://10.0.2.2:3000');
    expect(devApiUrlFrom('localhost:19000', 4000)).toBe('http://localhost:4000');
  });

  test('tolerates a scheme or a path', () => {
    expect(devApiUrlFrom('exp://192.168.0.5:8081')).toBe('http://192.168.0.5:3000');
    expect(devApiUrlFrom('192.168.0.5:8081/--/home')).toBe('http://192.168.0.5:3000');
  });

  test('nothing for tunnels or a missing host', () => {
    expect(devApiUrlFrom('abc-anonymous-8081.exp.direct')).toBeUndefined();
    expect(devApiUrlFrom(undefined)).toBeUndefined();
    expect(devApiUrlFrom('')).toBeUndefined();
    expect(devApiUrlFrom({})).toBeUndefined();
  });
});
