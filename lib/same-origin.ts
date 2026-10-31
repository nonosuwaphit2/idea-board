// Compare the browser Origin to the actual request Host. Next.js may normalize
// request.url's hostname to localhost when running behind a local server.
export function isSameOrigin(request: Request) {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    return ["http:", "https:"].includes(origin.protocol) && origin.host === request.headers.get("host");
  } catch { return false; }
}
