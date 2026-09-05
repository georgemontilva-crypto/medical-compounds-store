import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { isSupportedCountry } from "@shared/countries";
import { AGE_REQUIREMENT_MESSAGE, isOfLegalAge } from "@shared/age";
import {
  ABANDONED_GRACE_HOURS,
  ANALYTICS_RANGES,
  ANALYTICS_RANGE_KEYS,
  DEFAULT_RANGE,
  conversionRate,
  fillSalesGaps,
  fillStatusCounts,
  rangeStart,
} from "@shared/analytics";
import {
  SHIPPING_SETTINGS_KEY,
  computePackage,
  enabledServices,
  isReadyToQuote,
  parseShippingSettings,
  shippingReadiness,
  shippingSettingsSchema,
} from "@shared/shipping";
import { createShippingLabel, getShippingRates, isUpsSandbox } from "./ups";
import { cartFingerprint, resolveQuotedRate, storeQuote } from "./shippingQuotes";
import { fillTrafficGaps } from "@shared/traffic";
import {
  BLOG_SLUG_MAX_LENGTH,
  parseBlogDoc,
  resolvePublishedAt,
  slugifyBlogTitle,
} from "@shared/blog";
import {
  getAbandonedCheckouts,
  getCustomerMix,
  getOrdersByStatus,
  getRecentAbandonedCheckouts,
  getRevenueSummary,
  getSalesOverTime,
  getSlowestProducts,
  getTopPages,
  getTopProducts,
  getTopSources,
  getTrafficOverTime,
  getTrafficSummary,
} from "./analytics";
import { clientIp, recordPageView } from "./traffic";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import type { InsertBlogCategory, InsertBlogPost } from "../drizzle/schema";
import { sendEmail, escapeHtml } from "./email";
import {
  RESET_TOKEN_TTL_MS,
  buildResetEmailHtml,
  buildResetUrl,
  consumeResetAttempt,
  generateResetToken,
  hashResetToken,
  hashesMatch,
  isResetTokenUsable,
  resetAttemptKey,
} from "./passwordReset";
import { notifyOwner } from "./_core/notification";
import type { InsertLabReport } from "../drizzle/schema";
import {
  addProductImage,
  clearCart,
  countOrders,
  countProducts,
  countUsers,
  createCategory,
  createCoupon,
  createOrder,
  createOrderItem,
  createProduct,
  createVariation,
  deleteCategory,
  deleteCoupon,
  deleteProduct,
  deleteProductImage,
  deleteVariation,
  getActiveNewCustomerOfferCoupon,
  getAllCategories,
  getAllCoupons,
  getAllOrders,
  getAllUsers,
  findUserByEmailExcluding,
  updateUserProfile,
  createPasswordResetToken,
  getPasswordResetTokenByHash,
  consumePasswordResetToken,
  updateUserPassword,
  getCartItems,
  getCategoryById,
  getCouponById,
  getWelcomeRedemption,
  createWelcomeRedemption,
  markWelcomeRedemptionUsed,
  setNewCustomerOfferCoupon,
  getOrderById,
  getOrderItems,
  getOrdersByUser,
  getProductById,
  getProductBySlug,
  getProductImages,
  getProductVariations,
  getVariationById,
  getProducts,
  getUserByEmail,
  incrementCouponUsage,
  removeCartItem,
  sumOrderRevenue,
  updateCartItemQuantity,
  updateCategory,
  updateCoupon,
  updateOrderStatus,
  updateProduct,
  updateVariation,
  upsertCartItem,
  upsertUser,
  getLabReportsByProduct,
  getAllLabReports,
  getRecentPublicLabReports,
  createLabReport,
  deleteLabReport,
  updateLabReport,
  getAllHeroSlidesConfig,
  getAllSiteImages,
  getSiteImageBySlot,
  upsertHeroSlideConfig,
  upsertSiteImage,
  getSiteSetting,
  setSiteSetting,
  getDocIntegritySection,
  updateDocIntegritySection,
  createWholesaleApplication,
  getWholesaleApplications,
  updateWholesaleApplicationStatus,
  markOrderPaid,
  setOrderPaymentSession,
  createAffiliateCode,
  createAffiliateReferral,
  createPayoutRequest,
  getAffiliateCodeByCode,
  getAffiliateCodeByUserId,
  getAffiliatesOverview,
  getAllPayoutRequests,
  getPayoutRequestsByUserId,
  getPendingPayoutRequest,
  getRejectedReferrals,
  getAffiliateCodeById,
  getReferralByOrderId,
  getReferralsByAffiliateCodeId,
  getReferralsByUserId,
  getUserById,
  getUserOrderStats,
  settlePayoutRequest,
  saveShippingLabel,
  getShippingLabelSummary,
  getShippingLabelImage,
  markOrderShipped,
  blogCategorySlugExists,
  blogSlugExists,
  createBlogCategory,
  createBlogPost,
  deleteBlogCategory,
  deleteBlogPost,
  getBlogCategories,
  getBlogCategoriesWithPublishedPosts,
  getBlogPostForAdmin,
  getBlogPostsForAdmin,
  getPublishedBlogPostBySlug,
  getPublishedBlogPosts,
  setBlogPostCategories,
  updateBlogCategory,
  updateBlogPost,
} from "./db";
import { storagePut } from "./storage";
import { compressImage } from "./imageProcessing";
import { getBulkDiscountTiers, priceOrder, resolveCoupon } from "./pricing";
import {
  buildCheckoutReturnUrls,
  buildCheckoutSessionParams,
  getStripe,
  isStripeConfigured,
} from "./stripe";
import { settleOrderRewards } from "./rewards";
import {
  MIN_PAYOUT_AMOUNT,
  REFERRAL_DISCOUNT_PERCENT,
  buildCodeBase,
  buildCodeCandidate,
  buildFallbackBase,
  checkPayoutEligibility,
  computePayoutBalance,
  isSelfReferral,
  normalizeReferralCode,
} from "./affiliate";

// ─── Admin middleware ─────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// Normalizes an optional text input to undefined when blank, so a cleared
// form field (e.g. an empty <input type="date">) can never reach a `new
// Date("")` conversion downstream — defense-in-depth on top of whatever the
// client already does, since "" is a valid string that passes z.string()
// but is invalid as a timestamp value.
const optionalTrimmedString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v : undefined));

// Same idea, but for fields that also accept an explicit `null` to mean
// "clear this value" (as opposed to `undefined`, meaning "field not sent,
// leave it alone") — e.g. coupons.update's expiresAt.
const optionalTrimmedStringNullable = z
  .string()
  .nullable()
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    return v.trim() !== "" ? v : null;
  });

// A decimal column that the admin may leave blank. An empty input must land
// as null — storing "" would make a weightless product look like it weighs
// nothing, and nothing is a rate we would actually charge.
const optionalDecimal = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? s : null;
  });

/**
 * The shipping option a shopper chose, priced from what this server quoted.
 *
 * The browser sends an opaque quote id and a service code and never a price.
 * Anything that fails to line up — an expired quote, a cart edited after
 * quoting, a service that was not among the offers — resolves to no shipping
 * rather than to a guess, so the worst case is a checkout that asks the shopper
 * to pick again, never an order that charges the wrong amount.
 */
function resolveChosenShipping(input: {
  items: Array<{ productId: number; variationId?: number; quantity: number }>;
  shippingQuoteId?: string;
  shippingService?: string;
  shippingZip?: string;
}): { serviceCode: string; serviceName: string; amount: number } | null {
  if (!input.shippingQuoteId || !input.shippingService || !input.shippingZip) return null;

  const hash = cartFingerprint(input.items, input.shippingZip);
  const found = resolveQuotedRate(input.shippingQuoteId, input.shippingService, hash);
  if (!found.ok) return null;

  return {
    serviceCode: found.rate.serviceCode,
    serviceName: found.rate.serviceName,
    amount: found.rate.amount,
  };
}

const WHOLESALE_VOLUME_LABELS: Record<string, string> = {
  "25k_50k": "$25,000 - $50,000",
  "50k_100k": "$50,000 - $100,000",
  "100k_500k": "$100,000 - $500,000",
  over_1m: "Over $1,000,000",
};

