import 'dotenv/config';

async function main() {
  const res = await fetch(
    'https://api.flutterwave.com/v3/transactions/101202893/verify',
    { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } },
  );
  const json: any = await res.json().catch(() => null);
  console.log('http:', res.status);
  console.log('status:', json?.status, '| message:', json?.message);
  const d = json?.data;
  if (d) {
    console.log('tx status:', d.status, '| amount:', d.amount, d.currency, '| charged:', d.charged_amount, '| payment_type:', d.payment_type, '| processor_response:', d.processor_response);
  }
}

main().catch(console.error);
