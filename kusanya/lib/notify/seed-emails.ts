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
