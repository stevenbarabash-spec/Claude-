import pickle
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

with open('/tmp/all_rows.pkl', 'rb') as f:
    all_rows = pickle.load(f)

NAVY = colors.HexColor("#1A2744")
AMBER_BG = colors.HexColor("#FFF3CD")
AMBER_TXT = colors.HexColor("#7D3C00")
BLUE_BG = colors.HexColor("#EAF4FB")
BLUE_TXT = colors.HexColor("#154360")
STATE_COLORS = {
    "NY": colors.HexColor("#EAF2E3"),
    "NJ": colors.HexColor("#FCEEEA"),
    "CT": colors.HexColor("#EAF0FB"),
}
GREY = colors.HexColor("#566573")

styles = getSampleStyleSheet()
title_style = ParagraphStyle("TitleBig", parent=styles["Title"], fontSize=20,
                              textColor=NAVY, spaceAfter=4)
sub_style = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=10,
                            textColor=GREY, spaceAfter=18)
biz_style = ParagraphStyle("Biz", parent=styles["Heading2"], fontSize=13,
                            textColor=NAVY, spaceAfter=2)
label_style = ParagraphStyle("Label", parent=styles["Normal"], fontSize=8,
                              textColor=GREY, leading=10)
value_style = ParagraphStyle("Value", parent=styles["Normal"], fontSize=9,
                              leading=12)
hook_style = ParagraphStyle("Hook", parent=styles["Normal"], fontSize=9,
                             textColor=AMBER_TXT, leading=12,
                             fontName="Helvetica-Oblique")
email_style = ParagraphStyle("Email", parent=styles["Normal"], fontSize=8.5,
                              textColor=BLUE_TXT, leading=11.5)

doc = SimpleDocTemplate(
    "/home/user/Claude-/All_CarWash_Leads_Combined.pdf",
    pagesize=letter,
    topMargin=0.6 * inch, bottomMargin=0.6 * inch,
    leftMargin=0.55 * inch, rightMargin=0.55 * inch,
)

elements = []
elements.append(Paragraph("Car Wash Acquisition Leads — NY / NJ / CT", title_style))
elements.append(Paragraph(
    f"{len(all_rows)} independently owned car washes &nbsp;|&nbsp; Owner-direct contacts &nbsp;|&nbsp; "
    f"Personalization hooks &amp; ready-to-send draft emails included",
    sub_style
))

HEADERS = [
    "Business Name", "Owner Name", "Address", "Region / County",
    "City", "State", "ZIP", "Phone", "Owner Direct Email",
    "Website", "Business Type", "Years / Background",
    "Personalization Hook", "Draft Email", "Franchise?"
]

for idx, row in enumerate(all_rows):
    row = list(row) + [""] * (len(HEADERS) - len(row))
    state = row[5] or ""
    state_bg = STATE_COLORS.get(state, colors.whitesmoke)

    biz_name = row[0] or "—"
    owner = row[1] or "—"
    address = row[2] or "—"
    region = row[3] or "—"
    city = row[4] or "—"
    zip_ = row[6] or "—"
    phone = row[7] or "—"
    email = row[8] or "—"
    website = row[9] or "—"
    biz_type = row[10] or "—"
    years = row[11] or "—"
    hook = row[12] or "—"
    draft = (row[13] or "—").replace("\n", "<br/>")
    franchise = row[14] or "—"

    header_tbl = Table(
        [[Paragraph(f"{idx+1}. {biz_name}", biz_style),
          Paragraph(f"{city}, {state}", ParagraphStyle(
              "StateTag", parent=styles["Normal"], fontSize=10,
              textColor=NAVY, alignment=TA_CENTER, fontName="Helvetica-Bold"))]],
        colWidths=[5.6 * inch, 1.2 * inch]
    )
    header_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), state_bg),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 0.75, NAVY),
    ]))
    elements.append(header_tbl)

    details_data = [
        [Paragraph("OWNER", label_style), Paragraph(owner, value_style),
         Paragraph("PHONE", label_style), Paragraph(phone, value_style)],
        [Paragraph("ADDRESS", label_style), Paragraph(f"{address}, {region}", value_style),
         Paragraph("ZIP", label_style), Paragraph(zip_, value_style)],
        [Paragraph("BUSINESS TYPE", label_style), Paragraph(biz_type, value_style),
         Paragraph("FRANCHISE?", label_style), Paragraph(franchise, value_style)],
        [Paragraph("WEBSITE", label_style), Paragraph(website, value_style),
         Paragraph("YEARS / BACKGROUND", label_style), Paragraph(years, value_style)],
        [Paragraph("OWNER EMAIL", label_style), Paragraph(email, email_style), "", ""],
    ]
    details_tbl = Table(details_data, colWidths=[1.0*inch, 2.5*inch, 1.1*inch, 2.2*inch])
    details_tbl.setStyle(TableStyle([
        ("SPAN", (1, 4), (3, 4)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.HexColor("#D0D3D4")),
    ]))
    elements.append(details_tbl)
    elements.append(Spacer(1, 4))

    hook_tbl = Table([[Paragraph(f"<b>HOOK:</b> {hook}", hook_style)]], colWidths=[6.8*inch])
    hook_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AMBER_BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E6C36A")),
    ]))
    elements.append(hook_tbl)
    elements.append(Spacer(1, 3))

    draft_tbl = Table([[Paragraph(f"<b>DRAFT EMAIL:</b><br/>{draft}", email_style)]],
                       colWidths=[6.8*inch])
    draft_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE_BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#A9CCE3")),
    ]))
    elements.append(draft_tbl)
    elements.append(Spacer(1, 16))

doc.build(elements)
print("PDF saved: /home/user/Claude-/All_CarWash_Leads_Combined.pdf")
