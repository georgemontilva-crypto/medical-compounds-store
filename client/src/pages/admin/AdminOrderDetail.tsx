import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  Download,
  FlaskConical,
  Loader2,
  Package,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const STATUS_OPTIONS = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;
const PAYMENT_OPTIONS = ["pending", "paid", "failed", "refunded"] as const;

type OrderStatus = typeof STATUS_OPTIONS[number];
type PaymentStatus = typeof PAYMENT_OPTIONS[number];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-[#f2ede6] text-[#d3c4ab]",
  shipped: "bg-[#d0f0ed] text-[#baac96]",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

interface Props { params: { id: string } }

export default function AdminOrderDetail({ params }: Props) {
  const orderId = Number(params.id);
  const utils = trpc.useUtils();

  const { data: order, isLoading } = trpc.orders.adminDetail.useQuery({ id: orderId });

  const updateStatus = trpc.orders.updateStatus.useMutation({
    onSuccess: () => { utils.orders.adminDetail.invalidate(); toast.success("Status updated"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Order not found</p>
          <Link href="/admin/orders"><button className="lab-btn-primary mt-4">Back to Orders</button></Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders">
            <button className="p-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={18} />
            </button>
          </Link>
          <div>
            <p className="lab-section-title mb-0.5">Orders</p>
            <h1 className="text-2xl font-bold">Order #{order.id}</h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Order items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="lab-card p-5">
              <h2 className="font-semibold mb-4">Items</h2>
              <div className="space-y-3">
                {order.items.map((item: { id: number; productName: string; variationLabel?: string | null; quantity: number; unitPrice: string }) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <FlaskConical size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.productName}</p>
                      {item.variationLabel && (
                        <p className="text-xs text-muted-foreground">{item.variationLabel}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold">
                      ${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border mt-4 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${Number(order.subtotal).toFixed(2)}</span>
                </div>
                {Number(order.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
                    <span>-${Number(order.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span className="text-primary">${Number(order.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Shipping */}
            <div className="lab-card p-5">
              <h2 className="font-semibold mb-4">Shipping Address</h2>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p className="text-foreground font-medium">
                  {order.shippingFirstName} {order.shippingLastName}
                </p>
                <p>{order.shippingEmail}</p>
                {order.shippingPhone && <p>{order.shippingPhone}</p>}
                <p>{order.shippingAddress}</p>
                <p>
                  {order.shippingCity}{order.shippingState && `, ${order.shippingState}`} {order.shippingZip}
                </p>
                <p>{order.shippingCountry}</p>
              </div>
              {order.notes && (
                <div className="mt-4 p-3 rounded-xl bg-secondary/50">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status management */}
          <div className="space-y-4">
            <ShippingLabelCard
              orderId={order.id}
              status={order.status}
              trackingNumber={order.trackingNumber ?? null}
              serviceName={order.shippingServiceName ?? null}
            />

            <div className="lab-card p-5">
              <h2 className="font-semibold mb-4">Order Status</h2>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => updateStatus.mutate({ id: order.id, status })}
                    disabled={updateStatus.isPending}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      order.status === status
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 hover:bg-secondary"
                    }`}
                  >
                    <span className="capitalize">{status}</span>
                    {order.status === status && (
                      <span className={`lab-badge text-xs ${STATUS_COLORS[status]}`}>Current</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="lab-card p-5">
              <h2 className="font-semibold mb-4">Payment Status</h2>
              <div className="space-y-2">
                {PAYMENT_OPTIONS.map((pStatus) => (
                  <button
                    key={pStatus}
                    onClick={() => updateStatus.mutate({ id: order.id, status: order.status as OrderStatus, paymentStatus: pStatus })}
                    disabled={updateStatus.isPending}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      order.paymentStatus === pStatus
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 hover:bg-secondary"
                    }`}
                  >
                    <span className="capitalize">{pStatus}</span>
                    {order.paymentStatus === pStatus && (
                      <span className="lab-badge text-xs bg-green-100 text-green-700">Current</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="lab-card p-5">
              <p className="text-xs text-muted-foreground">
                Created: {new Date(order.createdAt).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Updated: {new Date(order.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

/**
 * Buying and printing the carrier label for one order.
 *
 * Deliberately two separate actions. Printing a label does not put a parcel on
 * a van — labels get bought, voided, and left on desks — so telling the
 * customer their order shipped stays a thing a person decides, one click away
 * from the label rather than bundled into it.
 */
function ShippingLabelCard({
  orderId,
  status,
  trackingNumber,
  serviceName,
}: {
  orderId: number;
  status: string;
  trackingNumber: string | null;
  serviceName: string | null;
}) {
  const utils = trpc.useUtils();
  const [downloading, setDownloading] = useState(false);

  // Read off the number this order is holding, not off the current mode: a
  // label bought in sandbox stays useless after somebody switches to
  // production, and that is exactly when it needs replacing.
  const { data: labelStatus } = trpc.shipping.labelStatus.useQuery(
    { orderId },
    { enabled: Boolean(trackingNumber) }
  );

  const createLabel = trpc.shipping.createLabel.useMutation({
    onSuccess: (result) => {
      utils.orders.adminDetail.invalidate({ id: orderId });
      toast.success(
        result.sandbox
          ? `Test label created — ${result.trackingNumber}. Not valid for shipping.`
          : `Label created — ${result.trackingNumber}`
      );
      if (result.oversize) {
        toast.warning(
          "This order is larger than the biggest configured box. It was rated as one parcel — check before shipping."
        );
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const discardTestLabel = trpc.shipping.discardTestLabel.useMutation({
    onSuccess: (result) => {
      utils.orders.adminDetail.invalidate({ id: orderId });
      toast.success(`Test label ${result.discarded} discarded — this order can be labelled again.`);
    },
    onError: (e) => toast.error(e.message),
  });

  const markShipped = trpc.shipping.markShipped.useMutation({
    onSuccess: () => {
      utils.orders.adminDetail.invalidate({ id: orderId });
      toast.success("Order marked as shipped");
    },
    onError: (e) => toast.error(e.message),
  });

  // Fetched on demand rather than with the page: the image is tens of kilobytes
  // and most visits to an order never print anything.
  const downloadLabel = async () => {
    setDownloading(true);
    try {
      const label = await utils.shipping.getLabelImage.fetch({ orderId });
      if (!label?.data) {
        toast.error("No label image is stored for this order.");
        return;
      }

      // ZPL is printer instructions, not a picture — opening it in a tab shows
      // a wall of text. It has to arrive as a file the printer can be given.
      if (label.format === "ZPL") {
        const zpl = atob(label.data);
        const url = URL.createObjectURL(new Blob([zpl], { type: "application/octet-stream" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `label-${trackingNumber ?? orderId}.zpl`;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      const mime = label.format === "PDF" ? "application/pdf" : "image/gif";
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Allow pop-ups to open the label.");
        return;
      }
      win.document.write(
        `<title>Label ${trackingNumber ?? orderId}</title><img src="data:${mime};base64,${label.data}" style="max-width:100%">`
      );
      win.document.close();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="lab-card p-5">
      <div className="flex items-start gap-2 mb-4">
        <Truck size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="font-semibold">Shipping label</h2>
          {serviceName && <p className="text-xs text-muted-foreground mt-0.5">{serviceName}</p>}
        </div>
      </div>

      {trackingNumber ? (
        <div className="space-y-3">
          {labelStatus?.labelIsTest && (
            <div className="p-3 rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200">
              <p className="text-xs font-semibold mb-0.5">Test label — not valid for shipping</p>
              <p className="text-xs leading-relaxed mb-2.5">
                {labelStatus.buyingLive
                  ? "This barcode is a sample from UPS sandbox. Discard it and create the label again — the next one will be real and billed to your account."
                  : "This barcode is a sample from UPS sandbox. Set UPS_ENVIRONMENT to production for a label a carrier will accept, then discard this one and create it again."}
              </p>
              <button
                type="button"
                onClick={() => discardTestLabel.mutate({ orderId })}
                disabled={discardTestLabel.isPending}
                className="text-xs font-medium underline underline-offset-2 disabled:opacity-50"
              >
                {discardTestLabel.isPending ? "Discarding…" : "Discard test label"}
              </button>
            </div>
          )}

          <div className="p-3 rounded-xl bg-secondary/60">
            <p className="text-xs text-muted-foreground mb-0.5">Tracking number</p>
            <p className="font-mono text-sm break-all">{trackingNumber}</p>
          </div>

          <button
            type="button"
            onClick={downloadLabel}
            disabled={downloading}
            className="lab-btn-secondary w-full py-2.5 text-sm"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Open label
          </button>

          {status !== "shipped" && status !== "delivered" && (
            <button
              type="button"
              onClick={() => markShipped.mutate({ orderId })}
              disabled={markShipped.isPending}
              className="lab-btn-primary w-full py-2.5 text-sm"
            >
              {markShipped.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Package size={14} />
              )}
              Mark as shipped
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Buys a label from UPS and records the tracking number. The order status is not
            changed — mark it shipped when the parcel actually goes out.
          </p>
          <button
            type="button"
            onClick={() => createLabel.mutate({ orderId })}
            disabled={createLabel.isPending}
            className="lab-btn-primary w-full py-2.5 text-sm"
          >
            {createLabel.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <TriangleAlert size={14} />
                Generate shipping label
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
