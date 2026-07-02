import { notFound } from "next/navigation";
import Link from "next/link";
import { doctors, locations } from "@/lib/data";

export function generateStaticParams() {
  return doctors.map((d) => ({ slug: d.slug }));
}

export default async function DoctorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doctor = doctors.find((d) => d.slug === slug);
  if (!doctor) notFound();

  const officeNames = locations
    .filter((l) => doctor.locations.includes(l.slug))
    .map((l) => l.name);

  return (
    <div className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-start">
      <div className="aspect-[4/5] bg-brand flex items-center justify-center text-white/60 text-sm">
        {/* Replace with doctor video embed */}
        Video coming soon
      </div>
      <div>
        <h1 className="font-display text-4xl md:text-5xl text-brand">
          {doctor.name}
        </h1>
        <p className="text-xs tracking-wide-nav uppercase text-brand-light mt-3">
          {doctor.title}
        </p>
        <p className="mt-6 text-foreground/75 leading-relaxed">{doctor.bio}</p>
        <p className="mt-6 text-sm text-foreground/60">
          Sees patients at: {officeNames.join(" & ")}
        </p>
        <Link
          href="/about/doctors"
          className="mt-8 inline-block text-xs tracking-wide-nav uppercase border-b border-brand pb-1 text-brand hover:text-brand-light hover:border-brand-light transition-colors"
        >
          Back to All Doctors
        </Link>
      </div>
    </div>
  );
}
