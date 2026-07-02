import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { locations } from "@/lib/data";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, preferredOffice, message, formType } = body;

  if (!name || !email || !phone || !preferredOffice) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 }
    );
  }

  const location = locations.find((l) => l.slug === preferredOffice);
  const officeEmail = location?.officeEmail ?? locations[0].officeEmail;

  // Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and FROM_EMAIL
  // to be configured as environment variables before this will send mail.
  const hasSmtpConfig =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (!hasSmtpConfig) {
    console.log("[consultation] SMTP not configured — logging submission:", {
      name,
      email,
      phone,
      preferredOffice,
      message,
      formType,
      routedTo: officeEmail,
    });
    return NextResponse.json({ ok: true, routedTo: officeEmail });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.FROM_EMAIL ?? process.env.SMTP_USER,
      to: officeEmail,
      replyTo: email,
      subject: `${
        formType === "new-patient" ? "New Patient Form" : "Complimentary Consultation Request"
      } — ${location?.name ?? preferredOffice}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nPreferred Office: ${
        location?.name ?? preferredOffice
      }\n\nMessage:\n${message ?? "—"}`,
    });

    return NextResponse.json({ ok: true, routedTo: officeEmail });
  } catch (err) {
    console.error("[consultation] Failed to send email", err);
    return NextResponse.json(
      { error: "Unable to send message right now. Please call the office directly." },
      { status: 500 }
    );
  }
}
