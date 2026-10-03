import { Link } from "wouter";
import ReadyToStartBanner from "@/components/ReadyToStartBanner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronRight } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";
import { useTheme } from "@/contexts/ThemeContext";
import { FAQS } from "@shared/faqs";


export default function FAQ() {
  const { theme } = useTheme();
  return (
    <div className="flex-1 bg-background relative overflow-hidden">
      <ParticleBackground
        color={theme === "dark" ? "211, 196, 171" : "38, 38, 38"}
        particleRadius={3.5}
        particleOpacity={0.22}
        lineOpacity={0.14}
        linkDistance={150}
        className="absolute inset-0 w-full h-full"
      />

      <div className="relative z-10">

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
