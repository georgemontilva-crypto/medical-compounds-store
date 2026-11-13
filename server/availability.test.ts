import { describe, expect, it } from "vitest";
import {
  LOW_STOCK_THRESHOLD,
  isProductPurchasable,
  isPurchasable,
  productAvailability,
  resolveProductAvailability,
  stockState,
  variationAvailability,
} from "@shared/availability";

const size = (over: Partial<Parameters<typeof variationAvailability>[0]> = {}) => ({
  active: true,
  stock: 10,
  availability: "auto" as const,
  ...over,
});

describe("variationAvailability", () => {
  it("leaves every existing size exactly as it behaved before", () => {
    // Nothing was migrated: every row defaults to "auto", so the stock count
    // has to keep deciding or this change silently alters the whole catalogue.
    expect(variationAvailability(size({ stock: 10 }))).toBe("in_stock");
    expect(variationAvailability(size({ stock: 0 }))).toBe("unavailable");
    expect(variationAvailability(size({ stock: 3 }))).toBe("low_stock");
  });

  it("lets the shop mark a stocked size unavailable", () => {
    expect(variationAvailability(size({ stock: 40, availability: "unavailable" }))).toBe(
      "unavailable"
    );
  });

  it("lets the shop mark a size low without touching the count", () => {
    expect(variationAvailability(size({ stock: 40, availability: "low_stock" }))).toBe(
      "low_stock"
    );
  });

  it("keeps a size sellable when marked low but the stale count says zero", () => {
    // The count is hand-maintained and nothing decrements it. A forgotten 0
    // must not overrule the person who just said this size is available.
    const marked = size({ stock: 0, availability: "low_stock" });
    expect(variationAvailability(marked)).toBe("low_stock");
    expect(isPurchasable(marked)).toBe(true);
  });

  it("treats an inactive size as gone whatever the switch says", () => {
    // Inactive is the shop having removed the size, which outranks a stale
    // availability setting left on it.
    expect(variationAvailability(size({ active: false, availability: "low_stock" }))).toBe(
      "unavailable"
    );
    expect(variationAvailability(size({ active: false, availability: "auto" }))).toBe(
      "unavailable"
    );
  });

  it("reads a missing setting as auto, for rows written before the column", () => {
    expect(variationAvailability({ active: true, stock: 50 })).toBe("in_stock");
    expect(variationAvailability({ active: true, stock: 0, availability: null })).toBe(
      "unavailable"
    );
  });
});

describe("isPurchasable", () => {
  it("is the single question checkout asks", () => {
    expect(isPurchasable(size({ availability: "unavailable" }))).toBe(false);
    expect(isPurchasable(size({ availability: "low_stock" }))).toBe(true);
    expect(isPurchasable(size({ stock: 0 }))).toBe(false);
    expect(isPurchasable(size({ stock: 3 }))).toBe(true);
  });
});

describe("productAvailability", () => {
  it("is unavailable only when every active size is", () => {
    expect(
      productAvailability([
        size({ availability: "unavailable" }),
        size({ stock: 0 }),
      ])
    ).toBe("unavailable");
  });

  it("warns on the card when any size is low, even beside a stocked one", () => {
    // A card is a summary and leans toward warning: the shopper who wants the
    // low size would rather hear it on the listing than after clicking.
    expect(
      productAvailability([size({ stock: 50 }), size({ availability: "low_stock" })])
    ).toBe("low_stock");
  });

  it("stays in stock when one size is gone but another is fine", () => {
    expect(
      productAvailability([size({ availability: "unavailable" }), size({ stock: 50 })])
    ).toBe("in_stock");
  });

  it("ignores inactive sizes rather than letting them condemn the product", () => {
    expect(
      productAvailability([size({ active: false }), size({ stock: 20 })])
    ).toBe("in_stock");
  });

  it("is unavailable when there are no active sizes at all", () => {
    // The fallback has to be the one that cannot sell something that is not
    // there — an empty list is a product whose sizes were all removed.
    expect(productAvailability([])).toBe("unavailable");
    expect(productAvailability([size({ active: false })])).toBe("unavailable");
  });
});

