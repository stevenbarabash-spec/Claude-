"use client";

import { useState } from "react";
import { Faq } from "@/lib/data";

export default function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-hairline border-t border-b border-hairline">
      {faqs.map((faq, i) => (
        <div key={faq.question}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between py-5 text-left"
          >
            <span className="font-display text-lg text-brand pr-4">
              {faq.question}
            </span>
            <span className="text-brand text-xl leading-none">
              {open === i ? "−" : "+"}
            </span>
          </button>
          {open === i && (
            <p className="pb-5 text-sm text-foreground/70 leading-relaxed">
              {faq.answer}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
