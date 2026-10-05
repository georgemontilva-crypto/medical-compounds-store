import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * First-touch attribution.
 *
 * The rule decides which channel gets credited for a sale, and the two
 * plausible rules disagree often. A buyer who arrives from an advertisement,
 * returns twice by typing the address, and then buys was won by the
 * advertisement; recording that sale as "direct" would quietly argue for
 * cutting the thing that worked.
 */

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    location: { search: "", hostname: "www.brighterdayslabs.com" },
  });
  vi.stubGlobal("document", { referrer: "" });
});

async function load() {
  vi.resetModules();
  return import("../client/src/lib/attribution");
}

function arriveAt(search: string, referrer = "") {
  (globalThis as any).window.location.search = search;
  (globalThis as any).document.referrer = referrer;
}

describe("captureAttributionFromUrl", () => {
  it("records a tagged arrival", async () => {
    const { captureAttributionFromUrl, getStoredAttribution } = await load();
    arriveAt("?utm_source=facebook&utm_medium=paid_social&utm_campaign=bdl_report_guide");
    captureAttributionFromUrl();

    expect(getStoredAttribution()).toMatchObject({
      source: "facebook",
      medium: "paid_social",
      campaign: "bdl_report_guide",
    });
  });

  it("records the referring site when there is no tag", async () => {
    const { captureAttributionFromUrl, getStoredAttribution } = await load();
    arriveAt("", "https://www.reddit.com/r/peptides/comments/abc");
    captureAttributionFromUrl();

    expect(getStoredAttribution()?.source).toBe("reddit.com");
  });

  it("calls an arrival with no referrer direct", async () => {
    const { captureAttributionFromUrl, getStoredAttribution } = await load();
    arriveAt("");
    captureAttributionFromUrl();

    expect(getStoredAttribution()?.source).toBe("direct");
  });

  it("does not treat moving between our own pages as an arrival", async () => {
    const { captureAttributionFromUrl, getStoredAttribution } = await load();
    arriveAt("", "https://www.brighterdayslabs.com/compounds");
    captureAttributionFromUrl();

    expect(getStoredAttribution()?.source).toBe("direct");
  });

  it("keeps the first source when the visitor comes back directly", async () => {
    const { captureAttributionFromUrl, getStoredAttribution } = await load();
    arriveAt("?utm_source=facebook");
    captureAttributionFromUrl();

    // Later visit, typed the address. The advertisement still won this buyer.
    arriveAt("");
    captureAttributionFromUrl();

    expect(getStoredAttribution()?.source).toBe("facebook");
  });

  it("keeps the first source when the visitor returns via a search engine", async () => {
    const { captureAttributionFromUrl, getStoredAttribution } = await load();
    arriveAt("?utm_source=tiktok");
    captureAttributionFromUrl();

    arriveAt("", "https://www.google.com/search?q=brighter+days+labs");
    captureAttributionFromUrl();

    expect(getStoredAttribution()?.source).toBe("tiktok");
  });

  it("lets a newer tagged link replace an untagged source", async () => {
    const { captureAttributionFromUrl, getStoredAttribution } = await load();
    arriveAt("", "https://www.reddit.com/r/peptides");
    captureAttributionFromUrl();

    // Advertising spend is the thing most needing an honest answer, so a
    // campaign arrival overrides a vague earlier one.
    arriveAt("?utm_source=google&utm_campaign=search_brand");
    captureAttributionFromUrl();

    expect(getStoredAttribution()).toMatchObject({
      source: "google",
      campaign: "search_brand",
    });
  });

  it("preserves when the visitor was first seen across visits", async () => {
    const { captureAttributionFromUrl, getStoredAttribution } = await load();
    arriveAt("?utm_source=facebook");
    captureAttributionFromUrl();
    const first = getStoredAttribution()!.firstSeen;

    arriveAt("?utm_source=google");
    captureAttributionFromUrl();

    expect(getStoredAttribution()!.firstSeen).toBe(first);
  });

  it("forgets an attribution past its window", async () => {
    const { captureAttributionFromUrl, getStoredAttribution } = await load();
    arriveAt("?utm_source=facebook");
    captureAttributionFromUrl();

    const stored = JSON.parse(store.get("trafficAttribution")!);
    stored.expiresAt = Date.now() - 1000;
    store.set("trafficAttribution", JSON.stringify(stored));

    expect(getStoredAttribution()).toBeNull();
  });

  it("survives a corrupted stored value rather than throwing into a render", async () => {
    const { getStoredAttribution } = await load();
    store.set("trafficAttribution", "{not json");
    expect(getStoredAttribution()).toBeNull();
  });

  it("lowercases and bounds a source, since it arrives from a hand-typed ad field", async () => {
    const { captureAttributionFromUrl, getStoredAttribution } = await load();
    arriveAt(`?utm_source=${"FaceBook".padEnd(200, "x")}`);
    captureAttributionFromUrl();

    const source = getStoredAttribution()!.source;
    expect(source).toBe(source.toLowerCase());
    expect(source.length).toBeLessThanOrEqual(128);
  });
});
