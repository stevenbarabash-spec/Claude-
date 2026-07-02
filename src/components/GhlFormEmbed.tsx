type Props = {
  title?: string;
  ghlEmbedSrc?: string;
};

// Placeholder for a GoHighLevel form/survey embed. Once the GHL form is
// built for this practice, drop the iframe's `src` (from GHL: Sites >
// Forms > the form > "Embed") into `ghlEmbedSrc` below, or replace this
// component entirely with the raw <iframe> snippet GHL provides.
export default function GhlFormEmbed({
  title = "Schedule Your Complimentary Consultation",
  ghlEmbedSrc,
}: Props) {
  if (ghlEmbedSrc) {
    return (
      <div className="bg-white border border-hairline p-6 md:p-8">
        <h3 className="font-display text-2xl text-brand mb-6">{title}</h3>
        <iframe
          src={ghlEmbedSrc}
          title={title}
          className="w-full min-h-[520px] border-0"
        />
      </div>
    );
  }

  return (
    <div className="bg-white border border-hairline p-6 md:p-8 text-center">
      <h3 className="font-display text-2xl text-brand mb-4">{title}</h3>
      <p className="text-sm text-foreground/70 leading-relaxed">
        This form will be replaced with your GoHighLevel form embed. In
        GoHighLevel, build a form under Sites → Forms with fields for Name,
        Email, Phone, and Preferred Office (Downtown Greenwich / Old
        Greenwich) — always labeled &ldquo;Complimentary,&rdquo; never
        &ldquo;Free&rdquo; — then copy the embed code into
        <code className="mx-1 px-1.5 py-0.5 bg-brand-pale text-brand text-xs">
          GhlFormEmbed
        </code>
        for this page.
      </p>
    </div>
  );
}
