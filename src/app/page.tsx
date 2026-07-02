import Image from "next/image";
import Link from "next/link";
import { locations, services, testimonials } from "@/lib/data";

export default function Home() {
  return (
    <div>
      {/* Hero b-roll — replace poster/video src with Jonathan's footage */}
      <section className="relative h-[80vh] min-h-[520px] w-full overflow-hidden bg-brand">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="/images/hero/poster.svg"
        >
          {/* <source src="/videos/hero-b-roll.mp4" type="video/mp4" /> */}
        </video>
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center px-6">
          <h1 className="font-display text-4xl md:text-6xl text-white max-w-3xl leading-tight">
            A New Standard in Greenwich Dentistry
          </h1>
          <p className="mt-5 text-white/85 max-w-xl text-sm md:text-base tracking-wide">
            Simple, personalized care — from routine visits to complete
            smile transformations.
          </p>
          <Link
            href="/patient-info/complimentary-consultation"
            className="mt-8 bg-white text-brand text-xs tracking-wide-nav uppercase px-8 py-4 hover:bg-brand-pale transition-colors"
          >
            Request a Complimentary Consultation
          </Link>
        </div>
      </section>

      {/* Location landing tiles */}
      <section className="grid md:grid-cols-2">
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
              <span className="text-xs tracking-wide-nav uppercase text-white/75">
                Visit Our Office
              </span>
              <h2 className="font-display text-3xl md:text-4xl text-white mt-2">
                {loc.name}
              </h2>
              <span className="mt-5 border-b border-white/60 text-white text-xs tracking-wide-nav uppercase pb-1 group-hover:border-white">
                Book Now
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* Intro */}
      <section className="max-w-3xl mx-auto text-center px-6 py-24">
        <h2 className="font-display text-3xl md:text-4xl text-brand">
          Simple, Clean, and Personalized Care
        </h2>
        <p className="mt-5 text-foreground/75 leading-relaxed">
          At Greenwich Dental Group, our team of doctors and master
          ceramists combine artistry and precision to deliver results that
          look and feel entirely natural. From routine care to complete
          smile makeovers, every visit is guided by a custom approach built
          around you.
        </p>
      </section>

      {/* Services strip */}
      <section className="bg-brand-pale py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl text-brand text-center mb-12">
            Our Services
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
            {services.slice(0, 4).map((s) => (
              <div key={s.name} className="text-center">
                <h3 className="text-sm tracking-wide-nav uppercase text-brand mb-2">
                  {s.name}
                </h3>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link
              href="/services"
              className="text-xs tracking-wide-nav uppercase border-b border-brand pb-1 text-brand hover:text-brand-light hover:border-brand-light transition-colors"
            >
              View All Services
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonial snippet */}
      <section className="max-w-3xl mx-auto text-center px-6 py-24">
        <p className="text-xs tracking-wide-nav uppercase text-brand mb-4">
          What Our Patients Say
        </p>
        <p className="font-display text-2xl md:text-3xl text-foreground leading-snug">
          &ldquo;{testimonials[0].text}&rdquo;
        </p>
        <Link
          href="/testimonials"
          className="mt-8 inline-block text-xs tracking-wide-nav uppercase border-b border-brand pb-1 text-brand hover:text-brand-light hover:border-brand-light transition-colors"
        >
          Read More Reviews
        </Link>
      </section>
    </div>
  );
}
