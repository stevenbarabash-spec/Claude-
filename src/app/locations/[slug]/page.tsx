import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { locations, doctorsForLocation } from "@/lib/data";
import GhlFormEmbed from "@/components/GhlFormEmbed";

export function generateStaticParams() {
  return locations.map((l) => ({ slug: l.slug }));
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const location = locations.find((l) => l.slug === slug);
  if (!location) notFound();

  const officeDoctors = doctorsForLocation(location.slug);

  return (
    <div>
      <div className="relative h-[42vh] min-h-[320px] w-full">
        <Image
          src={location.heroImage}
          alt={location.name}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <h1 className="font-display text-4xl md:text-5xl text-white text-center px-6">
            {location.name}
          </h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-12">
        <div>
          <h2 className="text-xs tracking-wide-nav uppercase text-brand mb-3">
            Address
          </h2>
          <p className="text-foreground/80 leading-relaxed">
            {location.addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
          <p className="mt-2 text-foreground/80">{location.phone}</p>

          <h2 className="text-xs tracking-wide-nav uppercase text-brand mt-8 mb-3">
            Hours
          </h2>
          <ul className="text-foreground/80 space-y-1">
            {location.hours.map((h) => (
              <li key={h.day} className="flex justify-between max-w-xs">
                <span>{h.day}</span>
                <span>{h.time}</span>
              </li>
            ))}
          </ul>

          <h2 className="text-xs tracking-wide-nav uppercase text-brand mt-8 mb-3">
            Doctors at This Practice
          </h2>
          <ul className="space-y-2">
            {officeDoctors.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/about/doctors/${d.slug}`}
                  className="text-foreground/80 hover:text-brand transition-colors"
                >
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <GhlFormEmbed
          title={`Schedule Your Complimentary Consultation — ${location.name}`}
        />
      </div>
    </div>
  );
}
