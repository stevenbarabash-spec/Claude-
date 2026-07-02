import Link from "next/link";
import { locations } from "@/lib/data";

export default function Footer() {
  return (
    <footer className="bg-brand text-white mt-24">
      <div className="max-w-6xl mx-auto px-6 py-14 grid gap-10 md:grid-cols-3">
        <div>
          <div className="font-display text-xl tracking-wide-nav mb-3">
            GREENWICH DENTAL GROUP
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            Modern, personalized dentistry serving Greenwich and the
            surrounding community.
          </p>
        </div>

        {locations.map((loc) => (
          <div key={loc.slug}>
            <h3 className="text-sm tracking-wide-nav uppercase mb-3">
              {loc.name}
            </h3>
            <p className="text-sm text-white/70 leading-relaxed">
              {loc.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              <span className="block mt-2">{loc.phone}</span>
            </p>
            <Link
              href={`/locations/${loc.slug}`}
              className="inline-block mt-3 text-xs tracking-wide-nav uppercase border-b border-white/40 pb-0.5 hover:border-white transition-colors"
            >
              View Office
            </Link>
          </div>
        ))}
      </div>
      <div className="border-t border-white/15 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Greenwich Dental Group. All rights
        reserved.
      </div>
    </footer>
  );
}
