import crypto from 'node:crypto';
import { config } from '../config';
import {
  isFlutterwaveV4Configured,
  v4InitializeCharge,
  v4VerifyCharge,
  v4InitiateBankTransfer,
  v4ListBanks,
  v4RefundCharge,
} from './flutterwave-v4.service';

export type PaymentGateway = 'PAYSTACK' | 'FLUTTERWAVE';

const PAYSTACK_BASE = 'https://api.paystack.co';
const FLUTTERWAVE_BASE = 'https://api.flutterwave.com/v3';

/** v4 (OAuth) credentials are the fallback when the classic v3 secret key is absent. */
function useFlutterwaveV4(): boolean {
  return !config.flutterwaveSecretKey && isFlutterwaveV4Configured();
}

/** Whether a given gateway has the secret key needed to transact. */
export function isGatewayConfigured(gateway: PaymentGateway): boolean {
  return gateway === 'PAYSTACK'
    ? Boolean(config.paystackSecretKey)
    : Boolean(config.flutterwaveSecretKey) || isFlutterwaveV4Configured();
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

  // Flutterwave v4 (OAuth) — orchestrated charge returning a hosted redirect page.
  if (useFlutterwaveV4()) {
    const back = new URL(callbackUrl);
    back.searchParams.set('reference', reference);
    return v4InitializeCharge({ email, amountNgn, reference, redirectUrl: back.toString() });
  }

  // Flutterwave v3 — charges in the major unit (NGN), hosted link at data.link
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

  if (useFlutterwaveV4()) {
    return v4VerifyCharge(reference);
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

/** Verify a Flutterwave v4 webhook: HMAC-SHA256 of the raw body (base64) in the `flutterwave-signature` header. */
export function isValidFlutterwaveV4Signature(rawBody: Buffer | string, signature?: string): boolean {
  if (!config.flutterwaveSecretHash || !signature) return false;
  const hash = crypto.createHmac('sha256', config.flutterwaveSecretHash).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── Bank transfers (auto disbursement of organizer payouts) ───────────────────

/** Refund a completed charge back to the buyer. Returns the gateway's refund reference. */
export async function refundCharge(
  gateway: PaymentGateway,
  reference: string,
  amountNgn: number,
  reason: string,
): Promise<{ refundRef: string }> {
  if (gateway === 'PAYSTACK') {
    const res = await fetch(`${PAYSTACK_BASE}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.paystackSecretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: reference, amount: Math.round(amountNgn * 100), merchant_note: reason }),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.status) {
      throw new Error(json?.message || 'Refund was not accepted');
    }
    return { refundRef: String(json.data?.id ?? reference) };
  }
  if (useFlutterwaveV4()) {
    return v4RefundCharge(reference, amountNgn, reason);
  }
  // Flutterwave v3: refund by transaction id — resolve it from our reference first.
  const lookup = await fetch(`${FLUTTERWAVE_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${config.flutterwaveSecretKey}` },
  });
  const found: any = await lookup.json().catch(() => null);
  const transactionId = found?.data?.id;
  if (!transactionId) {
    throw new Error('Original transaction not found at the gateway');
  }
  const res = await fetch(`${FLUTTERWAVE_BASE}/transactions/${transactionId}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.flutterwaveSecretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountNgn }),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || json?.status !== 'success') {
    throw new Error(json?.message || 'Refund was not accepted');
  }
  return { refundRef: String(json.data?.id ?? reference) };
}


/** Nigerian bank list from the active gateway — used to resolve a typed bank name to a code. */
export async function listBanks(gateway: PaymentGateway): Promise<{ name: string; code: string }[]> {
  if (gateway === 'PAYSTACK') {
    const res = await fetch(`${PAYSTACK_BASE}/bank?currency=NGN&perPage=100`, {
      headers: { Authorization: `Bearer ${config.paystackSecretKey}` },
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.status) throw new Error(json?.message || 'Unable to fetch bank list');
    return (json.data as any[]).map((b) => ({ name: String(b.name), code: String(b.code) }));
  }
  if (useFlutterwaveV4()) {
    return v4ListBanks();
  }
  const res = await fetch(`${FLUTTERWAVE_BASE}/banks/NG`, {
    headers: { Authorization: `Bearer ${config.flutterwaveSecretKey}` },
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || json?.status !== 'success') throw new Error(json?.message || 'Unable to fetch bank list');
  return (json.data as any[]).map((b) => ({ name: String(b.name), code: String(b.code) }));
}

function normalizeBankName(name: string) {
  return name.toLowerCase().replace(/\b(bank|plc|limited|ltd|of|nigeria)\b/g, '').replace(/[^a-z0-9]/g, '');
}

/** Resolve a free-text bank name against the gateway's list. Ambiguity fails loudly — money must not guess. */
export async function resolveBankCode(gateway: PaymentGateway, bankName: string): Promise<string> {
  const banks = await listBanks(gateway);
  const wanted = normalizeBankName(bankName);
  if (!wanted) throw new Error('A bank name is required');
  const exact = banks.filter((b) => normalizeBankName(b.name) === wanted);
  if (exact.length === 1) return exact[0].code;
  const partial = banks.filter((b) => normalizeBankName(b.name).includes(wanted) || wanted.includes(normalizeBankName(b.name)));
  if (partial.length === 1) return partial[0].code;
  throw new Error(`Could not match bank "${bankName}" — ${partial.length > 1 ? 'several banks match' : 'no bank matches'}. Settle manually or fix the bank name.`);
}

export type BankTransferInput = {
  gateway: PaymentGateway;
  amountNgn: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  reference: string;
  reason: string;
};

/**
 * Send money to a bank account (organizer payout). Returns the gateway's transfer
 * reference on acceptance. NOTE: Paystack accounts with OTP-protected transfers
 * will reject API transfers until OTP is disabled in the Paystack dashboard —
 * that error surfaces here and the payout falls back to manual settlement.
 */
export async function initiateBankTransfer(input: BankTransferInput): Promise<{ transferRef: string }> {
  const bankCode = await resolveBankCode(input.gateway, input.bankName);

  if (input.gateway === 'PAYSTACK') {
    const recipientRes = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.paystackSecretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'nuban', name: input.accountName, account_number: input.accountNumber, bank_code: bankCode, currency: 'NGN' }),
    });
    const recipient: any = await recipientRes.json().catch(() => null);
    if (!recipientRes.ok || !recipient?.status || !recipient?.data?.recipient_code) {
      throw new Error(recipient?.message || 'Unable to verify the bank account');
    }
    const transferRes = await fetch(`${PAYSTACK_BASE}/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.paystackSecretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'balance', amount: Math.round(input.amountNgn * 100), recipient: recipient.data.recipient_code, reason: input.reason, reference: input.reference }),
    });
    const transfer: any = await transferRes.json().catch(() => null);
    if (!transferRes.ok || !transfer?.status) {
      throw new Error(transfer?.message || 'Transfer was not accepted');
    }
    return { transferRef: String(transfer.data?.transfer_code ?? input.reference) };
  }

  if (useFlutterwaveV4()) {
    return v4InitiateBankTransfer({ amountNgn: input.amountNgn, accountNumber: input.accountNumber, bankCode, reference: input.reference });
  }

  const res = await fetch(`${FLUTTERWAVE_BASE}/transfers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.flutterwaveSecretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_bank: bankCode, account_number: input.accountNumber, amount: input.amountNgn, narration: input.reason, currency: 'NGN', reference: input.reference }),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || json?.status !== 'success') {
    throw new Error(json?.message || 'Transfer was not accepted');
  }
  return { transferRef: String(json.data?.id ?? input.reference) };
}