// ─── JWT helpers ──────────────────────────────────────────────────────────────
// Sign a session token in the SAME format the SDK.verifySession expects:
// { openId, appId, name } — this allows authenticateRequest to recognize email-auth users
async function signEmailSession(user: { openId: string; name: string | null }) {
  const JWT_SECRET = new TextEncoder().encode(ENV.cookieSecret || "fallback-secret-change-me");
  const expiresInMs = 30 * 24 * 60 * 60 * 1000;
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
  return new SignJWT({
    openId: user.openId,
    appId: ENV.appId || "email-auth",
    name: user.name || "",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(JWT_SECRET);
}


// ─── Blog input helpers ───────────────────────────────────────────────────────

const blogPostInput = z.object({
  title: z.string().min(1).max(200),
  /** Optional: derived from the title when the admin leaves it blank. */
  slug: z.string().max(BLOG_SLUG_MAX_LENGTH).optional(),
  excerpt: z.string().max(300).optional(),
  /** A stringified ProseMirror document — validated by serializeBlogContent. */
  content: z.string().optional(),
  coverImageUrl: z.string().max(500).nullable().optional(),
  coverImageKey: z.string().max(500).nullable().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  categoryIds: z.array(z.number()).optional(),
});

const blogCategoryInput = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
});

/**
 * Settles on the slug to store: what the admin typed, or the title slugified
 * when they typed nothing. Run over the admin's own input too, so a slug
 * pasted with spaces or capitals can't reach the database as a broken URL.
 */
function normalizeBlogSlug(slug: string | undefined, fallback: string) {
  const candidate = slugifyBlogTitle((slug ?? "").trim() || fallback);
  if (!candidate) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Could not derive a URL from this title — enter a slug manually",
    });
  }
  return candidate;
}

/**
 * Validates the editor's output and returns the JSON to store.
 *
 * Re-serializing from the parsed document rather than passing the string
 * through means only `type` and `content` survive: anything else the client
 * attached to the top level is dropped before it reaches the column.
 */
function serializeBlogContent(content: string | undefined): string | null {
  if (content === undefined || content.trim() === "") return null;
  const doc = parseBlogDoc(content);
  if (!doc) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Article content is not a valid document" });
  }
  return JSON.stringify(doc);
}