describe("resolveProductAvailability", () => {
  // The case that made this function necessary: only two products in this
  // catalogue have sizes at all. For the other thirteen there is no size row
  // to carry a setting, so a size-only design left them unmarkable — and an
  // empty size list must not be read as "sold out" either.
  it("marks a product that has no sizes at all", () => {
    expect(resolveProductAvailability({ availability: "unavailable" }, [])).toBe("unavailable");
    expect(resolveProductAvailability({ availability: "low_stock" }, [])).toBe("low_stock");
  });

  it("shows a sizeless product with no count entered, saying nothing about it", () => {
    // This is the case that decides whether adding the column empties the
    // shop. Every product predates it; all of them read null.
    expect(resolveProductAvailability({}, [])).toBe("unknown");
    expect(resolveProductAvailability({ availability: "auto", stock: null }, [])).toBe("unknown");
    expect(isProductPurchasable({ stock: null }, [])).toBe(true);
  });

  it("applies the count to a sizeless product once one is entered", () => {
    expect(resolveProductAvailability({ stock: 0 }, [])).toBe("unavailable");
    expect(resolveProductAvailability({ stock: 1 }, [])).toBe("low_stock");
    expect(resolveProductAvailability({ stock: LOW_STOCK_THRESHOLD }, [])).toBe("low_stock");
    expect(resolveProductAvailability({ stock: LOW_STOCK_THRESHOLD + 1 }, [])).toBe("in_stock");
  });

  it("ignores the product count where sizes carry their own", () => {
    // Otherwise the product total silently competes with the per-size ones.
    expect(resolveProductAvailability({ stock: 0 }, [size({ stock: 50 })])).toBe("in_stock");
  });

  it("lets the product's own switch close every size under it", () => {
    expect(
      resolveProductAvailability({ availability: "unavailable" }, [
        size({ stock: 100 }),
        size({ stock: 100 }),
      ])
    ).toBe("unavailable");
  });

  it("does not let a product marked low advertise sizes that are all gone", () => {
    // Otherwise the card invites a click through to a product nobody can buy.
    expect(
      resolveProductAvailability({ availability: "low_stock" }, [
        size({ availability: "unavailable" }),
      ])
    ).toBe("unavailable");
  });

  it("lets a product be marked low while its sizes look fine", () => {
    expect(
      resolveProductAvailability({ availability: "low_stock" }, [size({ stock: 80 })])
    ).toBe("low_stock");
  });

  it("falls through to the sizes when the product is left on auto", () => {
    expect(resolveProductAvailability({ availability: "auto" }, [size({ stock: 50 })])).toBe(
      "in_stock"
    );
    expect(
      resolveProductAvailability({ availability: "auto" }, [size({ availability: "low_stock" })])
    ).toBe("low_stock");
    expect(resolveProductAvailability({ availability: "auto" }, [size({ stock: 0 })])).toBe(
      "unavailable"
    );
  });
});

describe("isProductPurchasable", () => {
  it("is what checkout asks before a size is even chosen", () => {
    expect(isProductPurchasable({ availability: "unavailable" }, [])).toBe(false);
    expect(isProductPurchasable({ availability: "low_stock" }, [])).toBe(true);
    expect(isProductPurchasable({}, [])).toBe(true);
    expect(isProductPurchasable({ stock: 0 }, [])).toBe(false);
    expect(isProductPurchasable({ stock: 1 }, [])).toBe(true);
  });
});

describe("stockState", () => {
  it("separates untracked from empty, which is the whole point of the null", () => {
    // A blank count is not a count of nought. Reading it as nought hides the
    // product, which for a catalogue that has never had counts means hiding
    // all of it at once.
    expect(stockState(null)).toBe("unknown");
    expect(stockState(undefined)).toBe("unknown");
    expect(stockState(0)).toBe("unavailable");
  });

  it("puts the boundary where the shop asked for it", () => {
    expect(LOW_STOCK_THRESHOLD).toBe(5);
    expect(stockState(1)).toBe("low_stock");
    expect(stockState(5)).toBe("low_stock");
    expect(stockState(6)).toBe("in_stock");
  });

  it("treats a negative count as empty rather than as plenty", () => {
    expect(stockState(-3)).toBe("unavailable");
  });
});
