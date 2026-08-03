import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import mongoose, { Schema, model, type Model } from 'mongoose';
import { config } from '../config';

/**
 * Flutterwave v4 (OAuth) adapter — used when only v4 credentials (client id/secret)
 * are available, e.g. the developer sandbox. Implements the same contract as the
 * v3 integration in payment-gateway.service:
 *  - initialize a charge that returns a hosted page URL to redirect the buyer to
 *  - verify a charge by OUR reference
 *  - initiate a bank transfer (payouts)
 *
 * v4 has no v3-style hosted checkout; instead the orchestrator's card flow returns
 * a hosted 3DS redirect page. In the SANDBOX all data is mocked, so we charge a
 * mock (properly AES-GCM-encrypted) card with the `auth_3ds & approved` scenario —
 * the buyer gets a real Flutterwave-hosted page, approves, and is redirected back,
 * exercising the exact redirect → verify loop production uses.
 */

const IDP_TOKEN_URL = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';

function baseUrl() {
  return config.flutterwaveV4Env === 'production'
    ? 'https://f4bexperience.flutterwave.com'
    : 'https://developersandbox-api.flutterwave.com';
}

export function isFlutterwaveV4Configured(): boolean {
  return Boolean(config.flutterwaveClientId && config.flutterwaveClientSecret);
}

// ── OAuth token cache (tokens live 10 minutes; refresh 60s early) ─────────────

let cachedToken = '';
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }
  const res = await fetch(IDP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.flutterwaveClientId,
      client_secret: config.flutterwaveClientSecret,
      grant_type: 'client_credentials',
    }),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    throw new Error(json?.error_description || 'Flutterwave v4 authentication failed');
  }
  cachedToken = json.access_token as string;
  tokenExpiresAt = Date.now() + Number(json.expires_in ?? 600) * 1000;
  return cachedToken;
}

async function v4Fetch(path: string, init: { method?: string; body?: unknown; scenario?: string } = {}) {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Trace-Id': randomUUID(),
    'X-Idempotency-Key': randomUUID(),
  };
  // Scenario keys drive the mocked sandbox; they are meaningless (and omitted) in production.
  if (init.scenario && config.flutterwaveV4Env === 'sandbox') {
    headers['X-Scenario-Key'] = init.scenario;
  }
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? 'GET',
    headers,
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || json?.status === 'failed') {
    throw new Error(json?.error?.message || json?.message || `Flutterwave v4 request failed (${res.status})`);
  }
  return json;
}

// ── Card-field encryption (AES-256-GCM, per Flutterwave v4 docs) ──────────────

const NONCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function makeNonce(length = 12) {
  return Array.from(crypto.randomBytes(length), (b) => NONCE_ALPHABET[b % NONCE_ALPHABET.length]).join('');
}

function encryptField(plainText: string, nonce: string): string {
  const key = Buffer.from(config.flutterwaveEncryptionKey, 'base64');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return encrypted.toString('base64');
}

// ── Charge-id bookkeeping ─────────────────────────────────────────────────────
// v4 charges are fetched by THEIR id, but our payments only store OUR reference —
// persist the mapping so verification survives restarts.

type GatewayRefDocument = { reference: string; chargeId: string; createdAt: Date };

