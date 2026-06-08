#!/usr/bin/env node
/**
 * Lease Generator
 * ---------------
 * Creates a Word document (.docx) with the full Greenwich Association of
 * Realtors lease text, followed by a tenant-specific addendum page.
 *
 * Usage:
 *   node generate_lease.js \
 *     --tenant "John & Jane Doe" \
 *     --address "45 Harbor View Rd, Greenwich, CT 06830" \
 *     --start "August 1, 2026" \
 *     --end "July 31, 2027" \
 *     --rent "4,500" \
 *     --deposit "9,000" \
 *     --output "lease_JohnDoe.docx"
 *
 *   Add extra clauses: --note "clause text" (repeatable)
 */

const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  HeadingLevel, PageBreak, LevelFormat, Header, Footer, PageNumber,
  UnderlineType,
} = require("docx");

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};
const getAll = (flag) => {
  const out = [];
  args.forEach((a, i) => { if (a === flag) out.push(args[i + 1]); });
  return out;
};

const tenant  = get("--tenant")  || "______________________________";
const address = get("--address") || "______________________________";
const start   = get("--start")   || "______________________________";
const end     = get("--end")     || "______________________________";
const rent    = get("--rent")    || "______";
const deposit = get("--deposit") || "______";
const notes   = getAll("--note");
const output  = get("--output")  || "lease_output.docx";

// ── Helpers ───────────────────────────────────────────────────────────────────
const MARGIN = { top: 1080, right: 1080, bottom: 1080, left: 1080 }; // 0.75"
const PAGE   = { size: { width: 12240, height: 15840 }, margin: MARGIN };

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const thinLine  = { style: BorderStyle.SINGLE, size: 4, color: "999999" };

function p(runs, opts = {}) {
  if (typeof runs === "string") runs = [new TextRun({ text: runs, size: 20 })];
  return new Paragraph({ children: runs, spacing: { after: 80 }, ...opts });
}

function bold(text, size = 20) {
  return new TextRun({ text, bold: true, size });
}

function run(text, size = 20) {
  return new TextRun({ text, size });
}

function heading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 20 })],
    spacing: { before: 160, after: 60 },
  });
}

function sectionTitle(num, title) {
  return new Paragraph({
    children: [new TextRun({ text: `${num}. ${title}`, bold: true, size: 20 })],
    spacing: { before: 200, after: 60 },
  });
}

function sub(letter, text) {
  return new Paragraph({
    children: [new TextRun({ text: `(${letter})\t${text}`, size: 20 })],
    indent: { left: 540, hanging: 360 },
    spacing: { after: 60 },
  });
}

function blankLine(text = "") {
  return new Paragraph({
    children: [new TextRun({ text, size: 20 })],
    spacing: { after: 40 },
  });
}

function hrRule() {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } },
    spacing: { after: 80 },
  });
}

function sigLine(label) {
  return [
    new Paragraph({
      children: [new TextRun({ text: " ", size: 20 })],
      spacing: { before: 400, after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 1 } },
    }),
    new Paragraph({
      children: [new TextRun({ text: label, size: 18, color: "666666" })],
      spacing: { after: 160 },
    }),
  ];
}

