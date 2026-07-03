import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { notifyOwner } from "./_core/notification";
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
  getAllCategories,
  getAllCoupons,
  getAllOrders,
  getAllUsers,
  getCartItems,
  getCategoryById,
  getCouponByCode,
  getCouponById,
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
  createLabReport,
  deleteLabReport,
  updateLabReport,
  getAllSiteImages,
  getSiteImageBySlot,
  upsertSiteImage,
  getSiteSetting,
  setSiteSetting,
} from "./db";
import { storagePut } from "./storage";

// ─── Admin middleware ─────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

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
    me: publicProcedure.query((opts) => opts.ctx.user),

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
        const buffer = Buffer.from(input.fileBase64, "base64");
        const relKey = `categories/${input.categoryId}/${nanoid(10)}_${input.fileName}`;
        const { key: heroImageKey, url: heroImageUrl } = await storagePut(relKey, buffer, input.mimeType);
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
        const buffer = Buffer.from(input.fileBase64, "base64");
        const relKey = input.variationId
          ? `products/${input.productId}/variations/${input.variationId}/${nanoid(10)}_${input.fileName}`
          : `products/${input.productId}/${nanoid(10)}_${input.fileName}`;
        const { key: fileKey, url } = await storagePut(relKey, buffer, input.mimeType);
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
    validate: protectedProcedure
      .input(z.object({ code: z.string(), orderAmount: z.number() }))
      .mutation(async ({ input }) => {
        const coupon = await getCouponByCode(input.code);
        if (!coupon || !coupon.active) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Coupon not found or inactive" });
        }
        if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Coupon has expired" });
        }
        if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Coupon usage limit reached" });
        }
        if (coupon.minOrderAmount && input.orderAmount < Number(coupon.minOrderAmount)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Minimum order amount is $${coupon.minOrderAmount}`,
          });
        }
        const discount =
          coupon.type === "percentage"
            ? (input.orderAmount * Number(coupon.value)) / 100
            : Number(coupon.value);
        return {
          valid: true,
          coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: Number(coupon.value) },
          discount: Math.min(discount, input.orderAmount),
        };
      }),

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
          expiresAt: z.string().optional(),
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
          expiresAt: z.string().nullable().optional(),
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
    create: protectedProcedure
      .input(
        z.object({
          items: z.array(
            z.object({
              productId: z.number(),
              variationId: z.number().optional(),
              productName: z.string(),
              variationLabel: z.string().optional(),
              quantity: z.number().min(1),
              unitPrice: z.number(),
            })
          ),
          couponCode: z.string().optional(),
          couponId: z.number().optional(),
          discountAmount: z.number().optional(),
          shipping: z.object({
            firstName: z.string(),
            lastName: z.string(),
            email: z.string().email(),
            phone: z.string().optional(),
            address: z.string(),
            city: z.string(),
            state: z.string().optional(),
            zip: z.string().optional(),
            country: z.string(),
          }),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const subtotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const discount = input.discountAmount ?? 0;
        const total = Math.max(0, subtotal - discount);

        const newOrderId = await createOrder({
          userId: ctx.user.id,
          subtotal: subtotal.toFixed(2),
          discountAmount: discount.toFixed(2),
          total: total.toFixed(2),
          couponId: input.couponId,
          couponCode: input.couponCode,
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

        for (const item of input.items) {
          await createOrderItem({
            orderId: newOrder.id,
            productId: item.productId,
            variationId: item.variationId,
            productName: item.productName,
            variationLabel: item.variationLabel,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toFixed(2),
            subtotal: (item.unitPrice * item.quantity).toFixed(2),
          });
        }

        if (input.couponId) {
          await incrementCouponUsage(input.couponId);
        }

        await clearCart(ctx.user.id);

        // Notify admin
        try {
          const itemsList = input.items
            .map((i) => `${i.productName}${i.variationLabel ? ` (${i.variationLabel})` : ""} x${i.quantity} — $${(i.unitPrice * i.quantity).toFixed(2)}`)
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
      .mutation(({ input }) => updateOrderStatus(input.id, input.status, input.paymentStatus)),
  }),

  // ─── Admin Dashboard ───────────────────────────────────────────────────────

  // ─── Lab Reports ──────────────────────────────────────────────────────────────
  labReports: router({
    byProduct: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => getLabReportsByProduct(input.productId)),

    all: adminProcedure.query(() => getAllLabReports()),

    upload: adminProcedure
      .input(
        z.object({
          productId: z.number(),
          title: z.string().min(1),
          description: z.string().optional(),
          batchNumber: z.string().optional(),
          testDate: z.string().optional(),
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
          title: z.string().optional(),
          description: z.string().optional(),
          batchNumber: z.string().optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
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
        const buffer = Buffer.from(input.fileBase64, "base64");
        const relKey = `site-images/${input.slotKey}/${nanoid(10)}_${input.fileName}`;
        const { key: fileKey, url } = await storagePut(relKey, buffer, input.mimeType);
        return upsertSiteImage({ slotKey: input.slotKey, url, fileKey, label: input.label });
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
});

export type AppRouter = typeof appRouter;
