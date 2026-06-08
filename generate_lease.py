#!/usr/bin/env python3
"""
Lease Generator
---------------
Appends a tenant-specific addendum page to the base lease template.
Usage:
    python3 generate_lease.py --tenant "John & Jane Doe" \
        --address "123 Main St, Apt 4B, Miami, FL 33101" \
        --start "August 1, 2026" \
        --end "July 31, 2027" \
        --rent "2500" \
        --deposit "2500" \
        --output "lease_JohnDoe.pdf"

Add any extra clauses with --note "text" (repeatable).
"""

import argparse
import textwrap
from datetime import date
import fitz  # PyMuPDF


TEMPLATE_PDF = "lease_template.pdf"


def build_addendum_page(doc: fitz.Document, tenant: str, address: str,
                         start: str, end: str, rent: str, deposit: str,
                         notes: list[str]) -> None:
    # Match template page size
    template_page = doc[0]
    width = template_page.rect.width
    height = template_page.rect.height

    page = doc.new_page(width=width, height=height)

    margin = 60
    y = margin
    line_height = 18
    col = margin

    def draw_text(text, x=col, size=11, bold=False, color=(0, 0, 0)):
        nonlocal y
        fontname = "helv" if not bold else "hebo"
        page.insert_text((x, y), text, fontname=fontname, fontsize=size, color=color)
        y += line_height

    def draw_line():
        nonlocal y
        page.draw_line((margin, y), (width - margin, y), color=(0.6, 0.6, 0.6), width=0.5)
        y += 10

    def draw_spacer(px=8):
        nonlocal y
        y += px

    # Title
    draw_text("LEASE ADDENDUM — TENANT INFORMATION", size=14, bold=True)
    draw_spacer(4)
    draw_line()
    draw_spacer(4)

    fields = [
        ("Tenant(s):", tenant),
        ("Property Address:", address),
        ("Lease Start Date:", start),
        ("Lease End Date:", end),
        ("Monthly Rent:", f"${rent}"),
        ("Security Deposit:", f"${deposit}"),
        ("Date Generated:", date.today().strftime("%B %d, %Y")),
    ]

    for label, value in fields:
        # Label + value on same line
        page.insert_text((col, y), label, fontname="hebo", fontsize=11, color=(0, 0, 0))
        page.insert_text((col + 160, y), value, fontname="helv", fontsize=11, color=(0, 0, 0))
        y += line_height

    if notes:
        draw_spacer(12)
        draw_line()
        draw_text("Additional Terms & Conditions:", bold=True)
        draw_spacer(4)
        for note in notes:
            wrapped = textwrap.wrap(note, width=90)
            for i, line in enumerate(wrapped):
                prefix = "• " if i == 0 else "  "
                draw_text(prefix + line)
        draw_spacer(4)

    # Signature section
    draw_spacer(20)
    draw_line()
    draw_text("SIGNATURES", bold=True, size=12)
    draw_spacer(10)

    sig_y = y
    sig_sections = [
        ("Tenant Signature", "Date"),
        ("Tenant Signature", "Date"),
        ("Landlord Signature", "Date"),
    ]

    col_left = margin
    col_right = width // 2 + 20

    for label_sig, label_date in sig_sections:
        # Signature line left
        page.draw_line((col_left, y + 30), (col_left + 200, y + 30), width=0.7)
        page.insert_text((col_left, y + 44), label_sig, fontname="helv", fontsize=9, color=(0.4, 0.4, 0.4))

        # Date line right of signature
        page.draw_line((col_left + 220, y + 30), (col_left + 330, y + 30), width=0.7)
        page.insert_text((col_left + 220, y + 44), label_date, fontname="helv", fontsize=9, color=(0.4, 0.4, 0.4))

        y += 65


def main():
    parser = argparse.ArgumentParser(description="Generate a tenant lease PDF.")
    parser.add_argument("--tenant", required=True, help="Tenant full name(s)")
    parser.add_argument("--address", required=True, help="Full property address")
    parser.add_argument("--start", required=True, help="Lease start date (e.g. August 1, 2026)")
    parser.add_argument("--end", required=True, help="Lease end date (e.g. July 31, 2027)")
    parser.add_argument("--rent", required=True, help="Monthly rent amount (numbers only)")
    parser.add_argument("--deposit", required=True, help="Security deposit amount (numbers only)")
    parser.add_argument("--note", action="append", default=[], dest="notes",
                        help="Additional clause (repeat flag for multiple)")
    parser.add_argument("--output", required=True, help="Output PDF filename")
    args = parser.parse_args()

    doc = fitz.open(TEMPLATE_PDF)
    build_addendum_page(doc, args.tenant, args.address, args.start, args.end,
                        args.rent, args.deposit, args.notes)
    doc.save(args.output, garbage=4, deflate=True)
    print(f"Saved: {args.output}  ({len(doc)} pages)")


if __name__ == "__main__":
    main()
