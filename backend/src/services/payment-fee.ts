export type GatewayFeeConfig = { percent: number; flat: number; cap: number; waiver: number };

/**
 * Compute the payment-gateway fee (in NGN) to pass on to the buyer, "grossing up"
 * so GuildOS receives the full base price net of the gateway's own deduction.
 * Works for Paystack (1.5% + ₦100, capped ₦2000, flat waived under ₦2500) and
 * Flutterwave-style flat-percentage plans (set flat=0). Admin-configurable.
 */
export function computeGatewayFeeNgn(baseNgn: number, cfg: GatewayFeeConfig): number {
  if (baseNgn <= 0) return 0;
  const percent = Math.min(0.99, cfg.percent / 100);
  const flat = baseNgn >= cfg.waiver ? cfg.flat : 0;
  const grossed = (baseNgn + flat) / (1 - percent);
  let fee = grossed - baseNgn;
  if (cfg.cap > 0 && fee > cfg.cap) fee = cfg.cap;
  return Math.max(0, Math.ceil(fee));
}
