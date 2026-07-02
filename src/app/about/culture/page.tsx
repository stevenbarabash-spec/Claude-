import PageHeader from "@/components/PageHeader";

export const metadata = { title: "Our Culture — Greenwich Dental Group" };

export default function CulturePage() {
  return (
    <div>
      <PageHeader title="Our Culture" />
      <div className="max-w-3xl mx-auto px-6 py-20 space-y-14">
        <div className="text-center">
          <h2 className="font-display text-3xl text-brand mb-4">
            Our Mission
          </h2>
          <p className="text-foreground/75 leading-relaxed">
            Placeholder mission statement — replace with Greenwich Dental
            Group&rsquo;s official mission copy describing the practice&rsquo;s
            commitment to patient care, artistry, and community.
          </p>
        </div>
        <div className="text-center">
          <h2 className="font-display text-3xl text-brand mb-4">
            Our Vision
          </h2>
          <p className="text-foreground/75 leading-relaxed">
            Placeholder vision statement — replace with Greenwich Dental
            Group&rsquo;s official vision copy describing where the practice
            is headed and the standard it holds itself to.
          </p>
        </div>
      </div>
    </div>
  );
}
