#!/usr/bin/env python3
"""
Lease Generator
---------------
Appends a tenant-specific addendum page to the base lease template.
Usage:
    python3 generate_lease.py --tenant "John & Jane Doe" \
        --address "123 Main St, Greenwich, CT 06830" \
        --start "August 1, 2026" \
        --end "July 31, 2027" \
        --rent "4,500" \
        --deposit "9,000" \
        --output "lease_JohnDoe.pdf"

Add any extra clauses with --note 'text' (repeatable).
Wrap --note values in single quotes if they contain $ signs.
"""

import argparse
import io
import datetime
import fitz  # PyMuPDF

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.platypus import HRFlowable
from reportlab.lib import colors


TEMPLATE_PDF = "lease_template.pdf"


def make_addendum_bytes(tenant, address, start, end, rent, deposit, notes):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter,
        leftMargin=0.75*inch, rightMargin=0.75*inch,
        topMargin=0.75*inch, bottomMargin=0.75*inch)

    styles = getSampleStyleSheet()
    normal = ParagraphStyle('normal', fontName='Helvetica', fontSize=11, leading=16)
    bold = ParagraphStyle('bold', fontName='Helvetica-Bold', fontSize=11, leading=16)
    title = ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=14,
                           leading=20, spaceAfter=6)
    small = ParagraphStyle('small', fontName='Helvetica', fontSize=9,
                           textColor=colors.grey)

    story = []
    story.append(Paragraph("LEASE ADDENDUM — TENANT INFORMATION", title))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
    story.append(Spacer(1, 10))

    rows = [
        ["Tenant(s):",        tenant],
        ["Property Address:", address],
        ["Lease Start Date:", start],
        ["Lease End Date:",   end],
        ["Monthly Rent:",     f"${rent}"],
        ["Security Deposit:", f"${deposit}"],
        ["Date Generated:",   datetime.date.today().strftime("%B %d, %Y")],
    ]
    table_data = [
        [Paragraph(f"<b>{label}</b>", normal), Paragraph(value, normal)]
        for label, value in rows
    ]
    t = Table(table_data, colWidths=[2.2*inch, 4.8*inch])
    t.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING',    (0, 0), (-1, -1), 2),
    ]))
    story.append(t)

    if notes:
        story.append(Spacer(1, 12))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Spacer(1, 6))
        story.append(Paragraph("<b>Additional Terms &amp; Conditions:</b>", normal))
        story.append(Spacer(1, 4))
        for note in notes:
            story.append(Paragraph(f"• {note}", normal))

    story.append(Spacer(1, 30))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>SIGNATURES</b>", bold))
    story.append(Spacer(1, 20))

    for label in ("Tenant Signature", "Tenant Signature", "Landlord Signature"):
        sig_row = [[
            Paragraph("_" * 44, normal),
            Paragraph("_" * 18, normal),
        ]]
        sig_table = Table(sig_row, colWidths=[4.5*inch, 2.5*inch])
        story.append(sig_table)
        label_row = [[
            Paragraph(label, small),
            Paragraph("Date", small),
        ]]
        label_table = Table(label_row, colWidths=[4.5*inch, 2.5*inch])
        story.append(label_table)
        story.append(Spacer(1, 22))

    doc.build(story)
    buf.seek(0)
    return buf.read()


def main():
    parser = argparse.ArgumentParser(description="Generate a tenant lease PDF.")
    parser.add_argument("--tenant",  required=True, help="Tenant full name(s)")
    parser.add_argument("--address", required=True, help="Full property address")
    parser.add_argument("--start",   required=True, help="Lease start date (e.g. August 1, 2026)")
    parser.add_argument("--end",     required=True, help="Lease end date (e.g. July 31, 2027)")
    parser.add_argument("--rent",    required=True, help="Monthly rent amount (e.g. 4,500)")
    parser.add_argument("--deposit", required=True, help="Security deposit amount (e.g. 9,000)")
    parser.add_argument("--note", action="append", default=[], dest="notes",
                        help="Additional clause — repeat for multiple. Use single quotes if text contains $.")
    parser.add_argument("--output",  required=True, help="Output PDF filename")
    args = parser.parse_args()

    addendum_bytes = make_addendum_bytes(
        args.tenant, args.address, args.start, args.end,
        args.rent, args.deposit, args.notes
    )

    template = fitz.open(TEMPLATE_PDF)
    addendum = fitz.open("pdf", addendum_bytes)
    template.insert_pdf(addendum)
    template.save(args.output, garbage=4, deflate=True, clean=True)
    print(f"Saved: {args.output}  ({len(template)} pages)")


if __name__ == "__main__":
    main()
