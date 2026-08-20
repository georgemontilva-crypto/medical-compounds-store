import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { isSupportedCountry } from "@shared/countries";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { sendEmail, escapeHtml } from "./email";
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
        })
      )
      .query(async ({ input, ctx }) => {
        const priced = await priceOrder(input.items, {
          couponCode: input.couponCode,
          referralCode: input.referralCode,
          userId: ctx.user?.id,
          buyerEmails: [input.email, ctx.user?.email],
        });

        return {
          items: priced.items,
          subtotal: priced.subtotal,
          discount: priced.discount,
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
          researcherType: z.enum([
            "private_researcher",
            "lab_company_researcher",
            "government_entity_researcher",
          ]),
          dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date of birth"),
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
        const priced = await priceOrder(input.items, {
          couponCode: input.couponCode,
          referralCode: input.referralCode,
          userId: ctx.user?.id,
          // Both addresses that identify the buyer, so a self-referral cannot
          // hide behind a different shipping email.
          buyerEmails: [input.shipping.email, ctx.user?.email],
        });
        const { subtotal, discount, total } = priced;

        const newOrderId = await createOrder({
          userId: ctx.user?.id ?? null,
          subtotal: subtotal.toFixed(2),
          discountAmount: discount.toFixed(2),
          total: total.toFixed(2),
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
        if (isSelfReferral([input.email, ctx.user?.email], owner?.email)) {
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
