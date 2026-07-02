import PageHeader from "@/components/PageHeader";
import { testimonials } from "@/lib/data";

export const metadata = { title: "Testimonials — Greenwich Dental Group" };

export default function TestimonialsPage() {
  return (
    <div>
      <PageHeader
        title="Testimonials"
        subtitle="See what our patients are saying on Google."
      />
      <div className="max-w-4xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
        {testimonials.map((t, i) => (
          <div key={i} className="border border-hairline p-6 text-center">
            <div className="text-brand mb-3" aria-hidden>
              {"★".repeat(t.rating)}
            </div>
            <p className="text-sm text-foreground/75 leading-relaxed">
              {t.text}
            </p>
            <p className="mt-4 text-xs tracking-wide-nav uppercase text-foreground/50">
              {t.author}
            </p>
          </div>
        ))}
      </div>
      <div className="text-center pb-16">
        <a
          href="https://www.google.com/search?q=greenwich+dental+group+reviews"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs tracking-wide-nav uppercase border-b border-brand pb-1 text-brand hover:text-brand-light hover:border-brand-light transition-colors"
        >
          Read All Reviews on Google
        </a>
      </div>
    </div>
  );
}
