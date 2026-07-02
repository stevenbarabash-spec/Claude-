"use client";

import Script from "next/script";

// GoHighLevel "Main Form GDG Online" embed (Sites → Forms).
const GHL_FORM_ID = "ZC2l2MaYDjUdeEdqJQxc";
const GHL_FORM_SRC = `https://link.globalupcrm.com/widget/form/${GHL_FORM_ID}`;
const GHL_FORM_EMBED_SCRIPT = "https://link.globalupcrm.com/js/form_embed.js";

type Props = {
  title?: string;
};

export default function GhlFormEmbed({
  title = "Schedule Your Complimentary Consultation",
}: Props) {
  return (
    <div className="bg-white border border-hairline p-6 md:p-8">
      <h3 className="font-display text-2xl text-brand mb-6">{title}</h3>
      <iframe
        src={GHL_FORM_SRC}
        style={{ width: "100%", height: "569px", border: "none", borderRadius: "3px" }}
        id={`inline-${GHL_FORM_ID}`}
        data-layout="{'id':'INLINE'}"
        data-trigger-type="alwaysShow"
        data-trigger-value=""
        data-activation-type="alwaysActivated"
        data-activation-value=""
        data-deactivation-type="neverDeactivate"
        data-deactivation-value=""
        data-form-name="Main Form GDG Online"
        data-height="569"
        data-layout-iframe-id={`inline-${GHL_FORM_ID}`}
        data-form-id={GHL_FORM_ID}
        title="Main Form GDG Online"
      />
      <Script src={GHL_FORM_EMBED_SCRIPT} strategy="afterInteractive" />
    </div>
  );
}
