import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    heading: "Research Use Only",
    body: "Everything sold through this website is intended exclusively for lawful laboratory research, analytical testing, and scientific use by qualified purchasers. Nothing on this site is intended for human consumption, animal use, clinical use, therapeutic use, diagnostic use, cosmetic use, performance enhancement, or personal use of any kind.",
  },
  {
    heading: "Informational Content Only",
    body: "Product descriptions, images, Certificates of Analysis, and any other content on this website are provided for general informational, cataloging, and research-reference purposes only. None of it constitutes dosage guidance, administration instructions, medical advice, veterinary advice, or regulatory advice, and it should not be relied upon as such.",
  },
  {
    heading: "No FDA Evaluation or Approval",
    body: "Unless expressly stated otherwise, statements on this website have not been evaluated by the U.S. Food and Drug Administration or any comparable regulatory authority. No product offered here is approved for human use, animal use, or any medical purpose, and no such approval should be inferred from its availability on this site.",
  },
  {
    heading: "No Warranties",
    body: "This website, its content, and all products described on it are provided \"as is\" and \"as available,\" without warranties of any kind, express or implied, including any implied warranty of merchantability, fitness for a particular purpose, or accuracy.",
  },
  {
    heading: "No Guarantee of Research Outcomes",
    body: "Brighter Days Labs makes no representation or guarantee regarding the results, reproducibility, or suitability of any product for any specific research protocol or objective. Purchasers are solely responsible for the design, validation, and interpretation of their own research.",
  },
];

export default function LegalWebsiteDisclaimer() {
  return (
    <LegalPageLayout
      title="Website Disclaimer"
      lastUpdated="July 4, 2026"
      intro="This disclaimer summarizes key limitations that apply to your use of this website. For the complete policy governing product purchase and use, see our Research Use Only Policy & Website Disclaimer."
      sections={SECTIONS}
    />
  );
}