/** Blank excerpts are stored as NULL, so the fallback description kicks in. */
function normalizeExcerpt(excerpt: string | undefined) {
  return excerpt?.trim() ? excerpt.trim() : null;
}

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    // Explicit field list rather than the raw row: ctx.user is the full users
    // record, and returning it whole shipped every bcrypt passwordHash to the
    // browser on each session check.
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const { id, name, email, role, points, createdAt } = ctx.user;
      return { id, name, email, role, points, createdAt };
    }),

    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2).max(100),
          email: z.string().email(),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        const openId = `email_${nanoid(16)}`;
        await upsertUser({
          openId,
          name: input.name,
          email: input.email,
          passwordHash,
          loginMethod: "email",
          role: "user",
          lastSignedIn: new Date(),
        });
        const user = await getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const token = await signEmailSession({ openId: user.openId, name: user.name });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }
        await upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const token = await signEmailSession({ openId: user.openId, name: user.name });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    /**
     * Starts a password reset.
     *
     * Every path through this returns the same object. An unknown address, a
     * known one, an account with no password, a spent rate limit — all answer
     * "if that address is registered, a link is on its way". Anything that
     * distinguished them would turn this endpoint into a way to ask the site
     * which of a list of addresses hold accounts, which is exactly the question
     * a reset form must refuse to answer.
     *
     * That includes failure: the send is awaited but its result is discarded,
     * because "we tried and the provider was down" is still not the caller's
     * business.
     */
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320) }))
      .mutation(async ({ input, ctx }) => {
        const identicalResponse = {
          success: true as const,
          message: "If that address is registered, we've sent a reset link.",
        };

        const email = input.email.toLowerCase();
        const allowed = consumeResetAttempt(resetAttemptKey(email, ctx.req.ip));
        if (!allowed) return identicalResponse;

        const user = await getUserByEmail(email);
        // No password on the account means it signs in through OAuth, and
        // there is nothing here to reset.
        if (!user || !user.passwordHash) return identicalResponse;

        const token = generateResetToken();
        await createPasswordResetToken(
          user.id,
          hashResetToken(token),
          new Date(Date.now() + RESET_TOKEN_TTL_MS)
        );

        const resetUrl = buildResetUrl(ENV.publicSiteUrl, token);

        // Development fallback: without RESEND_API_KEY the email is skipped
        // silently, which would leave the flow untestable locally. The link is
        // a live credential, so this is gated on not being production.
        if (!ENV.isProduction) {
          console.log(`\n[password-reset] Link for ${email}:\n${resetUrl}\n`);
        }

        await sendEmail({
          to: user.email ?? email,
          subject: "Reset your Brighter Days Labs password",
          html: buildResetEmailHtml(resetUrl),
        });

        return identicalResponse;
      }),

    /**
     * Finishes a reset.
     *
     * Unlike the request side, this one does report failure: the holder of a
     * dead link has already proved nothing about who is registered, and
     * "expired or already used" is what they need to know to ask for another.
     */
    resetPassword: publicProcedure
      .input(
        z.object({
          token: z.string().min(1),
          password: z.string().min(8, "Password must be at least 8 characters"),
        })
      )
      .mutation(async ({ input }) => {
        const expired = new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link has expired or already been used. Please request a new one.",
        });

        const tokenHash = hashResetToken(input.token);
        const row = await getPasswordResetTokenByHash(tokenHash);
        if (!row || !hashesMatch(row.tokenHash, tokenHash)) throw expired;
        if (!isResetTokenUsable(row)) throw expired;

        // Spend it before writing the password: if two requests race, only the
        // one that wins this update gets to set anything.
        const spent = await consumePasswordResetToken(row.id);
        if (!spent) throw expired;

        await updateUserPassword(row.userId, await bcrypt.hash(input.password, 12));

        return { success: true as const };
      }),
  }),

  // ─── Categories ────────────────────────────────────────────────────────────
  categories: router({
    list: publicProcedure.query(() => getAllCategories()),

    byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) =>
      getCategoryById(input.id)
    ),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          slug: z.string().min(1).max(120),
          description: z.string().optional(),
          color: z.string().optional(),
          badgeCode: z.string().max(10).optional(),
          tagline: z.string().max(300).optional(),
          ctaText: z.string().max(50).optional(),
          questionText: z.string().max(200).optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(({ input }) => createCategory(input)),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(100).optional(),
          slug: z.string().min(1).max(120).optional(),
          description: z.string().optional(),
          color: z.string().optional(),
          badgeCode: z.string().max(10).optional(),
          tagline: z.string().max(300).optional(),
          ctaText: z.string().max(50).optional(),
          questionText: z.string().max(200).optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateCategory(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCategory(input.id)),

    uploadHeroImage: adminProcedure
      .input(
        z.object({
          categoryId: z.number(),
          fileBase64: z.string(),
          fileName: z.string(),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { buffer, mimeType } = await compressImage(Buffer.from(input.fileBase64, "base64"), input.mimeType, 1600);
        const relKey = `categories/${input.categoryId}/${nanoid(10)}_${input.fileName}`;
        const { key: heroImageKey, url: heroImageUrl } = await storagePut(relKey, buffer, mimeType);
        return updateCategory(input.categoryId, { heroImageUrl, heroImageKey });
      }),
  }),

  // ─── Products ──────────────────────────────────────────────────────────────
  products: router({
    list: publicProcedure
      .input(
        z.object({
          categoryId: z.number().optional(),
          search: z.string().optional(),
          featured: z.boolean().optional(),
          sortBy: z.enum(["price_asc", "price_desc", "name_asc", "name_desc", "featured"]).optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        }).optional()
      )
      .query(({ input }) =>
        getProducts({ ...input, active: true })
      ),

    listAdmin: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional())
      .query(({ input }) => getProducts({ ...input })),

    byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) =>
      getProductById(input.id)
    ),

    bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) =>
      getProductBySlug(input.slug)
    ),

    images: publicProcedure.input(z.object({ productId: z.number() })).query(({ input }) =>
      getProductImages(input.productId)
    ),

    variations: publicProcedure.input(z.object({ productId: z.number() })).query(({ input }) =>
      getProductVariations(input.productId)
    ),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(200),
          slug: z.string().min(1).max(220),
          description: z.string().optional(),
          shortDescription: z.string().optional(),
          categoryId: z.number().optional(),
          basePrice: z.string(),
          featured: z.boolean().optional(),
          active: z.boolean().optional(),
          mechanism: z.string().optional(),
          casNumber: z.string().optional(),
          excludeFromBulkDiscount: z.boolean().optional(),
          weightOz: optionalDecimal,
        })
      )
      .mutation(({ input }) => createProduct(input)),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          slug: z.string().optional(),
          description: z.string().optional(),
          shortDescription: z.string().optional(),
          categoryId: z.number().nullable().optional(),
          basePrice: z.string().optional(),
          featured: z.boolean().optional(),
          active: z.boolean().optional(),
          mechanism: z.string().optional(),
          casNumber: z.string().optional(),
          excludeFromBulkDiscount: z.boolean().optional(),
          weightOz: optionalDecimal,
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateProduct(id, data as Parameters<typeof updateProduct>[1]);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteProduct(input.id)),

    // Image upload
    uploadImage: adminProcedure
      .input(
        z.object({
          productId: z.number(),
          variationId: z.number().optional(),
          fileBase64: z.string(),
          fileName: z.string(),
          mimeType: z.string(),
          altText: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { buffer, mimeType } = await compressImage(Buffer.from(input.fileBase64, "base64"), input.mimeType, 1200);
        const relKey = input.variationId
          ? `products/${input.productId}/variations/${input.variationId}/${nanoid(10)}_${input.fileName}`
          : `products/${input.productId}/${nanoid(10)}_${input.fileName}`;
        const { key: fileKey, url } = await storagePut(relKey, buffer, mimeType);
        await addProductImage({
          productId: input.productId,
          variationId: input.variationId,
          url,
          fileKey,
          altText: input.altText,
          sortOrder: input.sortOrder ?? 0,
        });
        return { url, fileKey };
      }),

    deleteImage: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteProductImage(input.id)),

    // Variations
    createVariation: adminProcedure
      .input(
        z.object({
          productId: z.number(),
          unit: z.enum(["mg", "ml"]),
          value: z.string(),
          price: z.string(),
          stock: z.number().optional(),
          sku: z.string().optional(),
          active: z.boolean().optional(),
          // Null falls back to the product's weight — see shared/shipping.ts.
          weightOz: optionalDecimal,
        })
      )
      .mutation(({ input }) => createVariation(input)),

    updateVariation: adminProcedure
      .input(
        z.object({
          id: z.number(),
          unit: z.enum(["mg", "ml"]).optional(),
          value: z.string().optional(),
          price: z.string().optional(),
          stock: z.number().optional(),
          sku: z.string().optional(),
          active: z.boolean().optional(),
          weightOz: optionalDecimal,
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateVariation(id, data as Parameters<typeof updateVariation>[1]);
      }),

    deleteVariation: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteVariation(input.id)),
  }),

  // ─── Cart ──────────────────────────────────────────────────────────────────
  cart: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const items = await getCartItems(ctx.user.id);
      const enriched = await Promise.all(
        items.map(async (item) => {
          const product = await getProductById(item.productId);
          const variation = item.variationId ? await getVariationById(item.variationId) : null;
          const images = product ? await getProductImages(product.id) : [];
          return {
            ...item,
            product,
            variation,
            image: images[0]?.url ?? null,
          };
        })
      );
      return enriched;
    }),

    add: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          variationId: z.number().optional(),
          quantity: z.number().min(1).default(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await upsertCartItem({
          userId: ctx.user.id,
          productId: input.productId,
          variationId: input.variationId,
          quantity: input.quantity,
        });
        return { success: true };
      }),

    updateQuantity: protectedProcedure
      .input(z.object({ id: z.number(), quantity: z.number().min(0) }))
      .mutation(({ input }) => updateCartItemQuantity(input.id, input.quantity)),

    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => removeCartItem(input.id)),

    clear: protectedProcedure.mutation(({ ctx }) => clearCart(ctx.user.id)),
  }),

  // ─── Coupons ───────────────────────────────────────────────────────────────
  coupons: router({
    // Preview only. The binding calculation happens in orders.create, through
    // the same resolveCoupon(), so the quote here can never differ from the
    // amount actually charged.
    validate: publicProcedure
      .input(z.object({ code: z.string(), orderAmount: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const coupon = await resolveCoupon(input.code, input.orderAmount, ctx.user?.id);
        return {
          valid: true,
          coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value },
          discount: coupon.discount,
        };
      }),

    getActiveNewCustomerOffer: publicProcedure.query(async () => {
      const coupon = await getActiveNewCustomerOfferCoupon();
      if (!coupon) return null;
      return { id: coupon.id, code: coupon.code, type: coupon.type, value: Number(coupon.value) };
    }),

    claimWelcomeOffer: protectedProcedure.mutation(async ({ ctx }) => {
      const coupon = await getActiveNewCustomerOfferCoupon();
      if (!coupon) throw new TRPCError({ code: "NOT_FOUND", message: "No active welcome offer" });
      const existing = await getWelcomeRedemption(ctx.user.id, coupon.id);
      if (!existing) {
        await createWelcomeRedemption({ userId: ctx.user.id, couponId: coupon.id });
      }
      return { code: coupon.code, type: coupon.type, value: Number(coupon.value) };
    }),

    setNewCustomerOffer: adminProcedure
      .input(z.object({ id: z.number(), enabled: z.boolean() }))
      .mutation(({ input }) => setNewCustomerOfferCoupon(input.id, input.enabled)),

    list: adminProcedure.query(() => getAllCoupons()),

    create: adminProcedure
      .input(
        z.object({
          code: z.string().min(3).max(50),
          type: z.enum(["percentage", "fixed"]),
          value: z.string(),
          minOrderAmount: z.string().optional(),
          maxUses: z.number().optional(),
          active: z.boolean().optional(),
          expiresAt: optionalTrimmedString,
        })
      )
      .mutation(({ input }) =>
        createCoupon({
          ...input,
          code: input.code.toUpperCase(),
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        })
      ),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          code: z.string().optional(),
          type: z.enum(["percentage", "fixed"]).optional(),
          value: z.string().optional(),
          minOrderAmount: z.string().optional(),
          maxUses: z.number().nullable().optional(),
          active: z.boolean().optional(),
          expiresAt: optionalTrimmedStringNullable,
        })
      )
      .mutation(({ input }) => {
        const { id, expiresAt, ...rest } = input;
        return updateCoupon(id, {
          ...rest,
          ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
        } as Parameters<typeof updateCoupon>[1]);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCoupon(input.id)),
  }),

  // ─── Orders ────────────────────────────────────────────────────────────────
  orders: router({
    /**
     * Prices the cart without creating anything.
     *
     * The checkout summary used to add up prices the browser captured when each
     * item was added, while the charge was re-derived from the catalog. Those
     * two numbers drift apart whenever a line crosses a volume tier or an admin
     * edits a price, so the shopper could be quoted one amount and charged
     * another. This runs the identical priceOrder() the order will be built
     * from, making the summary and the Stripe amount the same number by
     * construction.
     *
     * Deliberately not tolerant of a bad cart: if this throws, orders.create
     * would throw the same way, and the shopper is better off seeing it here.
     */
    quote: publicProcedure
      .input(
        z.object({
          items: z.array(
            z.object({
              productId: z.number(),
              variationId: z.number().optional(),
              quantity: z.number().min(1),
            })
          ),
          couponCode: z.string().optional(),
          referralCode: z.string().optional(),
          email: z.string().optional(),
          shippingQuoteId: z.string().optional(),
          shippingService: z.string().max(10).optional(),
          // Part of what a quote was for: rates depend on the destination, so a
          // quote taken for one postcode must not price another.
          shippingZip: z.string().max(20).optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        // Looked up, not received: the browser names a service, the price comes
        // from what this server quoted for this exact cart.
        const chosen = resolveChosenShipping(input);

        const priced = await priceOrder(input.items, {
          couponCode: input.couponCode,
          referralCode: input.referralCode,
          userId: ctx.user?.id,
          buyerEmails: [input.email, ctx.user?.email],
          shipping: chosen?.amount ?? 0,
        });

        return {
          items: priced.items,
          subtotal: priced.subtotal,
          discount: priced.discount,
          shipping: priced.shipping,
          shippingService: chosen?.serviceCode ?? null,
          shippingServiceName: chosen?.serviceName ?? null,
          total: priced.total,
          appliedDiscount: priced.appliedDiscount,
          couponCode: priced.coupon?.code,
          // A self-referral resolves to a zero-value referral; the summary needs
          // to know not to promise a discount that will not arrive.
          referralRejected: priced.referral?.rejectedReason !== undefined,
        };
      }),

    create: publicProcedure
      .input(
        z.object({
          // Only what the shopper chose. Names and prices are looked up server
          // side — see priceOrder() — because this total is what Stripe charges.
          items: z.array(
            z.object({
              productId: z.number(),
              variationId: z.number().optional(),
              quantity: z.number().min(1),
            })
          ),
          couponCode: z.string().optional(),
          referralCode: z.string().optional(),
          shippingQuoteId: z.string().optional(),
          shippingService: z.string().max(10).optional(),
          researcherType: z.enum([
            "private_researcher",
            "lab_company_researcher",
            "government_entity_researcher",
          ]),
          // Shape first, then the actual requirement. The browser runs this same
          // check, but that one is a convenience — this is the one that decides,
          // because nothing stops a client from posting straight here. Evaluated
          // per request, so eligibility is judged at the time of the order.
          dateOfBirth: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date of birth")
            .refine((value) => isOfLegalAge(value), AGE_REQUIREMENT_MESSAGE),
          shipping: z.object({
            firstName: z.string(),
            lastName: z.string(),
            email: z.string().email(),
            phone: z.string().optional(),
            address: z.string(),
            city: z.string(),
            // Required rather than optional: a parcel needs a region and a
            // postal code to actually arrive, and accepting the order without
            // them only defers the failure to the carrier.
            state: z.string().min(1, "State / province is required"),
            zip: z.string().min(1, "ZIP / postal code is required"),
            // Checked against the list the picker offers, so a client that
            // skips the select cannot store a country we do not recognise.
            country: z
              .string()
              .refine(isSupportedCountry, "Unrecognised shipping country"),
          }),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Re-resolved here against the address actually being shipped to, so a
        // quote taken for one destination cannot pay for another.
        const chosenShipping = resolveChosenShipping({
          items: input.items,
          shippingQuoteId: input.shippingQuoteId,
          shippingService: input.shippingService,
          shippingZip: input.shipping.zip,
        });

        const priced = await priceOrder(input.items, {
          couponCode: input.couponCode,
          referralCode: input.referralCode,
          userId: ctx.user?.id,
          // Both addresses that identify the buyer, so a self-referral cannot
          // hide behind a different shipping email.
          buyerEmails: [input.shipping.email, ctx.user?.email],
          shipping: chosenShipping?.amount ?? 0,
        });
        const { subtotal, discount, total } = priced;

        const newOrderId = await createOrder({
          userId: ctx.user?.id ?? null,
          subtotal: subtotal.toFixed(2),
          discountAmount: discount.toFixed(2),
          total: total.toFixed(2),
          // The name is stored as well as the code: it is what the shopper was
          // shown and agreed to, and re-deriving it later would rewrite that if
          // the shop ever changes which services it offers.
          shippingService: chosenShipping?.serviceCode,
          shippingServiceName: chosenShipping?.serviceName,
          shippingCost: priced.shipping.toFixed(2),
          couponId: priced.appliedDiscount === "coupon" ? priced.coupon?.id : undefined,
          couponCode: priced.appliedDiscount === "coupon" ? priced.coupon?.code : undefined,
          researcherType: input.researcherType,
          dateOfBirth: input.dateOfBirth,
          shippingFirstName: input.shipping.firstName,
          shippingLastName: input.shipping.lastName,
          shippingEmail: input.shipping.email,
          shippingPhone: input.shipping.phone,
          shippingAddress: input.shipping.address,
          shippingCity: input.shipping.city,
          shippingState: input.shipping.state,
          shippingZip: input.shipping.zip,
          shippingCountry: input.shipping.country,
          notes: input.notes,
          status: "pending",
          paymentStatus: "pending",
        });

        const newOrder = { id: newOrderId };

        for (const item of priced.items) {
          await createOrderItem({
            orderId: newOrder.id,
            productId: item.productId,
            variationId: item.variationId,
            productName: item.productName,
            variationLabel: item.variationLabel,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toFixed(2),
            subtotal: item.subtotal.toFixed(2),
          });
        }

        // Only burn the coupon if it is the discount that actually applied.
        // When a referral beats it, the code was never spent — and marking a
        // single-use welcome coupon as redeemed for a discount the buyer did
        // not receive would quietly destroy it.
        if (priced.coupon && priced.appliedDiscount === "coupon") {
          await incrementCouponUsage(priced.coupon.id);
          if (ctx.user) {
            await markWelcomeRedemptionUsed(ctx.user.id, priced.coupon.id, newOrder.id);
          }
        }

        // A rejected referral is still recorded: the commission is zero and no
        // discount was given, but the attempt has to be visible to the admin.
        if (priced.referral) {
          await createAffiliateReferral({
            affiliateCodeId: priced.referral.affiliateCodeId,
            orderId: newOrder.id,
            referredUserId: ctx.user?.id ?? null,
            commissionAmount: priced.referral.commission.toFixed(2),
            status: priced.referral.rejectedReason ? "rejected" : "pending",
          });
        }

        if (ctx.user) {
          await clearCart(ctx.user.id);
        }

        // Notify admin
        try {
          const itemsList = priced.items
            .map((i) => `${i.productName}${i.variationLabel ? ` (${i.variationLabel})` : ""} x${i.quantity} — $${i.subtotal.toFixed(2)}`)
            .join("\n");
          await notifyOwner({
            title: `New Order #${newOrder.id}`,
            content: `New order received!\n\nCustomer: ${input.shipping.firstName} ${input.shipping.lastName}\nEmail: ${input.shipping.email}\n\nItems:\n${itemsList}\n\nSubtotal: $${subtotal.toFixed(2)}\nDiscount: $${discount.toFixed(2)}\nTotal: $${total.toFixed(2)}`
          });
        } catch (e) {
          console.warn("Failed to send admin notification", e);
        }

        return { success: true, orderId: newOrder.id };
      }),

    myOrders: protectedProcedure.query(({ ctx }) => getOrdersByUser(ctx.user.id)),

    detail: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      const order = await getOrderById(input.id);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const items = await getOrderItems(order.id);
      return { ...order, items };
    }),

    // Admin
    adminList: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional())
      .query(({ input }) => getAllOrders(input?.limit, input?.offset)),

    adminDetail: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const order = await getOrderById(input.id);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const items = await getOrderItems(order.id);
      return { ...order, items };
    }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
          paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Read first: rewards are owed on the *transition* into paid, not on
        // every save of an already-paid order.
        const before = await getOrderById(input.id);
        await updateOrderStatus(input.id, input.status, input.paymentStatus);

        const becamePaid =
          input.paymentStatus === "paid" && before !== undefined && before.paymentStatus !== "paid";
        if (becamePaid) {
          // Same path the Stripe webhook takes, so an order settled by transfer
          // earns the buyer the same points and the affiliate the same
          // commission as one paid by card.
          await settleOrderRewards(input.id);
        }

        return { success: true };
      }),
  }),

  // ─── Account ───────────────────────────────────────────────────────────────
  account: router({
    /** Everything the My Account stat grid shows. */
    stats: protectedProcedure.query(async ({ ctx }) => {
      const [orderStats, referrals] = await Promise.all([
        getUserOrderStats(ctx.user.id),
        getReferralsByUserId(ctx.user.id),
      ]);

      return {
        orderCount: orderStats.orderCount,
        totalSpent: orderStats.totalSpent,
        points: ctx.user.points,
        // Self-referral attempts are not achievements — they never count here.
        referralCount: referrals.filter((r) => r.status !== "rejected").length,
      };
    }),
  }),

  // ─── Affiliate ─────────────────────────────────────────────────────────────
  affiliate: router({
    /**
     * The caller's share code, created on first view. There is no application
     * step: opening the affiliate tab is the enrolment.
     */
    myCode: protectedProcedure.mutation(async ({ ctx }) => {
      const existing = await getAffiliateCodeByUserId(ctx.user.id);
      if (existing) return existing;

      const base =
        buildCodeBase(ctx.user.name, ctx.user.email) ?? buildFallbackBase(ctx.user.id);

      // Walk candidates until one is free. Bounded so a pathological run of
      // collisions fails loudly instead of looping.
      for (let attempt = 0; attempt < 50; attempt++) {
        const candidate = buildCodeCandidate(base, attempt);
        if (await getAffiliateCodeByCode(candidate)) continue;
        try {
          return await createAffiliateCode({ userId: ctx.user.id, code: candidate });
        } catch {
          // Lost a race on the unique index — either someone took the code, or
          // this user got one in a parallel request. Re-read before retrying.
          const raced = await getAffiliateCodeByUserId(ctx.user.id);
          if (raced) return raced;
        }
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not allocate an affiliate code. Please try again.",
      });
    }),

    /** Referral history plus the balance and payout state behind the button. */
    myDashboard: protectedProcedure.query(async ({ ctx }) => {
      const code = await getAffiliateCodeByUserId(ctx.user.id);
      if (!code) {
        return {
          code: null,
          referrals: [],
          balance: 0,
          minPayout: MIN_PAYOUT_AMOUNT,
          canRequestPayout: false,
          payoutBlockedReason: "below_minimum" as const,
          payoutRequests: [],
        };
      }

      const [referrals, pending, payoutRequests] = await Promise.all([
        getReferralsByAffiliateCodeId(code.id),
        getPendingPayoutRequest(ctx.user.id),
        getPayoutRequestsByUserId(ctx.user.id),
      ]);

      const balance = computePayoutBalance(referrals);
      const eligibility = checkPayoutEligibility(balance, pending !== undefined);

      return {
        code: code.code,
        referrals,
        balance,
        minPayout: MIN_PAYOUT_AMOUNT,
        canRequestPayout: eligibility.allowed,
        payoutBlockedReason: eligibility.allowed ? null : eligibility.reason,
        payoutRequests,
      };
    }),

    requestPayout: protectedProcedure.mutation(async ({ ctx }) => {
      const code = await getAffiliateCodeByUserId(ctx.user.id);
      if (!code) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You have no affiliate code yet." });
      }

      // Balance and eligibility are recomputed here rather than trusted from
      // the dashboard call — this is the request that creates a debt.
      const [referrals, pending] = await Promise.all([
        getReferralsByAffiliateCodeId(code.id),
        getPendingPayoutRequest(ctx.user.id),
      ]);
      const balance = computePayoutBalance(referrals);
      const eligibility = checkPayoutEligibility(balance, pending !== undefined);

      if (!eligibility.allowed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            eligibility.reason === "request_pending"
              ? "You already have a payout request awaiting review."
              : `You need at least ${MIN_PAYOUT_AMOUNT.toFixed(2)} in eligible commissions.`,
        });
      }

      const requestId = await createPayoutRequest(ctx.user.id, code.id, balance);
      return { success: true, requestId, amountRequested: balance };
    }),

    /**
     * Checkout-time check, before the order exists.
     *
     * Never throws for a self-referral: the buyer is told the code cannot be
     * used and is free to continue without it. The attempt is only recorded if
     * they submit the order anyway, since a referral row needs an order to
     * point at.
     */
    validateCode: publicProcedure
      .input(z.object({ code: z.string(), email: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const normalized = normalizeReferralCode(input.code);
        if (!normalized) {
          return { valid: false as const, reason: "unknown_code" as const, message: "Enter a referral code." };
        }

        const affiliateCode = await getAffiliateCodeByCode(normalized);
        if (!affiliateCode) {
          return {
            valid: false as const,
            reason: "unknown_code" as const,
            message: "That referral code doesn't exist.",
          };
        }

        const owner = await getUserById(affiliateCode.userId);
        if (
          isSelfReferral({
            buyerUserId: ctx.user?.id,
            buyerEmails: [input.email, ctx.user?.email],
            ownerUserId: affiliateCode.userId,
            ownerEmail: owner?.email,
          })
        ) {
          return {
            valid: false as const,
            reason: "self_referral" as const,
            message: "This referral code can't be used on your own account.",
          };
        }

        return {
          valid: true as const,
          code: affiliateCode.code,
          discountPercent: REFERRAL_DISCOUNT_PERCENT,
        };
      }),

    // ─── Admin ───────────────────────────────────────────────────────────────
    adminPayoutRequests: adminProcedure
      .input(z.object({ status: z.enum(["pending", "paid", "rejected"]).optional() }).optional())
      .query(({ input }) => getAllPayoutRequests(input?.status)),

    adminOverview: adminProcedure.query(() => getAffiliatesOverview()),

    /** Self-referral attempts, for abuse monitoring. */
    adminRejectedReferrals: adminProcedure.query(() => getRejectedReferrals()),

    adminSettlePayout: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["paid", "rejected"]),
          adminNotes: optionalTrimmedString,
        })
      )
      .mutation(async ({ input }) => {
        const result = await settlePayoutRequest(input.id, input.status, input.adminNotes);
        if (!result.updated) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              result.reason === "already_settled"
                ? "That payout request was already settled."
                : "Payout request not found.",
          });
        }
        return { success: true };
      }),
  }),

  // ─── Payments ──────────────────────────────────────────────────────────────
  payments: router({
    /**
     * Opens a Stripe Checkout session for an already-created order.
     *
     * publicProcedure because checkout allows guests, but an order that belongs
     * to a registered account can only be paid by that account — otherwise the
     * endpoint would confirm the existence and total of anyone's order id.
     */
    createCheckoutSession: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!isStripeConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Card payments are not available right now.",
          });
        }

        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

        if (order.userId !== null && order.userId !== ctx.user?.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (order.paymentStatus === "paid") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This order has already been paid.",
          });
        }
        if (order.status === "cancelled") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This order was cancelled." });
        }
        // Stripe refuses charges under ~$0.50, so a fully-discounted order can
        // never go through Checkout. Fail with something a human can act on
        // instead of surfacing a raw Stripe amount error.
        if (Number(order.total) < 0.5) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This order total is too low to charge online. We'll contact you to complete it.",
          });
        }

        const items = await getOrderItems(order.id);

        // buildCheckoutSessionParams runs assertPayloadIsSanitized over
        // everything below before it is handed to the SDK.
        // The referral code is passed as a forbidden value, not because it is
        // in the payload today, but so that it fails loudly if it ever is.
        const referral = await getReferralByOrderId(order.id);
        const referralCode = referral
          ? (await getAffiliateCodeById(referral.affiliateCodeId))?.code
          : undefined;

        const params = buildCheckoutSessionParams(
          order,
          items,
          buildCheckoutReturnUrls(order.id),
          [referralCode]
        );

        const session = await getStripe().checkout.sessions.create(params);
        if (!session.url) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Stripe did not return a checkout URL.",
          });
        }

        await setOrderPaymentSession(order.id, session.id);

        return { url: session.url };
      }),
  }),

  // ─── Admin Dashboard ───────────────────────────────────────────────────────

  // ─── Lab Reports ──────────────────────────────────────────────────────────────
  labReports: router({
    byProduct: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => getLabReportsByProduct(input.productId)),

    all: adminProcedure.query(() => getAllLabReports()),

    recent: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
      .query(({ input }) => getRecentPublicLabReports(input?.limit ?? 6)),

    upload: adminProcedure
      .input(
        z.object({
          productId: z.number(),
          title: z.string().min(1),
          description: optionalTrimmedString,
          batchNumber: optionalTrimmedString,
          testDate: optionalTrimmedString,
          fileBase64: z.string(),
          fileName: z.string(),
          fileSize: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const key = `lab-reports/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { url } = await storagePut(key, buffer, "application/pdf");
        const id = await createLabReport({
          productId: input.productId,
          title: input.title,
          description: input.description ?? null,
          fileUrl: url,
          fileKey: key,
          fileName: input.fileName,
          fileSize: input.fileSize ?? null,
          batchNumber: input.batchNumber ?? null,
          testDate: input.testDate ? new Date(input.testDate) : null,
          active: true,
        });
        return { id, url };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteLabReport(input.id)),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).optional(),
          description: optionalTrimmedString,
          batchNumber: optionalTrimmedString,
          testDate: optionalTrimmedString,
          active: z.boolean().optional(),
          fileBase64: z.string().optional(),
          fileName: z.string().optional(),
          fileSize: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, fileBase64, fileName, fileSize, testDate, ...rest } = input;
        const data: Partial<InsertLabReport> = { ...rest };
        if (testDate !== undefined) data.testDate = testDate ? new Date(testDate) : null;
        if (fileBase64 && fileName) {
          const buffer = Buffer.from(fileBase64, "base64");
          const key = `lab-reports/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { url } = await storagePut(key, buffer, "application/pdf");
          data.fileUrl = url;
          data.fileKey = key;
          data.fileName = fileName;
          data.fileSize = fileSize ?? null;
        }
        return updateLabReport(id, data);
      }),
  }),

  // ─── Blog ─────────────────────────────────────────────────────────────────
  //
  // The public procedures here call getPublishedBlogPosts /
  // getPublishedBlogPostBySlug, which filter on status in SQL and take no
  // parameter that could turn the filter off. Draft visibility is therefore a
  // property of which function is called, not of what the client sends, and
  // the admin reads go through separate adminProcedure endpoints.
  blog: router({
    list: publicProcedure
      .input(
        z
          .object({
            categorySlug: optionalTrimmedString,
            limit: z.number().min(1).max(100).optional(),
            offset: z.number().min(0).optional(),
          })
          .optional()
      )
      .query(({ input }) =>
        getPublishedBlogPosts({
          categorySlug: input?.categorySlug,
          limit: input?.limit ?? 30,
          offset: input?.offset ?? 0,
        })
      ),

    bySlug: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .query(({ input }) => getPublishedBlogPostBySlug(input.slug)),

    categories: publicProcedure.query(() => getBlogCategoriesWithPublishedPosts()),

    // ── Admin ──
    adminList: adminProcedure.query(() => getBlogPostsForAdmin()),

    adminById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getBlogPostForAdmin(input.id)),

    /** Includes drafts and every category, each with its article count. */
    adminCategories: adminProcedure.query(() => getBlogCategories()),

    create: adminProcedure.input(blogPostInput).mutation(async ({ input, ctx }) => {
      const slug = normalizeBlogSlug(input.slug, input.title);
      if (await blogSlugExists(slug)) {
        throw new TRPCError({ code: "CONFLICT", message: `The slug "${slug}" is already in use` });
      }

      const id = await createBlogPost({
        title: input.title,
        slug,
        excerpt: normalizeExcerpt(input.excerpt),
        content: serializeBlogContent(input.content),
        coverImageUrl: input.coverImageUrl ?? null,
        coverImageKey: input.coverImageKey ?? null,
        status: input.status,
        publishedAt: resolvePublishedAt(input.status, null),
        // Taken from the session, never from the request: the author is
        // whoever is signed in as admin.
        authorId: ctx.user.id,
      });

      if (input.categoryIds) await setBlogPostCategories(id, input.categoryIds);
      return { id, slug };
    }),

    update: adminProcedure
      .input(blogPostInput.partial().extend({ id: z.number() }))
      .mutation(async ({ input }) => {
        const existing = await getBlogPostForAdmin(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });

        const data: Partial<InsertBlogPost> = {};

        if (input.title !== undefined) data.title = input.title;
        if (input.excerpt !== undefined) data.excerpt = normalizeExcerpt(input.excerpt);
        if (input.content !== undefined) data.content = serializeBlogContent(input.content);
        if (input.coverImageUrl !== undefined) data.coverImageUrl = input.coverImageUrl ?? null;
        if (input.coverImageKey !== undefined) data.coverImageKey = input.coverImageKey ?? null;

        if (input.slug !== undefined || input.title !== undefined) {
          const slug = normalizeBlogSlug(input.slug ?? existing.slug, input.title ?? existing.title);
          if (slug !== existing.slug) {
            if (await blogSlugExists(slug, input.id)) {
              throw new TRPCError({
                code: "CONFLICT",
                message: `The slug "${slug}" is already in use`,
              });
            }
            data.slug = slug;
          }
        }

        if (input.status !== undefined) {
          data.status = input.status;
          // Stamped once, on the first publish, and preserved from then on.
          data.publishedAt = resolvePublishedAt(input.status, existing.publishedAt);
        }

        await updateBlogPost(input.id, data);
        if (input.categoryIds) await setBlogPostCategories(input.id, input.categoryIds);
        return { id: input.id };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteBlogPost(input.id)),

    /**
     * One endpoint for both the cover and the images dropped into an article.
     *
     * Returns the stored URL rather than attaching it to a post, so the same
     * call works before a post exists — the admin uploads while composing and
     * the URL rides along with the save.
     */
    uploadImage: adminProcedure
      .input(
        z.object({
          kind: z.enum(["cover", "body"]),
          fileBase64: z.string(),
          fileName: z.string(),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        if (!input.mimeType.startsWith("image/")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only image files are accepted" });
        }

        // Covers are displayed wider than body images, hence the two ceilings.
        const maxWidth = input.kind === "cover" ? 1600 : 1200;
        const { buffer, mimeType } = await compressImage(
          Buffer.from(input.fileBase64, "base64"),
          input.mimeType,
          maxWidth
        );
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const folder = input.kind === "cover" ? "covers" : "body";
        const { key, url } = await storagePut(`blog/${folder}/${nanoid(10)}_${safeName}`, buffer, mimeType);
        return { key, url };
      }),

    // ── Admin: categories ──
    createCategory: adminProcedure
      .input(blogCategoryInput)
      .mutation(async ({ input }) => {
        const slug = normalizeBlogSlug(input.slug, input.name);
        if (await blogCategorySlugExists(slug)) {
          throw new TRPCError({ code: "CONFLICT", message: `The slug "${slug}" is already in use` });
        }
        const id = await createBlogCategory({
          name: input.name,
          slug,
          description: input.description?.trim() || null,
        });
        return { id, slug };
      }),

    updateCategory: adminProcedure
      .input(blogCategoryInput.partial().extend({ id: z.number() }))
      .mutation(async ({ input }) => {
        const data: Partial<InsertBlogCategory> = {};
        if (input.name !== undefined) data.name = input.name;
        if (input.description !== undefined) data.description = input.description.trim() || null;

        // Only when the slug is edited directly. Renaming a category must not
        // silently move /blog?category=… out from under links already shared.
        if (input.slug !== undefined) {
          const slug = normalizeBlogSlug(input.slug, input.name ?? "");
          if (await blogCategorySlugExists(slug, input.id)) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `The slug "${slug}" is already in use`,
            });
          }
          data.slug = slug;
        }

        await updateBlogCategory(input.id, data);
        return { id: input.id };
      }),

    /**
     * Removes the category and unassigns it everywhere. Articles are never
     * touched — a category is a label, not a dependency — and the admin UI
     * shows how many lose the tag before confirming.
     */
    deleteCategory: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteBlogCategory(input.id)),
  }),

  admin: router({
    stats: adminProcedure.query(async () => {
      const [totalUsers, totalOrders, totalProducts, revenue] = await Promise.all([
        countUsers(),
        countOrders(),
        countProducts(),
        sumOrderRevenue(),
      ]);
      return { totalUsers, totalOrders, totalProducts, revenue };
    }),

    users: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional())
      .query(({ input }) => getAllUsers(input?.limit, input?.offset)),

    /**
     * Edits a user's contact details. Name, email and phone — nothing else.
     *
     * Notably not the password: an admin who can set one can impersonate the
     * account, and a forgotten password belongs in a reset flow the owner
     * drives. The role is not here either, for the same reason it has never
     * had an endpoint.
     *
     * The email is the account's login credential (see auth.login, which looks
     * users up by it), so a collision would leave two rows answering the same
     * sign-in. The check below rejects that.
     */
    updateUser: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
          email: z.string().trim().email("Enter a valid email address").max(320),
          // Optional, and an empty string means "clear it" rather than "".
          phone: z.string().trim().max(30).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const target = await getUserById(input.id);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

        // Stored lowercased so that two accounts cannot differ by case alone —
        // getUserByEmail matches exactly, and "A@x.com" would otherwise sign in
        // alongside "a@x.com".
        const email = input.email.toLowerCase();

        const clash = await findUserByEmailExcluding(email, input.id);
        if (clash) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That email is already used by another account.",
          });
        }

        await updateUserProfile(input.id, {
          name: input.name,
          email,
          phone: input.phone && input.phone.length > 0 ? input.phone : null,
        });

        return { success: true as const, emailChanged: email !== target.email?.toLowerCase() };
      }),
  }),

  // ─── Site Images (admin-managed static content) ───────────────────────────
  siteImages: router({
    list: publicProcedure.query(() => getAllSiteImages()),

    getBySlot: publicProcedure
      .input(z.object({ slotKey: z.string() }))
      .query(({ input }) => getSiteImageBySlot(input.slotKey)),

    upload: adminProcedure
      .input(
        z.object({
          slotKey: z.string().min(1).max(100),
          label: z.string().min(1).max(200),
          fileBase64: z.string(),
          fileName: z.string(),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { buffer, mimeType } = await compressImage(Buffer.from(input.fileBase64, "base64"), input.mimeType, 1600);
        const relKey = `site-images/${input.slotKey}/${nanoid(10)}_${input.fileName}`;
        const { key: fileKey, url } = await storagePut(relKey, buffer, mimeType);
        return upsertSiteImage({ slotKey: input.slotKey, url, fileKey, label: input.label });
      }),
  }),

  // ─── Hero Slides Config (per-slide active/animation toggles) ──────────────
  heroSlidesConfig: router({
    list: publicProcedure.query(() => getAllHeroSlidesConfig()),

    update: adminProcedure
      .input(
        z.object({
          slotKey: z.string().min(1).max(100),
          active: z.boolean().optional(),
          animationEnabled: z.boolean().optional(),
        })
      )
      .mutation(({ input: { slotKey, ...data } }) => upsertHeroSlideConfig(slotKey, data)),
  }),

  // ─── Analytics (admin dashboard) ──────────────────────────────────────────
  // Split into three procedures rather than one payload so the granularity
  // toggle refetches only the sales series, and a slow product query cannot
  // hold up the headline figures.
  analytics: router({
    summary: adminProcedure
      .input(z.object({ range: z.enum(ANALYTICS_RANGE_KEYS).default(DEFAULT_RANGE) }))
      .query(async ({ input }) => {
        const since = rangeStart(input.range);

        const [revenue, statuses, customers, abandoned, recentAbandoned] = await Promise.all([
          getRevenueSummary(since),
          getOrdersByStatus(since),
          getCustomerMix(),
          getAbandonedCheckouts(since, ABANDONED_GRACE_HOURS),
          getRecentAbandonedCheckouts(ABANDONED_GRACE_HOURS, 5),
        ]);

        return {
          since,
          revenue,
          statuses: fillStatusCounts(statuses),
          customers,
          abandoned,
          recentAbandoned,
          conversionRate: conversionRate(revenue.orders, abandoned.count),
          graceHours: ABANDONED_GRACE_HOURS,
        };
      }),

    salesOverTime: adminProcedure
      .input(
        z.object({
          range: z.enum(ANALYTICS_RANGE_KEYS).default(DEFAULT_RANGE),
          granularity: z.enum(["day", "week", "month"]).optional(),
        })
      )
      .query(async ({ input }) => {
        const granularity = input.granularity ?? ANALYTICS_RANGES[input.range].granularity;
        const since = rangeStart(input.range);
        const points = await getSalesOverTime(since, granularity);

        return {
          granularity,
          // Zero-filled here rather than in the browser so every consumer of
          // this procedure sees the same complete series.
          points: fillSalesGaps(points, since, new Date(), granularity),
        };
      }),

    products: adminProcedure
      .input(
        z.object({
          range: z.enum(ANALYTICS_RANGE_KEYS).default(DEFAULT_RANGE),
          limit: z.number().int().min(1).max(50).default(8),
        })
      )
      .query(async ({ input }) => {
        const since = rangeStart(input.range);
        const [top, slowest] = await Promise.all([
          getTopProducts(since, input.limit),
          getSlowestProducts(since, input.limit),
        ]);
        return { top, slowest };
      }),

    /**
     * Web traffic, read from the aggregate tables the store fills itself.
     *
     * No granularity override: the sales toggle exists because a shop owner
     * genuinely reads revenue by week and by month, whereas traffic is read
     * against the window it was measured in. The range picker already decides
     * that.
     */
    traffic: adminProcedure
      .input(
        z.object({
          range: z.enum(ANALYTICS_RANGE_KEYS).default(DEFAULT_RANGE),
          limit: z.number().int().min(1).max(50).default(8),
        })
      )
      .query(async ({ input }) => {
        const since = rangeStart(input.range);
        const granularity = ANALYTICS_RANGES[input.range].granularity;

        const [summary, points, pages, sources] = await Promise.all([
          getTrafficSummary(since),
          getTrafficOverTime(since, granularity),
          getTopPages(since, input.limit),
          getTopSources(since, input.limit),
        ]);

        return {
          since,
          granularity,
          summary,
          points: fillTrafficGaps(points, since, new Date(), granularity),
          pages,
          sources,
        };
      }),
  }),

  // ─── Traffic collection (public) ──────────────────────────────────────────
  // Deliberately its own router rather than another procedure under
  // `analytics`, which is admin-only throughout: this one is called by every
  // visitor on every page, and a public write sitting among admin reads is an
  // invitation to assume a guard that is not there.
  traffic: router({
    /**
     * Counts one page view.
     *
     * Returns nothing and awaits nothing — the hit goes into an in-memory
     * buffer that is written out once a minute. A visitor's page must never
     * wait on the store's own bookkeeping, and a failure here must never
     * surface to them.
     *
     * The address and user agent are read from the request rather than trusted
     * from the body, and neither is stored: see `server/traffic.ts`.
     */
    record: publicProcedure
      .input(
        z.object({
          path: z.string().max(2048),
          referrer: z.string().max(2048).optional(),
          utmSource: z.string().max(128).optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        recordPageView({
          ip: clientIp(ctx.req),
          userAgent: String(ctx.req.headers["user-agent"] ?? ""),
          path: input.path,
          referrer: input.referrer,
          utmSource: input.utmSource,
        });
        return { ok: true };
      }),
  }),

  // ─── Shipping settings ────────────────────────────────────────────────────
  // One JSON row in site_settings rather than a table: ten values that are
  // always read and written together and never queried by field. Validated on
  // the way in and on the way out, so a hand-edited or older-shaped row cannot
  // reach the carrier code.
  shipping: router({
    /**
     * Live carrier rates for a cart going to one address.
     *
     * Public, because the shopper quoting it has not signed in. It reads the
     * catalogue and the shop's own settings and returns prices — it writes
     * nothing and exposes nothing about an order.
     *
     * Never throws on a carrier problem. A failed quote comes back as a reason
     * the checkout can explain and carry on from; letting UPS decide whether
     * this page renders would put the shop's revenue behind their uptime.
     */
    getRates: publicProcedure
      .input(
        z.object({
          items: z.array(
            z.object({
              productId: z.number(),
              variationId: z.number().optional(),
              quantity: z.number().int().min(1).max(999),
            })
          ),
          destination: z.object({
            name: z.string().max(100).default(""),
            street: z.string().min(1).max(200),
            city: z.string().min(1).max(100),
            state: z.string().min(1).max(100),
            zip: z.string().min(1).max(20),
          }),
        })
      )
      .query(async ({ input }) => {
        if (input.items.length === 0) {
          return { ok: false as const, kind: "no_rates" as const, message: "Your cart is empty." };
        }

        const settings = parseShippingSettings(
          (await getSiteSetting(SHIPPING_SETTINGS_KEY))?.value
        );
        if (!isReadyToQuote(settings)) {
          // Our own configuration is incomplete. Logged as a shop problem, and
          // reported to the shopper as an outage rather than an explanation.
          console.error("[shipping] not ready to quote:", shippingReadiness(settings));
          return {
            ok: false as const,
            kind: "not_ready" as const,
            message: "Shipping rates are unavailable right now. Please contact us to order.",
          };
        }

        // Weights come from the catalogue, never from the browser: a client that
        // could set its own weight could set its own shipping price.
        const lines = [];
        for (const item of input.items) {
          const product = await getProductById(item.productId);
          if (!product) continue;
          const variation = item.variationId
            ? await getVariationById(item.variationId)
            : undefined;
          lines.push({
            productName: product.name,
            quantity: item.quantity,
            product: { weightOz: product.weightOz },
            variation: variation ? { weightOz: variation.weightOz } : null,
          });
        }

        const shipment = computePackage(lines, settings);
        const result = await getShippingRates(settings, shipment, input.destination);

        if (!result.ok) {
          if (result.detail) console.error(`[shipping] ${result.kind}: ${result.detail}`);
          return { ok: false as const, kind: result.kind, message: result.message };
        }

        return {
          ok: true as const,
          // Opaque handle. The client returns this with a service code, and the
          // price is read from the server's own memory of what it quoted.
          quoteId: storeQuote(result.rates, cartFingerprint(input.items, input.destination.zip)),
          rates: result.rates,
          // Shown in the admin, and useful when a quote looks wrong.
          package: {
            units: shipment.units,
            totalOz: shipment.totalOz,
            boxName: shipment.box?.name ?? null,
            oversize: shipment.oversize,
          },
        };
      }),

    /**
     * Buys a label for an order and files it.
     *
     * Admin only, and deliberately not idempotent-by-accident: it refuses when a
     * label already exists rather than quietly buying a second one, because the
     * second one is a second parcel UPS will invoice for.
     *
     * The order's status is left alone. A printed label is not a dispatched
     * parcel — that is what markShipped is for.
     */
    createLabel: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        const order = await getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        if (order.trackingNumber) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `This order already has label ${order.trackingNumber}.`,
          });
        }

        const settings = parseShippingSettings(
          (await getSiteSetting(SHIPPING_SETTINGS_KEY))?.value
        );
        if (!isReadyToQuote(settings)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Shipping settings are incomplete. Check the shipping configuration.",
          });
        }

        // Re-weighed from the order's own lines rather than trusting anything
        // stored at checkout: this is what actually goes in the box today.
        const orderLines = await getOrderItems(input.orderId);
        const lines = [];
        for (const line of orderLines) {
          const product = await getProductById(line.productId);
          const variation = line.variationId ? await getVariationById(line.variationId) : undefined;
          lines.push({
            productName: line.productName,
            quantity: line.quantity,
            product: { weightOz: product?.weightOz ?? null },
            variation: variation ? { weightOz: variation.weightOz } : null,
          });
        }
        const shipment = computePackage(lines, settings);
        if (!shipment.box) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "No shipping box is configured.",
          });
        }

        // The service the shopper paid for. Falls back to the cheapest offered
        // service for orders placed before shipping was collected.
        const serviceCode = order.shippingService ?? enabledServices(settings)[0];
        if (!serviceCode) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No service is enabled." });
        }

        const result = await createShippingLabel(settings.origin, {
          serviceCode,
          weightOz: shipment.totalOz,
          box: shipment.box,
          recipient: {
            name: `${order.shippingFirstName ?? ""} ${order.shippingLastName ?? ""}`.trim(),
            street: order.shippingAddress ?? "",
            city: order.shippingCity ?? "",
            state: order.shippingState ?? "",
            zip: order.shippingZip ?? "",
            phone: order.shippingPhone,
          },
        });

        if (!result.ok) {
          if (result.detail) console.error(`[label] ${result.kind}: ${result.detail}`);
          throw new TRPCError({ code: "BAD_GATEWAY", message: result.message });
        }

        await saveShippingLabel({
          orderId: input.orderId,
          trackingNumber: result.label.trackingNumber,
          serviceCode,
          format: result.label.format,
          data: result.label.data,
        });

        return {
          trackingNumber: result.label.trackingNumber,
          sandbox: isUpsSandbox(),
          oversize: shipment.oversize,
        };
      }),

    /** Label metadata, without the image. */
    getLabel: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(({ input }) => getShippingLabelSummary(input.orderId)),

    /**
     * The label image, base64.
     *
     * Behind adminProcedure rather than at a public URL: a label carries the
     * buyer's full name and home address, and object storage here serves
     * permanently cached public links.
     */
    getLabelImage: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(({ input }) => getShippingLabelImage(input.orderId)),

    markShipped: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        await markOrderShipped(input.orderId);
        return { success: true };
      }),

    getSettings: adminProcedure.query(async () => {
      const row = await getSiteSetting(SHIPPING_SETTINGS_KEY);
      const settings = parseShippingSettings(row?.value);
      return {
        settings,
        // Surfaced so the settings page can say what is still missing rather
        // than leaving the admin to discover it at the first failed quote.
        readiness: shippingReadiness(settings),
        readyToQuote: isReadyToQuote(settings),
      };
    }),

    updateSettings: adminProcedure
      .input(shippingSettingsSchema)
      .mutation(async ({ input }) => {
        await setSiteSetting(SHIPPING_SETTINGS_KEY, JSON.stringify(input));
        return {
          settings: input,
          readiness: shippingReadiness(input),
          readyToQuote: isReadyToQuote(input),
        };
      }),
  }),

  // ─── Site Settings (admin-editable text values) ───────────────────────────
  siteSettings: router({
    get: publicProcedure
      .input(z.object({ key: z.string() }))
      .query(({ input }) => getSiteSetting(input.key)),

    set: adminProcedure
      .input(z.object({ key: z.string().min(1).max(100), value: z.string() }))
      .mutation(({ input }) => setSiteSetting(input.key, input.value)),
  }),

  // ─── Bulk (volume) discount tiers — same 2+/5+ thresholds for every
  // product; only the percentages are admin-editable, stored as 2 rows in
  // site_settings rather than a dedicated table ────────────────────────────
  bulkDiscount: router({
    // Same reader the server prices orders with, so the percentages shown on
    // the product page are literally the ones applied at checkout.
    get: publicProcedure.query(() => getBulkDiscountTiers()),

    update: adminProcedure
      .input(
        z.object({
          tier2Percent: z.number().min(0).max(100),
          tier5Percent: z.number().min(0).max(100),
        })
      )
      .mutation(async ({ input }) => {
        await Promise.all([
          setSiteSetting("bulk_discount_tier_2", String(input.tier2Percent)),
          setSiteSetting("bulk_discount_tier_5", String(input.tier5Percent)),
        ]);
        return { success: true };
      }),
  }),

  // ─── Doc Integrity Section (singleton Home content block) ─────────────────
  docIntegrity: router({
    get: publicProcedure.query(() => getDocIntegritySection()),

    update: adminProcedure
      .input(
        z.object({
          eyebrowText: z.string().max(100).optional(),
          headingLine1: z.string().max(150).optional(),
          headingLine2: z.string().max(150).optional(),
          bodyText: z.string().optional(),
          cardBadge: z.string().max(50).optional(),
          cardSubtext: z.string().max(100).optional(),
          cardTitle: z.string().max(150).optional(),
          cardDetail: z.string().max(300).optional(),
          callout1Position: z.enum(["top", "middle", "bottom"]).optional(),
          callout1Title: z.string().max(100).optional(),
          callout1Description: z.string().max(300).optional(),
          callout2Position: z.enum(["top", "middle", "bottom"]).optional(),
          callout2Title: z.string().max(100).optional(),
          callout2Description: z.string().max(300).optional(),
          callout3Position: z.enum(["top", "middle", "bottom"]).optional(),
          callout3Title: z.string().max(100).optional(),
          callout3Description: z.string().max(300).optional(),
        })
      )
      .mutation(({ input }) => updateDocIntegritySection(input)),

    uploadImage: adminProcedure
      .input(
        z.object({
          fileBase64: z.string(),
          fileName: z.string(),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { buffer, mimeType } = await compressImage(Buffer.from(input.fileBase64, "base64"), input.mimeType, 1600);
        const relKey = `doc-integrity/${nanoid(10)}_${input.fileName}`;
        const { key: heroImageKey, url: heroImageUrl } = await storagePut(relKey, buffer, mimeType);
        return updateDocIntegritySection({ heroImageUrl, heroImageKey });
      }),
  }),

  // ─── Wholesale Applications ─────────────────────────────────────────────────
  wholesaleApplications: router({
    create: publicProcedure
      .input(
        z.object({
          fullName: z.string().min(1).max(150),
          workEmail: z.string().email().max(255),
          phone: z.string().min(1).max(50),
          roleTitle: z.string().min(1).max(150),
          expectedMonthlyVolume: z.enum(["25k_50k", "50k_100k", "100k_500k", "over_1m"]),
          taxExempt: z.boolean().optional(),
          shippingStreet: z.string().min(1).max(255),
          shippingCity: z.string().min(1).max(150),
          shippingState: z.string().min(1).max(100),
          shippingZip: z.string().min(1).max(20),
          notes: z.string().max(2000).optional(),
          wantsUpdates: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const application = await createWholesaleApplication({
          fullName: input.fullName,
          workEmail: input.workEmail,
          phone: input.phone,
          roleTitle: input.roleTitle,
          expectedMonthlyVolume: input.expectedMonthlyVolume,
          taxExempt: input.taxExempt ?? false,
          shippingStreet: input.shippingStreet,
          shippingCity: input.shippingCity,
          shippingState: input.shippingState,
          shippingZip: input.shippingZip,
          notes: input.notes || null,
          wantsUpdates: input.wantsUpdates ?? false,
        });

        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
        const volumeLabel = WHOLESALE_VOLUME_LABELS[input.expectedMonthlyVolume];

        await Promise.all([
          sendEmail({
            to: input.workEmail,
            subject: "We've received your wholesale application — Brighter Days Labs",
            html: `
              <p>Hi ${escapeHtml(input.fullName)},</p>
              <p>Thanks for applying for wholesale access at Brighter Days Labs. Our team is reviewing your application and will follow up at this address within 1-2 business days.</p>
              <p><strong>Company:</strong> ${escapeHtml(input.roleTitle)}<br/>
              <strong>Expected monthly volume:</strong> ${escapeHtml(volumeLabel)}</p>
              <p>— Brighter Days Labs</p>
            `,
          }),
          adminEmail
            ? sendEmail({
                to: adminEmail,
                subject: `New wholesale application: ${input.roleTitle}`,
                html: `
                  <p>New wholesale application received.</p>
                  <ul>
                    <li><strong>Name:</strong> ${escapeHtml(input.fullName)}</li>
                    <li><strong>Email:</strong> ${escapeHtml(input.workEmail)}</li>
                    <li><strong>Phone Number:</strong> ${escapeHtml(input.phone)}</li>
                    <li><strong>Company Name:</strong> ${escapeHtml(input.roleTitle)}</li>
                    <li><strong>Expected monthly volume:</strong> ${escapeHtml(volumeLabel)}</li>
                    <li><strong>Tax exempt:</strong> ${input.taxExempt ? "Yes" : "No"}</li>
                    <li><strong>Shipping:</strong> ${escapeHtml(input.shippingStreet)}, ${escapeHtml(input.shippingCity)}, ${escapeHtml(input.shippingState)} ${escapeHtml(input.shippingZip)}</li>
                    <li><strong>Notes:</strong> ${input.notes ? escapeHtml(input.notes) : "—"}</li>
                    <li><strong>Wants updates:</strong> ${input.wantsUpdates ? "Yes" : "No"}</li>
                  </ul>
                `,
              })
            : Promise.resolve(false),
        ]);

        return application;
      }),

    adminList: adminProcedure
      .input(
        z
          .object({ status: z.enum(["pending", "approved", "rejected", "contacted"]).optional() })
          .optional()
      )
      .query(({ input }) => getWholesaleApplications(input?.status)),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "approved", "rejected", "contacted"]),
        })
      )
      .mutation(({ input }) => updateWholesaleApplicationStatus(input.id, input.status)),
  }),
});

export type AppRouter = typeof appRouter;
