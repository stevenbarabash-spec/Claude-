import PageHeader from "@/components/PageHeader";
import DoctorCard from "@/components/DoctorCard";
import { doctors } from "@/lib/data";

export const metadata = { title: "Our Doctors — Greenwich Dental Group" };

export default function DoctorsPage() {
  return (
    <div>
      <PageHeader
        title="Our Doctors"
        subtitle="Hover to meet the doctors of Greenwich Dental Group."
      />
      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-4">
        {doctors.map((doc) => (
          <DoctorCard key={doc.slug} doctor={doc} />
        ))}
      </div>
    </div>
  );
}
