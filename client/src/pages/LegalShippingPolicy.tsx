import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    heading: "Carriers",
    body: "Brighter Days Labs ships domestic orders via major U.S. carriers, including USPS, UPS, and FedEx. The carrier and service level used for a given order is selected based on the shipping destination, package weight, and delivery speed requested at checkout.",
  },
  {
    heading: "Processing and Delivery Times",
    body: "Orders are typically processed and handed off to the carrier within 1-2 business days of payment confirmation. Once shipped, standard domestic delivery typically takes an additional 2-5 business days, depending on the destination and carrier service selected. Processing and transit times are estimates and are not guaranteed; they may be affected by order volume, carrier delays, weather, or other circumstances outside our control.",
  },
  {
    heading: "Shipping Availability by State",
    body: "At this time, Brighter Days Labs ships to all fifty U.S. states with no jurisdiction-based restrictions. We reserve the right to limit or suspend shipping to any state or region in the future if required by a change in applicable law or regulation, in which case this policy will be updated accordingly.",
  },
  {
    heading: "Shipping Costs",
    body: "Shipping costs are calculated at checkout based on the destination address, package weight, and shipping method selected, and are displayed before payment is submitted. Any promotional or free-shipping offer will be clearly indicated in the cart or at checkout when applicable.",
  },
  {
    heading: "Order Tracking",
    body: "A tracking number is provided by email once an order ships and is also available from your account under Order History. Tracking updates are provided directly by the carrier and may take up to 24 hours to reflect the initial scan after a package is dropped off.",
  },
  {
    heading: "Lost or Damaged Packages",
    body: "If a package is lost in transit or arrives visibly damaged, please contact support within 7 days of the expected or actual delivery date so that we can open a claim with the carrier and arrange a resolution. Please retain the original packaging and, where possible, photograph any damage to assist with the claim.",
  },
  {
    heading: "Incorrect Address Policy",
    body: "Purchasers are responsible for providing a complete and accurate shipping address at checkout. Brighter Days Labs is not responsible for packages that are delayed, misdelivered, or lost as a result of an incorrect or incomplete address provided by the purchaser. If an address error is caught before an order ships, contact support as soon as possible and we will make reasonable efforts to correct it; orders that have already shipped generally cannot be redirected.",
  },
];

export default function LegalShippingPolicy() {
  return (
    <LegalPageLayout
      title="Shipping Policy"
      lastUpdated="July 4, 2026"
      intro="This policy describes how Brighter Days Labs ships orders, including carriers, delivery estimates, costs, and what to do if something goes wrong in transit."
      sections={SECTIONS}
    />
  );
}
