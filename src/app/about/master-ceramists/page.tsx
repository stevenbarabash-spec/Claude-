import Image from "next/image";
import PageHeader from "@/components/PageHeader";

export const metadata = { title: "Master Ceramists — Greenwich Dental Group" };

const placeholderCeramists = [
  { name: "Master Ceramist Name", bio: "Bio and photo to be provided." },
  { name: "Master Ceramist Name", bio: "Bio and photo to be provided." },
];

export default function MasterCeramistsPage() {
  return (
    <div>
      <PageHeader
        title="Master Ceramists"
        subtitle="The artisans behind every custom smile design."
      />
      <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10">
        {placeholderCeramists.map((c, i) => (
          <div key={i} className="text-center">
            <div className="relative aspect-square bg-brand mx-auto max-w-xs">
              <Image
                src="/images/master-ceramists/placeholder.svg"
                alt={c.name}
                fill
                className="object-cover"
              />
            </div>
            <p className="mt-4 font-display text-2xl text-brand">{c.name}</p>
            <p className="mt-2 text-sm text-foreground/70">{c.bio}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
