import PageHeader from "@/components/PageHeader";
import { services } from "@/lib/data";

export const metadata = { title: "Services — Greenwich Dental Group" };

export default function ServicesPage() {
  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="Comprehensive, modern dentistry under one roof."
      />
      <div className="max-w-4xl mx-auto px-6 py-16 divide-y divide-hairline">
        {services.map((s) => (
          <div key={s.name} className="py-8 grid sm:grid-cols-3 gap-4">
            <h2 className="sm:col-span-1 font-display text-2xl text-brand">
              {s.name}
            </h2>
            <p className="sm:col-span-2 text-foreground/75 leading-relaxed">
              {s.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
