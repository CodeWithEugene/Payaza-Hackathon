/**
 * Every email address the demo seed (lib/demo/seed.ts) and the e2e suite use.
 * lib/notify/email.ts never delivers to these (some are real-looking domains),
 * and tests/email-guard.test.ts fails if the seed gains an address not listed.
 */
export const SEED_EMAILS: ReadonlySet<string> = new Set([
  "wanjiru@kusanya.demo",
  "susan@dubaifresh.ae",
  "ap@globalfoods.com",
  "njeri@greengrocers.co.ke",
  "orders@amanifoods.co.tz",
  "kato@katogrocers.ug",
  "post@nordicseafood.example",
  "accounts@mwalimulogistics.co.ke",
]);

/** Every phone number the demo seed uses, in E.164 (see lib/notify/sms.ts). */
export const SEED_PHONES: ReadonlySet<string> = new Set([
  "+254700111222",
  "+254722111333",
  "+254733987654",
  "+255754123456",
  "+256772123456",
  "+971501234567",
]);
