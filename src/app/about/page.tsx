import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const metadata = { title: "About Us — Greenwich Dental Group" };

const links = [
  { label: "Doctors", href: "/about/doctors", desc: "Meet our doctors." },
  { label: "Team", href: "/about/team", desc: "Meet our full team." },
  { label: "Our Culture", href: "/about/culture", desc: "Our mission and vision." },
  {
    label: "Master Ceramists",
    href: "/about/master-ceramists",
    desc: "The artisans behind every smile.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <PageHeader title="About Us" />
      <div className="max-w-4xl mx-auto px-6 py-16 grid sm:grid-cols-2 gap-6">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block border border-hairline p-8 text-center hover:border-brand transition-colors"
          >
            <p className="font-display text-2xl text-brand">{l.label}</p>
            <p className="mt-2 text-sm text-foreground/60">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
