import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import { doctors } from "@/lib/data";

export const metadata = { title: "Our Team — Greenwich Dental Group" };

export default function TeamPage() {
  return (
    <div>
      <PageHeader title="Our Team" />

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="relative aspect-[16/9] w-full">
          <Image
            src="/images/team/group.svg"
            alt="Greenwich Dental Group team"
            fill
            className="object-cover"
          />
        </div>
        <p className="text-center font-display text-2xl text-brand mt-6">
          Greenwich Dental Group
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-20 grid grid-cols-2 md:grid-cols-5 gap-4">
        {doctors.map((member) => (
          <div key={member.slug} className="text-center">
            <div className="relative aspect-square bg-brand">
              <Image
                src="/images/doctors/placeholder.svg"
                alt={member.name}
                fill
                className="object-cover"
              />
            </div>
            <p className="mt-3 text-sm tracking-wide-nav uppercase text-brand">
              {member.name}
            </p>
            <p className="text-xs text-foreground/60">{member.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
