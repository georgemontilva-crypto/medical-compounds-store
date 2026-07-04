import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    heading: "Acceptance of Terms",
    body: "By accessing this website or purchasing any product from Brighter Days Labs, you agree to be bound by these Terms of Service, our Research Use Only Policy & Website Disclaimer, and our Shipping Policy. If you do not agree to these terms, please do not use this website.",
  },
  {
    heading: "Acceptable Use of the Website",
    body: "You agree to use this website only for lawful purposes and in a manner consistent with its intended use for research and laboratory procurement. You may not use this website to attempt unauthorized access to any account, system, or data; to interfere with the operation of the website; to scrape, harvest, or bulk-collect content without written consent; or to place any order for a purpose prohibited under our Research Use Only Policy.",
  },
  {
    heading: "User Accounts",
    body: "Certain features of this website, including checkout and order history, require a registered account. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to provide accurate, current, and complete information during registration and to promptly update that information as necessary. Brighter Days Labs may suspend or terminate any account that it reasonably believes has provided false information, violated these terms, or is being used for a prohibited purpose.",
  },
  {
    heading: "Pricing and Payment",
    body: "All prices displayed on this website are stated in U.S. dollars and are subject to change without notice. Brighter Days Labs makes reasonable efforts to ensure pricing accuracy but reserves the right to correct any pricing error, even after an order has been submitted or confirmed, and to cancel any order affected by such an error. Payment is due in full at the time an order is placed, through the payment methods made available at checkout. You represent that any payment information you provide is accurate and that you are authorized to use the payment method submitted.",
  },
  {
    heading: "Order Cancellation Policy",
    body: "Brighter Days Labs reserves the right to cancel, refuse, or limit any order at its sole discretion, including where an order appears to be intended for a prohibited use, where account or age verification cannot be completed, where product availability changes after an order is placed, or where a pricing or listing error has occurred. You may request cancellation of an order that has not yet shipped by contacting support; orders that have already shipped are subject to our standard shipping and return handling.",
  },
  {
    heading: "Intellectual Property",
    body: "All text, logos, graphics, product descriptions, labels, images, page layouts, data compilations, and other materials appearing on this website are the property of Brighter Days Labs or its licensors and are protected by applicable intellectual property laws. No content from this website may be copied, reproduced, republished, distributed, or used to create derivative works without the prior written consent of Brighter Days Labs.",
  },
  {
    heading: "Limitation of Liability",
    body: "To the fullest extent permitted by applicable law, Brighter Days Labs shall not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages arising from or related to this website, your account, your order, or your use of any product, even if Brighter Days Labs has been advised of the possibility of such damages. In no event shall the aggregate liability of Brighter Days Labs arising out of or related to any order exceed the amount actually paid by you for the product giving rise to the claim.",
  },
  {
    heading: "Governing Law and Jurisdiction",
    body: "These Terms of Service and any dispute arising out of or related to them or to your use of this website shall be governed by the laws of the state in which Brighter Days Labs is organized, without regard to its conflict-of-laws principles. You agree that any legal action or proceeding arising under these terms shall be brought exclusively in the state or federal courts with jurisdiction over that location, and you consent to the personal jurisdiction of those courts.",
  },
  {
    heading: "Changes to These Terms",
    body: "Brighter Days Labs may revise these Terms of Service at any time by posting an updated version on this page. Changes take effect immediately upon posting, and your continued use of this website after any change constitutes your acceptance of the revised terms. We encourage you to review this page periodically.",
  },
  {
    heading: "Contact",
    body: "Questions about these Terms of Service can be directed to Brighter Days Labs through the Contact page on this website.",
  },
];

export default function LegalTermsOfService() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated="July 4, 2026"
      intro="These Terms of Service govern your access to and use of the Brighter Days Labs website and the purchase of any product through it."
      sections={SECTIONS}
    />
  );
}
