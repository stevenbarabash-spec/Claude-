import Image from "next/image";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { locations } from "@/lib/data";

export const metadata = { title: "Locations — Greenwich Dental Group" };

export default function LocationsPage() {
  return (
    <div>
      <PageHeader title="Our Locations" />
      <div className="grid md:grid-cols-2">
        {locations.map((loc) => (
          <Link
            key={loc.slug}
            href={`/locations/${loc.slug}`}
            className="group relative h-[380px] overflow-hidden block"
          >
            <Image
              src={loc.heroImage}
              alt={loc.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
            <div className="relative z-10 flex h-full flex-col items-center justify-center text-center px-6">
              <h2 className="font-display text-3xl md:text-4xl text-white">
                {loc.name}
              </h2>
              <span className="mt-5 border-b border-white/60 text-white text-xs tracking-wide-nav uppercase pb-1 group-hover:border-white">
                Book Now
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
