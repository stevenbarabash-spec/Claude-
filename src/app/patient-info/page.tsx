import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const metadata = { title: "Patient Info — Greenwich Dental Group" };

const links = [
  {
    label: "New Patient Form",
    href: "/patient-info/new-patient-form",
    desc: "Complete your intake paperwork before your visit.",
  },
  {
    label: "Complimentary Consultation",
    href: "/patient-info/complimentary-consultation",
    desc: "Request a complimentary consultation with our team.",
  },
  {
    label: "FAQs",
    href: "/patient-info/faqs",
    desc: "Answers to common patient questions.",
  },
];

export default function PatientInfoPage() {
  return (
    <div>
      <PageHeader title="Patient Info" />
      <div className="max-w-4xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-6">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block border border-hairline p-8 text-center hover:border-brand transition-colors"
          >
            <p className="font-display text-xl text-brand">{l.label}</p>
            <p className="mt-2 text-sm text-foreground/60">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
