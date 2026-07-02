import Image from "next/image";
import PageHeader from "@/components/PageHeader";

export const metadata = { title: "Internship Program — Greenwich Dental Group" };

export default function InternshipPage() {
  return (
    <div>
      <PageHeader
        title="Internship Program"
        subtitle="Hands-on experience for the next generation of dental professionals."
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="relative aspect-video bg-brand flex items-center justify-center">
          {/* Replace with Erin's internship program video */}
          <Image
            src="/images/internship/poster.svg"
            alt="Internship program video"
            fill
            className="object-cover"
          />
        </div>
        <p className="mt-8 text-foreground/75 leading-relaxed text-center">
          Placeholder copy highlighting the Greenwich Dental Group
          internship program — replace with details once provided,
          covering what interns experience, who is eligible, and how to
          apply.
        </p>
      </div>
    </div>
  );
}
