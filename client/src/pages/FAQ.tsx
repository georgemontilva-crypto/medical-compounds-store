import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import ReadyToStartBanner from "@/components/ReadyToStartBanner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronRight } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";
import { useTheme } from "@/contexts/ThemeContext";

const FAQS: { question: string; answer: string }[] = [
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
      "Every batch we sell meets or exceeds 98% purity by HPLC, and most batches test at 99% or higher. Exact purity, along with batch and lot data, is published on the Certificate of Analysis for that specific batch.",
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
      "Reach us through the Contact page or by emailing support@biolabcompounds.com. We respond to all inquiries within one business day.",
  },
];

export default function FAQ() {
  const { theme } = useTheme();
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground
        color={theme === "dark" ? "211, 196, 171" : "38, 38, 38"}
        particleRadius={3.5}
        particleOpacity={0.22}
        lineOpacity={0.14}
        linkDistance={150}
        className="absolute inset-0 w-full h-full"
      />

      <div className="relative z-10">
        <Navbar />

        <main className="max-w-3xl mx-auto px-4 py-16">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link href="/">
              <span className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">Home</span>
            </Link>
            <ChevronRight size={14} />
            <span className="text-gray-700 dark:text-gray-300 font-medium">FAQ</span>
          </nav>

          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "#d3c4ab" }}>
            Support
          </p>
          <h1 className="text-4xl font-light text-gray-950 mb-4 dark:text-white">Frequently Asked Questions</h1>
          <p className="text-gray-600 text-base leading-relaxed mb-10 dark:text-gray-300">
            Answers to the questions we hear most often about ordering, shipping, purity, and research use.
          </p>

          <div className="bg-white rounded-2xl border border-gray-100 px-6 dark:bg-card dark:border-border">
            <Accordion type="single" collapsible>
              {FAQS.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-gray-600 leading-relaxed dark:text-gray-400">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </main>

        <ReadyToStartBanner />
      </div>
    </div>
  );
}
