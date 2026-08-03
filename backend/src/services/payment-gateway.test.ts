import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { config } from '../config';
import {
  isValidFlutterwaveSignature,
  isValidFlutterwaveV4Signature,
  isValidPaystackSignature,
} from './payment-gateway.service';

describe('webhook signature verification', () => {
  it('accepts a correct Flutterwave v4 HMAC-SHA256 signature (base64 of raw body)', () => {
    (config as any).flutterwaveSecretHash = 'test-secret-hash';
    const raw = Buffer.from(JSON.stringify({ type: 'charge.completed', data: { reference: 'TKT-abc' } }));
    const signature = crypto.createHmac('sha256', 'test-secret-hash').update(raw).digest('base64');
    expect(isValidFlutterwaveV4Signature(raw, signature)).toBe(true);
  });

  it('rejects a tampered v4 body', () => {
    (config as any).flutterwaveSecretHash = 'test-secret-hash';
    const raw = Buffer.from('{"data":{"reference":"TKT-abc"}}');
    const signature = crypto.createHmac('sha256', 'test-secret-hash').update(raw).digest('base64');
    expect(isValidFlutterwaveV4Signature(Buffer.from('{"data":{"reference":"TKT-EVIL"}}'), signature)).toBe(false);
  });

  it('rejects v4 signatures when no secret hash is configured', () => {
    (config as any).flutterwaveSecretHash = '';
    expect(isValidFlutterwaveV4Signature(Buffer.from('{}'), 'anything')).toBe(false);
  });

  it('accepts the v3 static verif-hash and rejects a wrong one', () => {
    (config as any).flutterwaveSecretHash = 'static-hash';
    expect(isValidFlutterwaveSignature('static-hash')).toBe(true);
    expect(isValidFlutterwaveSignature('wrong')).toBe(false);
    expect(isValidFlutterwaveSignature(undefined)).toBe(false);
  });

  it('verifies Paystack HMAC-SHA512 signatures', () => {
    (config as any).paystackSecretKey = 'sk_test_123';
    const raw = Buffer.from('{"event":"charge.success"}');
    const signature = crypto.createHmac('sha512', 'sk_test_123').update(raw).digest('hex');
    expect(isValidPaystackSignature(raw, signature)).toBe(true);
    expect(isValidPaystackSignature(raw, 'bad')).toBe(false);
  });
});
