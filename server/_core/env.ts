export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Stripe. The secret key never leaves the server; the webhook secret is what
  // makes an incoming "this order is paid" event trustworthy, so a missing one
  // is treated as "reject every webhook" rather than "skip verification".
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  /** Absolute origin Stripe sends the shopper back to. */
  publicSiteUrl: process.env.PUBLIC_SITE_URL ?? "https://www.brighterdayslabs.com",
  // UPS. Business decisions — origin, services, handling — are configured in
  // the admin; these are the credentials, which belong to the environment.
  upsClientId: process.env.UPS_CLIENT_ID ?? "",
  upsClientSecret: process.env.UPS_CLIENT_SECRET ?? "",
  /** Required to buy a label; rating works without it. */
  upsAccountNumber: process.env.UPS_ACCOUNT_NUMBER ?? "",
  // Anything other than an explicit "production" means the sandbox. Reaching
  // the live carrier has to be a decision somebody made, not a variable
  // somebody forgot: a wrong guess here buys real labels and bills real money.
  upsProduction: process.env.UPS_ENVIRONMENT === "production",
};
