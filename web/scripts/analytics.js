// Fail closed until the official beacon has a verified privacy-safe lifecycle.
// Removing a main-document script does not stop its listeners. The isolated-frame
// probe failed collection (CORS). Do not restore direct injection.
// There is intentionally no provider-loading path, even with saved consent.
export function startAnalytics() {
  return false;
}