// ── Lease body paragraphs ─────────────────────────────────────────────────────
const today = new Date();
const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const leaseBody = [

  // Title
  new Paragraph({
    children: [bold("THE GREENWICH ASSOCIATION OF REALTORS, INC.", 24)],
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
  }),
  new Paragraph({
    children: [bold("RESIDENTIAL LEASE", 22)],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  }),

  // Date line
  p([
    run("The terms of this Lease dated as of the "),
    run("_____________", 20), run(" day of "), run("_______________________________", 20),
    run(", 20____ are agreed to by"),
  ]),

  // Landlord / Tenant table
  new Table({
    width: { size: 10080, type: WidthType.DXA },
    columnWidths: [5040, 5040],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
    rows: [
      new TableRow({ children: [
        new TableCell({ borders: noBorders, children: [p([bold("LANDLORD "), run("________________________________")])] }),
        new TableCell({ borders: noBorders, children: [p([bold("TENANT "), run(tenant)])] }),
      ]}),
      new TableRow({ children: [
        new TableCell({ borders: noBorders, children: [p([run("Address ________________________________")])] }),
        new TableCell({ borders: noBorders, children: [p([run("Address ________________________________")])] }),
      ]}),
      new TableRow({ children: [
        new TableCell({ borders: noBorders, children: [p([run("________________________________")])] }),
        new TableCell({ borders: noBorders, children: [p([run("________________________________")])] }),
      ]}),
    ],
  }),
  blankLine(),
  p([bold("Original lease term: "), run("____________ Number of Months")]),
  p([run("Beginning at 12:01 a.m. on "), run(start), run(" and ending at 11:59 p.m. on "), run(end)]),
  blankLine(),

  // Definitions
  heading("DEFINITIONS:"),
  p([bold("You, Your and Tenant: "), run("The person signing this Lease as Tenant and any other person occupying the Dwelling with our permission.")]),
  p([bold("We, Our, Us and Landlord: "), run("The person or business organization signing this Lease as Landlord and anyone who becomes the owner of the Dwelling after the date this Lease is signed.")]),
  p([run("All masculine pronouns shall include the feminine or neuter pronouns and all singular pronouns shall include plural pronouns whenever it makes sense to do so in this Lease.")]),
  blankLine(),

  p([bold("Address of Dwelling: "), run(address)]),
  p([bold("Monthly Rent: $"), run(rent), run("          "), bold("Security Deposit: $"), run(deposit)]),
  p([run("                                                    Not to exceed 2 month’s rent. 1 month’s rent if Tenant is over age 62")]),
  p([bold("Rental payment to be sent to: "), run("________________________________________________________________________________")]),
  p([run("                                                           Name, Address")]),
  blankLine(),

  // Section 1
  sectionTitle("1", "THE LEASE:"),
  p([run("We agree to rent □ Apartment  □ Condominium  □ House and Grounds  □ Other (describe) _______________ (the “Dwelling”) to you and you agree to rent the Dwelling from us for the Lease Term. We and you agree to be bound by the terms of this Lease. The Lease includes (insert number, if applicable) _____ parking space(s); _____ garage(s) only for your personal use.")]),
  p([run("The Dwelling ___ is ___ is not a unit in a common interest community.")]),

  // Section 2
  sectionTitle("2", "RENT:"),
  p([run("You agree to pay us total rent for the Lease Term of $_________________________.")]),
  p([run("You agree to pay us $__________________ as of the date of this Lease as rent for the period from ________________ to ________________.")]),
  p([run("Thereafter, you shall pay your Monthly Rent in advance on the _____ day of each month. If the bank does not honor your monthly rent check on which it is drawn; that will mean that we have not received your Monthly Rent. You agree to make all monthly rent payments to us at the rental payment address indicated above or wherever we tell you by written notice.")]),
  p([run("If we have not received any payment of your Monthly Rent within ten (10) days of the due date, you will pay a late charge at the rate of $_________________ per month for each payment of Monthly Rent that is more than ten (10) days late.")]),

  // Section 3
  sectionTitle("3", "UTILITIES, SYSTEMS & MAINTENANCE: (check one, not both)"),
  sub("a", "We __ You __ will pay for electricity."),
  sub("b", "We __ You __ will pay for water."),
  sub("c", "We __ You __ will pay for telephone."),
  sub("d", "We __ You __ will pay for cable."),
  sub("e", "We __ You __ will pay security system fees."),
  sub("f", "We __ You __ will pay for lawn and grounds maintenance."),
  sub("g", "We __ You __ will pay for snow removal."),
  sub("h", "We __ You __ will pay for trash collection."),
  sub("i", "We __ You __ will pay for gas."),
  sub("j", "We __ You __ will pay for heating fuel."),
  sub("k", "We __ You __ will pay for opening and closing of pool."),
  sub("l", "We __ You __ will pay for seasonal pool maintenance."),
  p([run("If the Dwelling has oil heat and you are to pay for heating fuel, you will pay us, at the beginning of the term, the then-current price for any fuel in the tank(s) used exclusively for the Dwelling. We will pay you, at the end of the term, the then-current price for all fuel in such tank(s).")]),

  // Section 4
  sectionTitle("4", "YOUR DUTIES:"),
  p([run("You agree")]),
  sub("a", "to use the Dwelling in compliance with all building, housing and fire codes affecting health and safety and any applicable condominium, co-operative or other applicable rules and regulations affecting the Dwelling. If you do not, and the cost of our insurance increases or we are fined, you will reimburse us for the cost of such insurance increase or such fine or fines."),
  sub("b", "to keep the Dwelling clean, neat and safe."),
  sub("c", "to remove from the Dwelling all garbage, trash and other waste in a clean and safe manner."),
  sub("d", "to keep the Dwelling’s plumbing fixtures and all appliances clean and to use them only for the purposes for which they have been designed and to use the toilet facilities only for the disposal of human waste."),
  sub("e", "to use all electric, heating, cooling and other systems in the Dwelling in a prudent manner."),
  sub("f", "to not willfully or negligently destroy, deface, damage, impair or remove any part of the Dwelling or permit anyone else to do so."),
  sub("g", "to avoid disturbing your neighbors’ enjoyment of their dwellings and to require other individuals in the Dwelling to do the same."),
  sub("h", "to maintain the grounds, shrubbery and trees in a neat and orderly condition."),
  sub("i", "to keep the Dwelling in good condition and pay the first $100 of any cost for each repair of the fixtures, the kitchen equipment and other appliances, unless such repair is due to a condition existing on the date of this Lease. You will pay all of such cost if the repair is required because of your misuse or neglect. If such repairs are needed to satisfy our duties under subsections (a) and (b) of Section 11, we shall pay the full costs."),
  sub("j", "not to use or allow the use of a waterbed in the Dwelling without prior written consent."),
  sub("k", "to keep no pet animals, livestock or fowl in the Dwelling without our written consent, except __________________________________________."),
  sub("l", "to provide and pay for personal liability insurance for your and our mutual benefit in an amount of not less than $__________________________ for bodily injury and property damage in or about the Dwelling. You will provide us with proof of such insurance."),
  sub("m", "to maintain and keep in operation smoke and/or fire alarm systems in the Dwelling."),
  sub("n", "not to smoke or permit smoking in the Dwelling."),

  // Section 5
  sectionTitle("5", "BROKER:"),
  sub("a", "We and you recognize as the broker(s) who arranged this Lease are ________________________________ and ________________________________."),
  sub("b", "We will pay said broker(s) a commission as agreed upon."),
  sub("c", "You agree to protect us against the claims of other brokers for a commission for this Lease where the claims are based on showing the Dwelling to you or interesting you in it. This includes paying all costs of defending any such claim, including reasonable attorneys’ fees. The provisions of this paragraph shall continue past the end of this Lease."),
  sub("d", "No broker is responsible for the management, maintenance or upkeep of the Dwelling during the term of this Lease."),

  // Section 6
  sectionTitle("6", "SUBLETTING AND ASSIGNMENT:"),
  p([run("You will not assign this Lease or sublet the whole or any part of the Dwelling without our written permission. If you assign this Lease or sublet, you shall pay any broker’s commission that may be due for the unexpired term of this Lease.")]),

  // Section 7
  sectionTitle("7", "SECURITY DEPOSIT:"),
  p([run("You agree to pay us as of the date of this Lease the Security Deposit. We shall deposit the Security Deposit in an escrow account in a financial institution. We, or any successor to our interest in the Dwelling, shall be the escrow agent for such account and will hold the Security Deposit in accordance with the provisions of § 47a-21 of the Connecticut General Statutes, as amended. If you have carried out your promises under this Lease, we shall return the Security Deposit to you within 30 days after the termination of your tenancy. We shall pay you annually, on the anniversary date of your occupancy, the minimum amount of interest on the Security Deposit as required by § 47a-21 of the Connecticut General Statutes, as amended. Such interest will be reported to the Internal Revenue Service using your Social Security number indicated below. You shall provide us with receipts for the payment of final utility charges that are your responsibility prior to the return of the Security Deposit. If you do not carry out your promises under this Lease, we may use the Security Deposit to pay the rent or to repay ourselves for any damages we have because of your broken promises. The Security Deposit shall not be used by you to pay any Monthly Rent. If we keep all or any part of your Security Deposit, we will, within the time required by law, give you a list itemizing the nature and amount of the damages we have suffered because of your broken promises.")]),

  // Section 8
  sectionTitle("8", "USE OF PREMISES:"),
  p([run("You agree that the Dwelling shall be occupied and used as a private residence for one family only by you, your immediate family members and your servants. You will not permit any activity in the Dwelling which creates an unusual risk of fire or other hazard. You will not allow the Dwelling to remain vacant for more than fourteen (14) consecutive days without notifying us in advance of the planned vacancy. During any such vacancy, you agree to maintain the temperature in the Dwelling at not less than 60 degrees. You shall not be absolved of any of your obligations under this Lease during any such vacancy.")]),

  // Section 9
  sectionTitle("9", "HOLDING OVER:"),
  sub("a", "You have no right to remain in the Dwelling after this Lease ends."),
  sub("b", "Holding over by you does not renew this Lease without our written consent."),
  sub("c", "If you remain in the Dwelling without our written consent past the term of this Lease, we may, at our option, (i) elect to treat you as one who has not removed at the end of the term and shall be entitled to all the remedies against you as are provided by law in that situation, or (ii) elect to construe such holding over by you as a tenancy from month to month, subject to all of the other terms and conditions in this Lease, except the Monthly Rent which shall be two times the amount of the Monthly Rent during the last month of the Lease Term."),

  // Section 10
  sectionTitle("10", "ALTERATIONS:"),
  p([run("Unless you receive our prior written consent")]),
  sub("a", "you may not make alterations or additions to the Dwelling,"),
  sub("b", "you may not drive nails in floors, walls or ceilings,"),
  sub("c", "you may not paint or wallpaper any portion of the Dwelling,"),
  sub("d", "you may not change the locks or add any locks to the Dwelling doors,"),
  sub("e", "you may not remove any smoke or fire detectors or security systems or make them inoperable."),

  // Section 11
  sectionTitle("11", "OUR DUTIES:"),
  sub("a", "We agree to comply with all building and housing codes dealing with health and safety with respect to the Dwelling."),
  sub("b", "We agree to make all repairs and do whatever is needed to put and keep the Dwelling in a fit and livable condition. If the Dwelling is made unfit or unlivable by you, a member of your family, or any person in the Dwelling, you have the duty to make repairs. If you do not make these repairs, we can make them at your expense."),
  sub("c", "We agree to keep all common areas, if any, clean and safe."),
  sub("d", "Except as otherwise provided, we agree to keep in good condition all electric, plumbing, sanitary, heating and other systems and elevators, if any, supplied by us, normal wear and tear arising from reasonable use excepted."),

  // Section 12
  sectionTitle("12", "TENANT’S DEFAULT:"),
  p([run("We may end this Lease and take possession of the Dwelling if any of the following occurs")]),
  sub("a", "we do not receive your Monthly Rent by the due date or within the period stated in § 47a-15a of the Connecticut General Statutes. We do not need to notify you that the Rent is due."),
  sub("b", "you fail to keep any of the promises you have made in this Lease."),
  sub("c", "you move out of the Dwelling before the end of the Lease Term."),

  // Section 13
  sectionTitle("13", "LANDLORD’S RIGHTS FOR TENANT’S BROKEN PROMISES:"),
  p([run("If you break any of your promises in this Lease")]),
  sub("a", "we may end this Lease and make you vacate the Dwelling, and"),
  sub("b", "to the extent permitted by applicable law, you waive all right to notice to quit (move out), and"),
  sub("c", "you will pay us all lost rent and other damages or costs we may incur because of your broken promises. These costs may include the expenses of a lawyer, if we hire one, to the extent permitted by law. They may also include the costs of retaking possession of the Dwelling and, if necessary, the costs of redecorating or making repairs. If you break any of your promises, but we take no action because of it, it does not mean that we may not take action later if you break the same, or another, promise. If we have to serve you with a notice to quit possession of the Dwelling during or after the term of this Lease, you will pay us damages in an amount equivalent to the per diem Monthly Rent for each day after you vacate that we are unable to re-rent the Dwelling up to 60 days or until this Lease would otherwise have expired, whichever comes later. You will pay us interest at the rate of 1½% per month on any amount (other than as otherwise expressly provided in this Lease) which is unpaid 30 days after we notify you of the amount."),

  // Section 14
  sectionTitle("14", "SALE BY LANDLORD:"),
  p([run("If we sell the Building, we shall give the new owner your Security Deposit and any Rent you have paid us in advance. After we have done so, you will look only to the new Landlord and not to us, to enforce the Landlord’s promises under this Lease.")]),

  // Section 15
  sectionTitle("15", "INSPECTION OF DWELLING:"),
  sub("a", "You shall not unreasonably withhold consent to our entering the Dwelling."),
  sub("b", "We or our agents may, with your consent, enter the Dwelling to do any of the following (i) inspect it (ii) make necessary or agreed repairs and alterations (iii) supply agreed to services and (iv) show it to prospective or actual tenants, buyers, workmen, appraisers or mortgage lenders."),
  sub("c", "We may enter the Dwelling without notice or your consent in case of emergency."),
  sub("d", "Within 60 days of the end of the Lease if it becomes necessary to us, you shall permit us or brokers to show the Dwelling to prospective or actual tenants, buyers, appraisers or mortgage lenders, and to place a key box upon the Dwelling for the showing of the Dwelling by brokers to prospective tenants or buyers. You agree to sign any authorization or agreement required to permit the use of a key box upon the Dwelling."),

  // Section 16
  sectionTitle("16", "FIRE OR OTHER CASUALTY:"),
  p([run("IF")]),
  new Paragraph({ children: [run("1.\tThe Dwelling is damaged by fire or other casualty, and")], indent: { left: 360 }, spacing: { after: 60 } }),
  new Paragraph({ children: [run("2.\tThe damage substantially impairs the enjoyment of the Dwelling, and")], indent: { left: 360 }, spacing: { after: 60 } }),
  new Paragraph({ children: [run("3.\tYou, a member of your family or other person in the Dwelling with your consent, did not cause the damage or destruction by negligence or willful act,")], indent: { left: 360 }, spacing: { after: 80 } }),
  p([run("THEN")]),
  sub("a", "You will not have to pay rent while the impairment continues and you may vacate the Dwelling and notify us in writing within 14 days of your intention to end this Lease, or"),
  sub("b", "If continued use is lawful, you may vacate any part of the Dwelling rendered unusable, in which case the rent shall be adjusted."),

  // Section 17
  sectionTitle("17", "FIRE SPRINKLER SYSTEM"),
  p([run("Effective October 1, 2015, Landlord hereby puts tenant on notice regarding the Dwelling being rented herein: (Both Landlord and Tenant to initial one of the following, as applicable for the Dwelling)")]),
  p([run("______ ______  This unit HAS an operating Fire Sprinkler System (as defined in Public Act No. 1515, S.B. 1502, Sec. 57).")]),
  p([run("This fire sprinkler system was last inspected on the date: ____________")]),
  p([run("This fire sprinkler system was last maintained on the date: ___________")]),
  p([run("-or-")]),
  p([run("______ ______  This Dwelling does NOT have an operating Fire Sprinkler System.")]),

  // Section 18
  sectionTitle("18", "CONDEMNATION:"),
  sub("a", "If the Dwelling is wholly or partially taken or condemned, you shall have no claim to damages for such taking."),
  sub("b", "In addition (i) we may end this Lease as of the date of such taking or condemnation or (ii) if the Dwelling is left unusable as a dwelling by such taking, you may end this Lease as of the date of said taking or condemnation or (iii) if we or you do not decide to end this Lease, it shall continue as if no taking or condemnation had occurred."),

  // Section 19
  sectionTitle("19", "NOTICES:"),
  p([run("If we or you wish to give the other a notice, it shall be in writing. Our notices to you shall be delivered to the Dwelling or mailed to the Dwelling by certified mail, return receipt requested. Your notices to us shall be delivered or mailed by certified mail, return receipt requested, to the place where you last paid your Rent. You and we shall each be responsible for collecting certified mail from the post office if the mail carrier cannot deliver it.")]),

  // Section 20
  sectionTitle("20", "INDIVIDUAL LIABILITY:"),
  p([run("Each person who signs this Lease as Tenant is responsible for payment of the full Rent and will keep all the other promises included in this Lease.")]),

  // Section 21
  sectionTitle("21", "PEACEFUL POSSESSION:"),
  sub("a", "We state that we have the right to lease the Dwelling to you."),
  sub("b", "You may peaceably and quietly have, hold and enjoy the Dwelling, subject to the provisions of this Lease, as long as you meet your duties as a tenant under this Lease and all applicable law."),

  // Section 22
  sectionTitle("22", "CONDITION OF PREMISES:"),
  sub("a", "You have examined the Dwelling and accept it in its present condition."),
  sub("b", "You will not damage the Dwelling or permit damage to be done to it."),
  sub("c", "When this Lease is ended, you will leave the Dwelling vacant and in as clean and good condition as it is in now. Changes in condition due to ordinary wear and tear or acts of God are excepted. Burns, stains, holes or tears of any size or kind in the carpeting, draperies or walls, among other items, shall not be considered ordinary wear and tear."),

  // Section 23
  sectionTitle("23", "NO WAIVER:"),
  sub("a", "Our failure to insist on strict performance of any of the terms and agreements herein is not a waiver of our rights."),
  sub("b", "Our failure to insist on strict performance of any of the terms and agreements herein is not a waiver of our rights in case of any later breach of the terms herein."),
  sub("c", "If we accept overdue Monthly Rent, we waive our right to end this Lease because the Monthly Rent was overdue. Such acceptance will not waive our future rights if the Monthly Rent is late again."),

  // Section 24
  sectionTitle("24", "BANKRUPTCY:"),
  sub("a", "Your rights under this Lease shall end at our option if any of the following occur"),
  new Paragraph({ children: [run("1.\tyou are judged bankrupt, compound your debts or assign your estate for payment of debts, or")], indent: { left: 900, hanging: 360 }, spacing: { after: 60 } }),
  new Paragraph({ children: [run("2.\ta receiver of your property is appointed, or")], indent: { left: 900, hanging: 360 }, spacing: { after: 60 } }),
  new Paragraph({ children: [run("3.\tthis Lease passes to anyone other than you by operation of law, or")], indent: { left: 900, hanging: 360 }, spacing: { after: 60 } }),
  new Paragraph({ children: [run("4.\tan attachment or execution is levied against your estate and not satisfied within 72 hours.")], indent: { left: 900, hanging: 360 }, spacing: { after: 80 } }),
  sub("b", "Upon such ending of your rights, all future rent and other sums due become instantly due. Acceptance by us of any sum from a person other than you shall not be deemed to be a waiver of any of your rights under this Lease."),

  // Section 25
  sectionTitle("25", "SUBORDINATION TO MORTGAGES:"),
  p([run("This Lease shall be subject and subordinate at all times to any mortgage(s) now or at any time on the Dwelling. If we desire to place any mortgage(s) on the Dwelling, you agree to sign any instrument which may be necessary or desirable to give any such mortgage(s) priority over this Lease. Your refusal to sign such instrument entitles us to cancel this Lease.")]),

  // Section 26
  sectionTitle("26", "PERSONALTY (Personal Property):"),
  sub("a", "We also lease to you at no additional rental the personal property now located in the Dwelling and listed in the schedule, if any, attached to this Lease. Such schedule is to be part of this Lease and has been examined and approved by you and us."),
  sub("b", "You agree to lease said personal property from us."),
  sub("c", "You shall permit no damage to the personal property and keep the same in good order. You shall pay for repairs and pay for or replace any of the personal property that is damaged, broken or lost."),
  sub("d", "You shall not permit any of said personal property to be taken out of the Dwelling at any time."),
  sub("e", "At the end of the term, you shall return said personal property in as good condition as it is now, except for normal wear and tear. Burns, stains, holes or tears of any size or kind in said personal property, among other items, shall not be considered normal wear and tear."),

  // Section 27
  sectionTitle("27", "ENTIRE AGREEMENT:"),
  p([run("You and we agree that this Lease sets forth our entire agreement. Neither you nor we shall claim that the other has made any other promise or agreement unless the promise or agreement is in writing and signed by the party making the promise or agreement.")]),

  // Section 28
  sectionTitle("28", "BINDING EFFECT:"),
  p([run("The agreements in this Lease shall be binding upon and benefit us, and you, and our and your respective successors, heirs, executors, administrators, and assigns.")]),

  // Section 29
  sectionTitle("29", "OTHER PROVISIONS:"),
  p([run("(See Addendum attached, if any, which is a part of this Lease).")]),

  blankLine(),
  hrRule(),

  // Signature lines (base lease)
  new Table({
    width: { size: 10080, type: WidthType.DXA },
    columnWidths: [5040, 5040],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
    rows: [
      new TableRow({ children: [
        new TableCell({ borders: noBorders, children: [
          new Paragraph({ children: [run(" ")], spacing: { before: 480, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 1 } } }),
          p([new TextRun({ text: "Landlord", size: 18, color: "666666" })]),
        ]}),
        new TableCell({ borders: noBorders, children: [
          new Paragraph({ children: [run(" ")], spacing: { before: 480, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 1 } } }),
          p([new TextRun({ text: "Tenant", size: 18, color: "666666" })]),
        ]}),
      ]}),
      new TableRow({ children: [
        new TableCell({ borders: noBorders, children: [
          new Paragraph({ children: [run(" ")], spacing: { before: 480, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 1 } } }),
          p([new TextRun({ text: "Landlord", size: 18, color: "666666" })]),
        ]}),
        new TableCell({ borders: noBorders, children: [
          new Paragraph({ children: [run(" ")], spacing: { before: 480, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 1 } } }),
          p([new TextRun({ text: "Tenant", size: 18, color: "666666" })]),
        ]}),
      ]}),
    ],
  }),

  blankLine(),
  p([new TextRun({ text: "© Greenwich Association of REALTORS® – Revised September 2015", size: 18, italics: true })]),
  p([new TextRun({ text: "This contract is for use by GMLS participants. Use by any other party is illegal and voids the contract.", size: 16 })]),

  // ── ADDENDUM ────────────────────────────────────────────────────────────────
  new Paragraph({ children: [new PageBreak()] }),

  new Paragraph({
    children: [bold("LEASE ADDENDUM — TENANT INFORMATION", 26)],
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
  }),
  hrRule(),

  // Info table
  new Table({
    width: { size: 10080, type: WidthType.DXA },
    columnWidths: [2880, 7200],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
    rows: [
      ["Tenant(s):", tenant],
      ["Property Address:", address],
      ["Lease Start Date:", start],
      ["Lease End Date:", end],
      ["Monthly Rent:", `$${rent}`],
      ["Security Deposit:", `$${deposit}`],
      ["Date Generated:", dateStr],
    ].map(([label, value]) =>
      new TableRow({ children: [
        new TableCell({ borders: noBorders, children: [p([bold(label)])], width: { size: 2880, type: WidthType.DXA } }),
        new TableCell({ borders: noBorders, children: [p([run(value)])], width: { size: 7200, type: WidthType.DXA } }),
      ]})
    ),
  }),

  ...(notes.length ? [
    blankLine(),
    hrRule(),
    p([bold("Additional Terms & Conditions:")]),
    blankLine(),
    ...notes.map(note => new Paragraph({
      children: [run(note, 20)],
      numbering: { reference: "bullets", level: 0 },
      spacing: { after: 80 },
    })),
  ] : []),

  blankLine(),
  hrRule(),
  p([bold("SIGNATURES", 22)]),
  blankLine(),

  // Addendum signature table
  new Table({
    width: { size: 10080, type: WidthType.DXA },
    columnWidths: [5760, 4320],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
    rows: [
      ["Tenant Signature", "Date"],
      ["Tenant Signature", "Date"],
      ["Landlord Signature", "Date"],
    ].map(([sigLabel, dateLabel]) =>
      new TableRow({ children: [
        new TableCell({ borders: noBorders, width: { size: 5760, type: WidthType.DXA }, children: [
          new Paragraph({ children: [run(" ")], spacing: { before: 560, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 1 } } }),
          p([new TextRun({ text: sigLabel, size: 18, color: "666666" })]),
        ]}),
        new TableCell({ borders: noBorders, width: { size: 4320, type: WidthType.DXA }, children: [
          new Paragraph({ children: [run(" ")], spacing: { before: 560, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333", space: 1 } } }),
          p([new TextRun({ text: dateLabel, size: 18, color: "666666" })]),
        ]}),
      ]})
    ),
  }),
];

// ── Build document ────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
    }],
  },
  sections: [{
    properties: { page: PAGE },
    children: leaseBody,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(output, buf);
  console.log(`Saved: ${output}`);
});
