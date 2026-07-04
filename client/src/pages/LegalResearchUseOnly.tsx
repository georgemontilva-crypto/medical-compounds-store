import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    heading: "General Research Use Only Disclaimer",
    body: "All products sold by Brighter Days Labs are intended exclusively for lawful laboratory research, analytical testing, and scientific use by qualified purchasers operating in appropriate research settings. No product offered on this website is intended, labeled, or authorized for human consumption, animal use, veterinary application, clinical use, therapeutic use, diagnostic use, household use, cosmetic use, performance enhancement, personal use, or any medical application of any kind. By accessing this website or purchasing any product, the purchaser acknowledges and agrees that these Research Use Only (\"RUO\") restrictions apply to every product, regardless of how the product is described, discussed, or referenced elsewhere.",
  },
  {
    heading: "No Human or Animal Use",
    body: "Products sold by Brighter Days Labs are not to be consumed, injected, ingested, applied, or otherwise introduced into or onto the human body or the body of any animal, under any circumstances. This prohibition includes, without limitation, self-administration, administration to any third party, administration by any individual purporting to act in a clinical, veterinary, or caregiving capacity, and any use outside of a controlled laboratory or research environment. No representation made on this website, in product listings, in Certificates of Analysis, or in any communication from Brighter Days Labs should be interpreted as authorizing or encouraging human or animal use of any product.",
  },
  {
    heading: "No Medical Advice, No Regulatory Advice, and No Use Instructions",
    body: "All content on this website — including product descriptions, labels, Certificates of Analysis, images, specifications, and any written or verbal communication from Brighter Days Labs personnel — is provided solely for general informational, cataloging, procurement, analytical, and research-reference purposes. Brighter Days Labs does not provide dosage guidance, administration instructions, reconstitution or dilution instructions, medical advice, veterinary advice, legal advice, regulatory advice, clinical guidance, or treatment recommendations of any kind. Purchasers must not rely on any website content as a substitute for independent professional, scientific, legal, or regulatory judgment appropriate to their own research context.",
  },
  {
    heading: "Purchaser Eligibility and Representations",
    body: "By placing an order, the purchaser represents and warrants that they are at least 21 years of age, are professionally or academically qualified to handle laboratory-grade research materials, maintain facilities and safety protocols appropriate to the handling of such materials, and are purchasing solely for lawful research, laboratory, or analytical purposes. Brighter Days Labs relies on these representations in good faith and does not independently verify the purchaser's laboratory affiliation, credentials, or intended use beyond the account, age, and order review procedures described in this policy.",
  },
  {
    heading: "Account Review, Gated Access, and Order Review",
    body: "Brighter Days Labs reserves the right, at its sole discretion, to restrict access to product pages, pricing, checkout, and order-related functionality pending account verification, age verification, purchaser certification, one-time-passcode (OTP) confirmation, or any other review procedure it deems appropriate. Brighter Days Labs may decline to process, may delay, or may cancel any order, account registration, or account access at any time, for any reason or no reason, including where information provided by a purchaser appears incomplete, inconsistent, or inconsistent with the research-use representations described in this policy.",
  },
  {
    heading: "Prohibited Purchases and Prohibited Uses",
    body: "Purchases and uses of any product for the following purposes are strictly prohibited: human or animal consumption; diagnostic, therapeutic, clinical, or wellness use; bodybuilding, anti-aging, weight-loss, or performance-enhancement use; incorporation into any food, drug, cosmetic, dietary supplement, medical device, finished dosage form, or compounded medication; and resale, redistribution, or relisting of any product on any marketplace, storefront, or platform without the express prior written consent of Brighter Days Labs. Any order that Brighter Days Labs believes, in its reasonable judgment, is intended for a prohibited purpose may be refused, canceled, or refunded at its discretion.",
  },
  {
    heading: "FDA and Regulatory Disclaimer",
    body: "Except where specifically and expressly stated otherwise, no statement appearing on this website, in any product description, product label, marketing material, or other communication from Brighter Days Labs has been evaluated by the U.S. Food and Drug Administration or any other federal, state, or international regulatory authority. No product sold by Brighter Days Labs is approved, cleared, or authorized by the FDA or any comparable regulatory body for human use, animal use, clinical use, therapeutic use, diagnostic use, or any medical application, and no such approval should be inferred from the availability, description, or sale of any product on this website.",
  },
  {
    heading: "Certificates of Analysis and Quality Documentation",
    body: "Certificates of Analysis (COAs), product specifications, batch and lot numbers, chromatograms, purity data, and other quality documentation made available by Brighter Days Labs are provided solely for research, analytical, procurement, and transparency purposes. This documentation describes the composition and purity of a given batch as tested and is not a representation, warranty, or guarantee regarding the safety, efficacy, suitability, or appropriateness of any product for any particular research application, nor is it an endorsement of any use outside of lawful laboratory research.",
  },
  {
    heading: "Handling, Storage, Reconstitution, Dilution, and Disposal",
    body: "The purchaser assumes full and sole responsibility for the receipt, transport, storage, handling, preparation, reconstitution, dilution, use, misuse, transfer, and disposal of all products purchased from Brighter Days Labs. Purchasers are responsible for ensuring that their facilities, equipment, personnel training, and disposal practices comply with all applicable laws, regulations, institutional policies, and safety standards governing laboratory-grade research materials in their jurisdiction.",
  },
  {
    heading: "Assumption of Risk",
    body: "Research compounds and laboratory materials carry inherent risks, including but not limited to contamination, degradation, improper handling, accidental exposure, misuse, regulatory restrictions that may vary by jurisdiction, damage to property, and personal injury. By purchasing any product from Brighter Days Labs, the purchaser knowingly and voluntarily assumes all such risks and acknowledges that Brighter Days Labs makes no representation that any product is free from these or other risks.",
  },
  {
    heading: "Indemnification",
    body: "The purchaser agrees to indemnify, defend, and hold harmless Brighter Days Labs, its officers, employees, contractors, and affiliated parties from and against any and all claims, damages, losses, penalties, costs, expenses, and reasonable attorneys' fees arising out of or related to the purchaser's use of this website, purchase of any product, handling, misuse, resale, transfer, or unauthorized use of any product, or any violation of applicable law, regulation, institutional policy, or this policy by the purchaser.",
  },
  {
    heading: "Limitation of Liability",
    body: "To the fullest extent permitted by applicable law, Brighter Days Labs shall not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages arising from or related to this website, product information, account access, order processing, shipping, delivery, storage, handling, use, misuse, or disposal of any product, even if Brighter Days Labs has been advised of the possibility of such damages. In no event shall the aggregate liability of Brighter Days Labs arising out of or related to any order exceed the amount actually paid by the purchaser for the product giving rise to the claim.",
  },
  {
    heading: "No Warranties",
    body: "All website content, product information, products, materials, and documentation provided by Brighter Days Labs are provided \"AS IS,\" \"AS AVAILABLE,\" and \"WITH ALL FAULTS,\" without warranties of any kind, whether express, implied, or statutory, including without limitation any implied warranties of merchantability, fitness for a particular purpose, non-infringement, or accuracy, except as otherwise expressly stated in writing by Brighter Days Labs.",
  },
  {
    heading: "Research Outcomes Disclaimer",
    body: "Brighter Days Labs makes no guarantee, representation, or warranty regarding any research outcome, experimental result, application, protocol, reproducibility, performance, or suitability of any product for any particular research purpose. Purchasers are solely responsible for designing, validating, and interpreting their own research protocols and results.",
  },
  {
    heading: "Shipping, Delivery, and Risk of Loss",
    body: "Purchasers are responsible for providing complete and accurate shipping information at the time of order. Brighter Days Labs may, at its discretion, limit shipping to jurisdictions or addresses it determines to be eligible under this policy and applicable law. Except where otherwise required by law, risk of loss and title to products pass to the purchaser upon delivery to the shipping carrier or to the address provided by the purchaser, whichever applies under the shipping method selected. Additional detail on shipping practices is available in our Shipping Policy.",
  },
  {
    heading: "Intellectual Property",
    body: "All text, logos, graphics, product descriptions, labels, images, page layouts, data compilations, and other materials appearing on this website are the property of Brighter Days Labs or its licensors and are protected by applicable intellectual property laws. No content from this website may be copied, reproduced, republished, distributed, or used to create derivative works without the prior written consent of Brighter Days Labs.",
  },
  {
    heading: "Website Content and Updates",
    body: "Brighter Days Labs may update, modify, suspend, or remove website content, product listings, pricing, specifications, disclaimers, terms, or policies at any time and without prior notice. Continued use of this website following any such change constitutes acceptance of the content and policies then in effect.",
  },
];

export default function LegalResearchUseOnly() {
  return (
    <LegalPageLayout
      title="Research Use Only Policy & Website Disclaimer"
      lastUpdated="July 4, 2026"
      intro="This policy governs the purchase and use of all products sold by Brighter Days Labs and applies to every visitor, account holder, and purchaser on this website. Please read it carefully before browsing our catalog or placing an order."
      sections={SECTIONS}
      closingNote="Shorter versions of this policy appear throughout the website, including the footer disclaimer, product page disclaimer, checkout certification, and age/account gate acknowledgment."
    />
  );
}
