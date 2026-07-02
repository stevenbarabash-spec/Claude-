"use client";

import { useState } from "react";
import { locations } from "@/lib/data";

type Props = {
  lockedOffice?: (typeof locations)[number]["slug"];
  formType?: "new-patient" | "consultation";
  title?: string;
};

export default function ConsultationForm({
  lockedOffice,
  formType = "consultation",
  title = "Schedule Your Complimentary Consultation",
}: Props) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      preferredOffice: form.get("preferredOffice"),
      message: form.get("message"),
      formType,
    };

    try {
      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      (e.target as HTMLFormElement).reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-brand-pale border border-hairline p-8 text-center">
        <p className="font-display text-2xl text-brand mb-2">Thank you!</p>
        <p className="text-sm text-foreground/80">
          Your complimentary consultation request has been received. Our
          team will reach out shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-hairline p-6 md:p-8">
      <h3 className="font-display text-2xl text-brand mb-6">{title}</h3>
      <div className="grid gap-4">
        <label className="block text-xs tracking-wide-nav uppercase text-brand">
          Name
          <input
            required
            name="name"
            type="text"
            className="mt-1.5 w-full border border-hairline px-3 py-2.5 text-sm text-foreground normal-case tracking-normal focus:outline-none focus:border-brand"
          />
        </label>

        <label className="block text-xs tracking-wide-nav uppercase text-brand">
          Email
          <input
            required
            name="email"
            type="email"
            className="mt-1.5 w-full border border-hairline px-3 py-2.5 text-sm text-foreground normal-case tracking-normal focus:outline-none focus:border-brand"
          />
        </label>

        <label className="block text-xs tracking-wide-nav uppercase text-brand">
          Phone
          <input
            required
            name="phone"
            type="tel"
            className="mt-1.5 w-full border border-hairline px-3 py-2.5 text-sm text-foreground normal-case tracking-normal focus:outline-none focus:border-brand"
          />
        </label>

        <label className="block text-xs tracking-wide-nav uppercase text-brand">
          Preferred Office
          <select
            required
            name="preferredOffice"
            defaultValue={lockedOffice ?? ""}
            disabled={!!lockedOffice}
            className="mt-1.5 w-full border border-hairline px-3 py-2.5 text-sm text-foreground normal-case tracking-normal bg-white focus:outline-none focus:border-brand disabled:bg-brand-pale"
          >
            {!lockedOffice && (
              <option value="" disabled>
                Select an office
              </option>
            )}
            {locations.map((loc) => (
              <option key={loc.slug} value={loc.slug}>
                {loc.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs tracking-wide-nav uppercase text-brand">
          Message
          <textarea
            name="message"
            rows={4}
            className="mt-1.5 w-full border border-hairline px-3 py-2.5 text-sm text-foreground normal-case tracking-normal focus:outline-none focus:border-brand"
          />
        </label>

        <button
          type="submit"
          disabled={status === "submitting"}
          className="mt-2 bg-brand text-white text-xs tracking-wide-nav uppercase py-3.5 hover:bg-brand-light transition-colors disabled:opacity-60"
        >
          {status === "submitting" ? "Sending…" : "Request Complimentary Consultation"}
        </button>

        {status === "error" && (
          <p className="text-xs text-red-600">
            Something went wrong. Please call the office directly.
          </p>
        )}
      </div>
    </form>
  );
}
