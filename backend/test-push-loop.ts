/**
 * One-off: verifies the web-push service loop without a real browser —
 * saves a fake subscription, sends a push (gateway 404s), and confirms
 * the dead subscription is pruned. Run: npx tsx --env-file=.env test-push-loop.ts
 */
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { PushSubscriptionModel } from './src/models/push-subscription.model';
import { isPushConfigured, savePushSubscription, sendPushToUser } from './src/services/push.service';
import { UserModel } from './src/models/user.model';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, extra = '') {
  if (ok) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    console.error(`  FAIL ${name} ${extra}`);
  }
}

async function main() {
  await connectDatabase();
  check('push configured (VAPID keys)', isPushConfigured());

  const user = await UserModel.findOne({ email: 'livetest@guildos.local' }).select('_id').lean();
  if (!user) throw new Error('livetest user missing');
  const userId = user._id.toString();

  // Valid-shaped but dead endpoint (FCM returns 404 for unknown tokens).
  const endpoint = `https://fcm.googleapis.com/fcm/send/guildos-test-${Date.now()}`;
  await savePushSubscription(userId, {
    endpoint,
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    },
  }, 'push-loop-test');
  check('subscription saved', (await PushSubscriptionModel.countDocuments({ endpoint })) === 1);

  // Upsert: same endpoint saved again → still one row.
  await savePushSubscription(userId, {
    endpoint,
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    },
  });
  check('upsert (no duplicate)', (await PushSubscriptionModel.countDocuments({ endpoint })) === 1);

  // Invalid payloads rejected.
  let threw = false;
  try {
    await savePushSubscription(userId, { endpoint: '', keys: { p256dh: 'x', auth: 'y' } });
  } catch {
    threw = true;
  }
  check('invalid subscription rejected', threw);

  // Send → gateway 404/410 → sub pruned; call itself never throws.
  await sendPushToUser(userId, { title: 'Test push', body: 'hello', link: '/notifications' });
  check('dead subscription pruned after send', (await PushSubscriptionModel.countDocuments({ endpoint })) === 0);

  // Cleanup any strays from this test.
  await PushSubscriptionModel.deleteMany({ userAgent: 'push-loop-test' });

  console.log(`\n${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