const gatewayRefSchema = new Schema<GatewayRefDocument>({
  reference: { type: String, required: true, unique: true, index: true },
  chargeId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

const GatewayRefModel =
  (mongoose.models.GatewayRef as Model<GatewayRefDocument>) ?? model<GatewayRefDocument>('GatewayRef', gatewayRefSchema);

// ── Public API (mirrors the v3 contract) ──────────────────────────────────────

export async function v4InitializeCharge(input: {
  email: string;
  fullName?: string;
  amountNgn: number;
  reference: string;
  redirectUrl: string;
}): Promise<{ authorizationUrl: string }> {
  // The v4 API rejects plain-http redirect URLs (e.g. localhost dev). Swap in a
  // harmless placeholder — the buyer returns to the event page manually and the
  // "check payment status" path (or the reconciler) settles the ticket.
  const redirectUrl = input.redirectUrl.startsWith('https://')
    ? input.redirectUrl
    : 'https://flutterwave.com/ng';

  // HARD SAFETY: the card below is a sandbox mock. Charging it in production would
  // be nonsense at best and fraud-shaped at worst. Production card collection on v4
  // requires Flutterwave's client-side inline SDK (PCI scope) — until that exists,
  // production must run the v3 hosted checkout (set FLUTTERWAVE_SECRET_KEY).
  if (config.flutterwaveV4Env === 'production') {
    throw new Error(
      'Flutterwave v4 production checkout is not supported yet — set FLUTTERWAVE_SECRET_KEY to use the v3 hosted checkout in production',
    );
  }

  // Sandbox-mocked card, properly encrypted so the API accepts it. In production
  // this path would instead collect real card details (or use payment links).
  const nonce = makeNonce();
  const [first, ...rest] = (input.fullName || 'GuildOS Attendee').split(/\s+/);

  const json = await v4Fetch('/orchestration/direct-charges', {
    method: 'POST',
    scenario: 'scenario:auth_3ds&issuer:approved',
    body: {
      amount: input.amountNgn,
      currency: 'NGN',
      reference: input.reference,
      redirect_url: redirectUrl,
      customer: {
        email: input.email,
        name: { first, last: rest.join(' ') || first },
      },
      payment_method: {
        type: 'card',
        card: {
          nonce,
          encrypted_card_number: encryptField('4242424242424242', nonce),
          encrypted_expiry_month: encryptField('09', nonce),
          encrypted_expiry_year: encryptField('32', nonce),
          encrypted_cvv: encryptField('812', nonce),
        },
      },
    },
  });

  const chargeId = json?.data?.id as string | undefined;
  if (chargeId) {
    await GatewayRefModel.updateOne({ reference: input.reference }, { $set: { chargeId } }, { upsert: true });
  }

  const nextAction = json?.data?.next_action;
  if (nextAction?.type === 'redirect_url' && nextAction?.redirect_url?.url) {
    return { authorizationUrl: nextAction.redirect_url.url as string };
  }
  // No redirect needed (e.g. noauth mock approved instantly) — send the buyer
  // straight back to our page; verify-on-return settles it.
  const status = json?.data?.status as string | undefined;
  if (status && ['succeeded', 'pending'].includes(status)) {
    const back = new URL(redirectUrl);
    back.searchParams.set('reference', input.reference);
    return { authorizationUrl: back.toString() };
  }
  throw new Error('Flutterwave did not return a payment page');
}

export async function v4VerifyCharge(reference: string): Promise<{ success: boolean; failed: boolean; amountNgn?: number; currency?: string }> {
  const mapping = await GatewayRefModel.findOne({ reference }).lean();
  if (!mapping) {
    return { success: false, failed: false };
  }
  const json = await v4Fetch(`/charges/${encodeURIComponent(mapping.chargeId)}`);
  const status = String(json?.data?.status ?? '').toLowerCase();
  return {
    success: status === 'succeeded',
    failed: ['failed', 'cancelled', 'reversed'].includes(status),
    amountNgn: typeof json?.data?.amount === 'number' ? json.data.amount : undefined,
    currency: json?.data?.currency as string | undefined,
  };
}

/** Full or partial refund of a charge by OUR reference. Returns the gateway refund id. */
export async function v4RefundCharge(reference: string, amountNgn: number, _reason: string): Promise<{ refundRef: string }> {
  const mapping = await GatewayRefModel.findOne({ reference }).lean();
  if (!mapping) {
    throw new Error('No gateway charge found for this payment');
  }
  const json = await v4Fetch('/refunds', {
    method: 'POST',
    // v4 only accepts enum reasons — free-text reasons 422. Cancellation refunds map cleanly here.
    body: { amount: amountNgn, reason: 'requested_by_customer', charge_id: mapping.chargeId },
  });
  const id = json?.data?.id as string | undefined;
  if (!id) {
    throw new Error('Refund was not accepted');
  }
  return { refundRef: id };
}

export async function v4InitiateBankTransfer(input: {
  amountNgn: number;
  accountNumber: string;
  bankCode: string;
  reference: string;
}): Promise<{ transferRef: string }> {
  const json = await v4Fetch('/direct-transfers', {
    method: 'POST',
    scenario: 'scenario:successful',
    body: {
      action: 'instant',
      type: 'bank',
      reference: input.reference,
      payment_instruction: {
        source_currency: 'NGN',
        destination_currency: 'NGN',
        amount: { applies_to: 'destination_currency', value: input.amountNgn },
        recipient: { bank: { account_number: input.accountNumber, code: input.bankCode } },
      },
    },
  });
  const id = json?.data?.id as string | undefined;
  if (!id) {
    throw new Error('Transfer was not accepted');
  }
  return { transferRef: id };
}

/** v4 bank list (for name → code resolution). Falls back to a static NGN list if the endpoint differs. */
export async function v4ListBanks(): Promise<{ name: string; code: string }[]> {
  try {
    const json = await v4Fetch('/banks?country=NG');
    const rows = (json?.data ?? []) as any[];
    if (rows.length) {
      return rows.map((b) => ({ name: String(b.name), code: String(b.code) }));
    }
  } catch {
    /* endpoint shape differs in some environments — use the fallback below */
  }
  // Common NGN bank codes — enough for payout name-resolution in the sandbox.
  return [
    { name: 'Access Bank', code: '044' },
    { name: 'GTBank', code: '058' },
    { name: 'Guaranty Trust Bank', code: '058' },
    { name: 'First Bank of Nigeria', code: '011' },
    { name: 'United Bank for Africa', code: '033' },
    { name: 'UBA', code: '033' },
    { name: 'Zenith Bank', code: '057' },
    { name: 'Union Bank', code: '032' },
    { name: 'Fidelity Bank', code: '070' },
    { name: 'Ecobank', code: '050' },
    { name: 'Stanbic IBTC', code: '221' },
    { name: 'Sterling Bank', code: '232' },
    { name: 'Wema Bank', code: '035' },
    { name: 'Polaris Bank', code: '076' },
    { name: 'Keystone Bank', code: '082' },
    { name: 'FCMB', code: '214' },
    { name: 'First City Monument Bank', code: '214' },
    { name: 'Opay', code: '999992' },
    { name: 'PalmPay', code: '999991' },
    { name: 'Kuda Bank', code: '50211' },
    { name: 'Moniepoint', code: '50515' },
  ];
}
