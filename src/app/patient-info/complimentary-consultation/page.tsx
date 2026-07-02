import PageHeader from "@/components/PageHeader";
import ConsultationForm from "@/components/ConsultationForm";

export const metadata = {
  title: "Complimentary Consultation — Greenwich Dental Group",
};

export default function ComplimentaryConsultationPage() {
  return (
    <div>
      <PageHeader
        title="Complimentary Consultation"
        subtitle="Schedule a complimentary consultation to discuss your smile goals with our team."
      />
      <div className="max-w-xl mx-auto px-6 py-16">
        <ConsultationForm formType="consultation" />
      </div>
    </div>
  );
}
