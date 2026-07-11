import { describe, it, expect } from 'vitest';
import { computeGatewayFeeNgn, type GatewayFeeConfig } from './payment-fee';

// Real-world gateway fee structures.
const PAYSTACK: GatewayFeeConfig = { percent: 1.5, flat: 100, cap: 2000, waiver: 2500 };
const FLUTTERWAVE: GatewayFeeConfig = { percent: 1.4, flat: 0, cap: 2000, waiver: 0 };

describe('computeGatewayFeeNgn', () => {
  it('returns 0 for a zero or negative base', () => {
    expect(computeGatewayFeeNgn(0, PAYSTACK)).toBe(0);
    expect(computeGatewayFeeNgn(-100, PAYSTACK)).toBe(0);
  });

  it('waives the flat fee below the waiver threshold (₦400 per-event on Paystack)', () => {
    // 400 < 2500 → flat waived; fee = ceil(400 / (1 - 0.015) - 400) = ceil(6.09) = 7
    expect(computeGatewayFeeNgn(400, PAYSTACK)).toBe(7);
  });

  it('adds the flat fee at/above the waiver threshold (₦5000 monthly on Paystack)', () => {
    // 5000 ≥ 2500 → flat 100; fee = ceil((5100 / 0.985) - 5000) = ceil(177.66) = 178
    expect(computeGatewayFeeNgn(5000, PAYSTACK)).toBe(178);
  });

  it('grosses up so the merchant nets at least the base price after the gateway cut', () => {
    const base = 5000;
    const charged = base + computeGatewayFeeNgn(base, PAYSTACK);
    const gatewayCut = charged * 0.015 + 100; // Paystack deducts this from the charged amount
    expect(charged - gatewayCut).toBeGreaterThanOrEqual(base);
  });

  it('caps the fee at the configured maximum', () => {
    // A huge base would exceed the cap, so the fee must equal the cap exactly.
    expect(computeGatewayFeeNgn(1_000_000, PAYSTACK)).toBe(2000);
  });

  it('supports a flat-percentage (Flutterwave-style) plan with no flat fee', () => {
    // 400 * 1.4%: fee = ceil(400 / (1 - 0.014) - 400) = ceil(5.68) = 6
    expect(computeGatewayFeeNgn(400, FLUTTERWAVE)).toBe(6);
  });

  it('ignores the cap when cap is 0 (uncapped)', () => {
    const cfg: GatewayFeeConfig = { percent: 50, flat: 0, cap: 0, waiver: 0 };
    // fee = ceil(1000 / 0.5 - 1000) = 1000, not capped
    expect(computeGatewayFeeNgn(1000, cfg)).toBe(1000);
  });

  it('never returns a negative fee', () => {
    expect(computeGatewayFeeNgn(100, { percent: 0, flat: 0, cap: 0, waiver: 0 })).toBe(0);
  });
});
