// Public site token only, never an account API key. See docs/ANALYTICS.md.
// Activation needs the owner's token, collection-scope/privacy review and CSP update.
export const analyticsConfig = Object.freeze({ enabled: false, siteToken: null, reviewed: false });
