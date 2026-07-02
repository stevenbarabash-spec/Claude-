import PageHeader from "@/components/PageHeader";
import GhlFormEmbed from "@/components/GhlFormEmbed";

export const metadata = { title: "New Patient Form — Greenwich Dental Group" };

export default function NewPatientFormPage() {
  return (
    <div>
      <PageHeader
        title="New Patient Form"
        subtitle="Save time at your first visit by submitting your information ahead of time."
      />
      <div className="max-w-xl mx-auto px-6 py-16">
        <GhlFormEmbed title="New Patient Intake" />
      </div>
    </div>
  );
}
