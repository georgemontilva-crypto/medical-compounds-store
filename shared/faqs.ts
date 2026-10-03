/**
 * The FAQ content.
 *
 * Lives here rather than in the page because the server emits FAQPage
 * structured data from the same list — that markup is what lets a search
 * result show the questions themselves, and it has to match the page exactly
 * or it misrepresents the page to Google. One list, read by both.
 */
export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQS: FaqEntry[] = [
  {
    question: "How do I place an order?",
    answer:
      "Browse our catalog, select the variation and quantity you need on a product page, then add it to your cart or use Buy Now to go straight to checkout. You'll need a Brighter Days Labs account to complete checkout — you can create one in a few seconds with just your email and password.",
  },
  {
    question: "How long does shipping take?",
    answer:
      "Orders are typically processed and handed to the carrier within 1-2 business days. From there, standard domestic delivery takes an additional 2-5 business days depending on your location and the carrier used. You'll get a tracking number by email as soon as your order ships. Full details are in our Shipping Policy.",
  },
  {
    question: "Do you provide Certificates of Analysis (COAs)?",
    answer:
      "Yes. Every batch we sell ships with a batch-specific Certificate of Analysis. You can find COAs for a specific product from its product page, or browse our full COA library on the Lab Tests page.",
  },
  {
    question: 'What purity levels do your peptides meet?',
    answer:
      "Our peptides meet or exceed 99% purity by HPLC. Purity is not a meaningful measure for every product we carry — bacteriostatic water, for example, is characterised by benzyl alcohol content, fill volume, pH and sterility rather than a purity percentage. The analyses actually performed on a given batch, and their results, are published on that batch's Certificate of Analysis.",
  },
  {
    question: 'What does "Research Use Only" (RUO) mean?',
    answer:
      "Research Use Only means a product is intended exclusively for laboratory research, analytical testing, and scientific use by qualified purchasers — not for human consumption, animal use, clinical use, diagnostic use, or any other application outside a controlled research setting. See our Research Use Only Policy & Website Disclaimer for the complete terms that apply to every purchase.",
  },
  {
    question: "How should I store my peptides?",
    answer:
      "As a general laboratory handling matter, lyophilized peptides should be stored frozen (around -20°C), kept away from light and moisture, and used within your institution's own protocols for freeze-thaw stability. We don't provide reconstitution, dilution, or administration guidance — those decisions are the responsibility of your own qualified research personnel.",
  },
  {
    question: "Do you offer bulk or custom synthesis orders?",
    answer:
      "Yes. For volume pricing, multi-pack sizing, or custom synthesis requests, submit a Wholesale Application and our team will follow up within 1-2 business days to discuss your requirements.",
  },
  {
    question: "Do you ship internationally?",
    answer:
      "At this time we ship only within the United States and do not offer international shipping. If that changes, we'll update our Shipping Policy accordingly.",
  },
  {
    question: "What is your return and refund policy?",
    answer:
      "Because our products are laboratory research materials, we're generally unable to accept returns of opened or used items. If your order arrives damaged, incorrect, or was lost in transit, contact support within 7 days of delivery and we'll work with you on a resolution, which may include a replacement or refund at our discretion.",
  },
  {
    question: "How can I contact support?",
    answer:
      "Reach us through the Contact page or by emailing support@brighterdayslabs.com. We respond to all inquiries within one business day.",
  },
];
