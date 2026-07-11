import crypto from 'node:crypto';
import { config } from '../config';

export type PaymentGateway = 'PAYSTACK' | 'FLUTTERWAVE';

const PAYSTACK_BASE = 'https://api.paystack.co';
const FLUTTERWAVE_BASE = 'https://api.flutterwave.com/v3';

/** Whether a given gateway has the secret key needed to transact. */
export function isGatewayConfigured(gateway: PaymentGateway): boolean {
  return gateway === 'PAYSTACK' ? Boolean(config.paystackSecretKey) : Boolean(config.flutterwaveSecretKey);
}

export type InitChargeInput = {
  gateway: PaymentGateway;
  email: string;
  amountNgn: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

/** Start a hosted checkout. Returns the URL to redirect the buyer to. */
export async function initializeCharge(input: InitChargeInput): Promise<{ authorizationUrl: string }> {
  const { gateway, email, amountNgn, reference, callbackUrl, metadata } = input;

  if (gateway === 'PAYSTACK') {
    const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amountNgn * 100), // Paystack charges in kobo
        reference,
        callback_url: callbackUrl,
        metadata,
      }),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.status || !json?.data?.authorization_url) {
      throw new Error(json?.message || 'Unable to start payment');
    }
    return { authorizationUrl: json.data.authorization_url as string };
  }

  // Flutterwave — charges in the major unit (NGN), hosted link at data.link
  const res = await fetch(`${FLUTTERWAVE_BASE}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.flutterwaveSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: reference,
      amount: amountNgn,
      currency: 'NGN',
      redirect_url: callbackUrl,
      customer: { email },
      meta: metadata,
      customizations: { title: 'GuildOS Premium' },
    }),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || json?.status !== 'success' || !json?.data?.link) {
    throw new Error(json?.message || 'Unable to start payment');
  }
  return { authorizationUrl: json.data.link as string };
}

/** Verify a completed charge by our reference. Returns whether it succeeded plus the amount actually paid. */
export async function verifyCharge(gateway: PaymentGateway, reference: string): Promise<{ success: boolean; failed: boolean; amountNgn?: number; currency?: string }> {
  if (gateway === 'PAYSTACK') {
    const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${config.paystackSecretKey}` },
    });
    const json: any = await res.json().catch(() => null);
    const data = json?.data;
    const status = data?.status as string | undefined;
    return {
      success: Boolean(res.ok && json?.status && status === 'success'),
      failed: Boolean(status && status !== 'success'),
      amountNgn: typeof data?.amount === 'number' ? data.amount / 100 : undefined, // Paystack returns kobo
      currency: data?.currency,
    };
  }

  const res = await fetch(`${FLUTTERWAVE_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${config.flutterwaveSecretKey}` },
  });
  const json: any = await res.json().catch(() => null);
  const data = json?.data;
  const status = data?.status as string | undefined;
  return {
    success: Boolean(res.ok && json?.status === 'success' && status === 'successful'),
    failed: Boolean(status && status !== 'successful'),
    amountNgn: typeof data?.amount === 'number' ? data.amount : undefined, // Flutterwave returns the major unit (NGN)
    currency: data?.currency,
  };
}

/** Verify a Paystack webhook signature (HMAC SHA512 of the raw body). */
export function isValidPaystackSignature(rawBody: Buffer | string, signature?: string): boolean {
  if (!config.paystackSecretKey || !signature) return false;
  const hash = crypto.createHmac('sha512', config.paystackSecretKey).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Verify a Flutterwave webhook (the `verif-hash` header must equal the secret hash). */
export function isValidFlutterwaveSignature(signature?: string): boolean {
  if (!config.flutterwaveSecretHash || !signature) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(config.flutterwaveSecretHash), Buffer.from(signature));
  } catch {
    return false;
  }
}
