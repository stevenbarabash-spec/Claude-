import PageHeader from "@/components/PageHeader";
import FaqAccordion from "@/components/FaqAccordion";
import { faqs } from "@/lib/data";

export const metadata = { title: "FAQs — Greenwich Dental Group" };

export default function FaqsPage() {
  return (
    <div>
      <PageHeader title="Frequently Asked Questions" />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <FaqAccordion faqs={faqs} />
      </div>
    </div>
  );
}
