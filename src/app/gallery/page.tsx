import Image from "next/image";
import PageHeader from "@/components/PageHeader";

export const metadata = { title: "Gallery — Greenwich Dental Group" };

const cases = [
  {
    title: "Porcelain Veneers",
    description: "Placeholder case description — replace with real before/after details.",
    before: "/images/gallery/before-1.svg",
    after: "/images/gallery/after-1.svg",
  },
  {
    title: "Full Smile Makeover",
    description: "Placeholder case description — replace with real before/after details.",
    before: "/images/gallery/before-2.svg",
    after: "/images/gallery/after-2.svg",
  },
  {
    title: "Invisalign Transformation",
    description: "Placeholder case description — replace with real before/after details.",
    before: "/images/gallery/before-3.svg",
    after: "/images/gallery/after-3.svg",
  },
];

export default function GalleryPage() {
  return (
    <div>
      <PageHeader
        title="Gallery"
        subtitle="Before & after results from our patients."
      />
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-16">
        {cases.map((c) => (
          <div key={c.title}>
            <h2 className="font-display text-2xl text-brand mb-4 text-center">
              {c.title}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative aspect-square">
                <Image src={c.before} alt={`${c.title} before`} fill className="object-cover" />
                <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] tracking-wide-nav uppercase px-2 py-1">
                  Before
                </span>
              </div>
              <div className="relative aspect-square">
                <Image src={c.after} alt={`${c.title} after`} fill className="object-cover" />
                <span className="absolute top-2 left-2 bg-brand text-white text-[10px] tracking-wide-nav uppercase px-2 py-1">
                  After
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm text-foreground/70 text-center max-w-xl mx-auto">
              {c.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
