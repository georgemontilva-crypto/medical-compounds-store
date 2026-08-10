import type { Express } from "express";

// The Ask Sunny button used to link straight at this URL, which put the Lynx
// API key in the button's href — visible on hover and in view-source. Routing
// through /ask-sunny keeps the key server-side so the button only ever shows
// our own domain. Note this is cosmetic, not a secret: the same key is still
// published in client/index.html as the chat widget's data-api-key, because
// the widget needs it in the browser.
const LYNX_CHAT_URL =
  process.env.LYNX_CHAT_URL ??
  "https://www.lynxaiassistant.com/chat/lx_65fe1ca24a3d807cb8565b931e91035093c4b3bd2d91378a";

export function registerAskSunnyRoute(app: Express) {
  app.get("/ask-sunny", (_req, res) => {
    // 302 rather than 301: a permanent redirect gets cached by browsers
    // indefinitely, so if the Lynx URL or key ever changes, visitors who
    // already clicked once would keep being sent to the stale destination
    // with no way for us to correct it.
    res.redirect(302, LYNX_CHAT_URL);
  });
}
