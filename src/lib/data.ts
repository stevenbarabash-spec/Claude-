// Central content data for the Greenwich Dental Group site.
// Replace placeholder copy/images with real content as it's provided.

export type Doctor = {
  slug: string;
  name: string;
  title: string;
  bio: string;
  image: string;
  videoUrl?: string;
  locations: ("downtown-greenwich" | "old-greenwich")[];
};

export const doctors: Doctor[] = [
  {
    slug: "dr-novak",
    name: "Dr. Novak",
    title: "General & Cosmetic Dentistry",
    bio: "Placeholder bio for Dr. Novak — replace with full biography, education, and philosophy of care.",
    image: "/images/doctors/placeholder.svg",
    locations: ["downtown-greenwich", "old-greenwich"],
  },
  {
    slug: "dr-altman",
    name: "Dr. Altman",
    title: "General & Cosmetic Dentistry",
    bio: "Placeholder bio for Dr. Altman — replace with full biography, education, and philosophy of care.",
    image: "/images/doctors/placeholder.svg",
    locations: ["downtown-greenwich", "old-greenwich"],
  },
  {
    slug: "dr-zadik",
    name: "Dr. Zadik",
    title: "General & Cosmetic Dentistry",
    bio: "Placeholder bio for Dr. Zadik — replace with full biography, education, and philosophy of care.",
    image: "/images/doctors/placeholder.svg",
    locations: ["downtown-greenwich"],
  },
  {
    slug: "dr-ieraci",
    name: "Dr. Ieraci",
    title: "General & Cosmetic Dentistry",
    bio: "Placeholder bio for Dr. Ieraci — replace with full biography, education, and philosophy of care.",
    image: "/images/doctors/placeholder.svg",
    locations: ["downtown-greenwich", "old-greenwich"],
  },
  {
    slug: "dr-downes",
    name: "Dr. Downes",
    title: "General & Cosmetic Dentistry",
    bio: "Placeholder bio for Dr. Downes — replace with full biography, education, and philosophy of care.",
    image: "/images/doctors/placeholder.svg",
    locations: ["downtown-greenwich", "old-greenwich"],
  },
  {
    slug: "dr-pogoda",
    name: "Dr. Pogoda",
    title: "General & Cosmetic Dentistry",
    bio: "Placeholder bio for Dr. Pogoda — replace with full biography, education, and philosophy of care.",
    image: "/images/doctors/placeholder.svg",
    locations: ["old-greenwich"],
  },
  {
    slug: "dr-doundoulakis",
    name: "Dr. Doundoulakis",
    title: "General & Cosmetic Dentistry",
    bio: "Placeholder bio for Dr. Doundoulakis — replace with full biography, education, and philosophy of care.",
    image: "/images/doctors/placeholder.svg",
    locations: ["old-greenwich"],
  },
];

export type Location = {
  slug: "downtown-greenwich" | "old-greenwich";
  name: string;
  addressLines: string[];
  phone: string;
  hours: { day: string; time: string }[];
  heroImage: string;
  officeEmail: string;
};

export const locations: Location[] = [
  {
    slug: "downtown-greenwich",
    name: "Downtown Greenwich",
    addressLines: ["123 Greenwich Avenue, Suite 200", "Greenwich, CT 06830"],
    phone: "(203) 555-0100",
    hours: [
      { day: "Mon – Thu", time: "8:00am – 5:00pm" },
      { day: "Fri", time: "8:00am – 2:00pm" },
      { day: "Sat – Sun", time: "Closed" },
    ],
    heroImage: "/images/locations/downtown-greenwich.svg",
    officeEmail: "downtown@greenwichdentalgroup.com",
  },
  {
    slug: "old-greenwich",
    name: "Old Greenwich",
    addressLines: ["456 Sound Beach Avenue", "Old Greenwich, CT 06870"],
    phone: "(203) 555-0200",
    hours: [
      { day: "Mon – Thu", time: "8:00am – 5:00pm" },
      { day: "Fri", time: "8:00am – 2:00pm" },
      { day: "Sat – Sun", time: "Closed" },
    ],
    heroImage: "/images/locations/old-greenwich.svg",
    officeEmail: "oldgreenwich@greenwichdentalgroup.com",
  },
];

export function doctorsForLocation(slug: Location["slug"]) {
  return doctors.filter((d) => d.locations.includes(slug));
}

export type Service = {
  name: string;
  description: string;
};

export const services: Service[] = [
  {
    name: "General Dentistry",
    description:
      "Comprehensive exams, cleanings, and preventive care to keep your smile healthy for the long term.",
  },
  {
    name: "Cosmetic Dentistry",
    description:
      "Veneers, bonding, and smile design tailored to your goals, blending artistry with precision.",
  },
  {
    name: "Dental Implants",
    description:
      "Permanent, natural-looking solutions to replace missing teeth and restore full function.",
  },
  {
    name: "Invisalign",
    description:
      "Discreet clear aligner therapy to straighten teeth without traditional braces.",
  },
  {
    name: "Teeth Whitening",
    description:
      "Professional whitening treatments for a brighter, more confident smile.",
  },
  {
    name: "Porcelain Veneers",
    description:
      "Custom-crafted veneers created with our master ceramists for a flawless, natural finish.",
  },
  {
    name: "Periodontics",
    description:
      "Gum disease prevention and treatment to protect the foundation of your smile.",
  },
  {
    name: "Root Canal Therapy",
    description:
      "Comfortable, modern endodontic care to save and restore compromised teeth.",
  },
];

export type Faq = { question: string; answer: string };

export const faqs: Faq[] = [
  {
    question: "Do you accept my insurance?",
    answer:
      "We work with most major PPO insurance plans. Please contact our office and our team will be happy to verify your benefits before your visit.",
  },
  {
    question: "What should I bring to my first appointment?",
    answer:
      "Please bring a photo ID, your insurance card (if applicable), and a list of any current medications.",
  },
  {
    question: "Is the consultation really complimentary?",
    answer:
      "Yes — your initial consultation is always complimentary. There is no cost or obligation to discuss your smile goals with our team.",
  },
  {
    question: "Do you treat dental emergencies?",
    answer:
      "Yes, we reserve time in our schedule for emergency visits. Please call the office nearest you as soon as possible.",
  },
  {
    question: "Which location should I choose?",
    answer:
      "Both our Downtown Greenwich and Old Greenwich offices offer the full range of services. Choose whichever location is most convenient for you.",
  },
];

export type Testimonial = {
  author: string;
  rating: number;
  text: string;
};

export const testimonials: Testimonial[] = [
  {
    author: "Google Review",
    rating: 5,
    text: "Placeholder testimonial — replace with real Google review content once pulled from the practice's Google Business profile.",
  },
  {
    author: "Google Review",
    rating: 5,
    text: "Placeholder testimonial — replace with real Google review content once pulled from the practice's Google Business profile.",
  },
  {
    author: "Google Review",
    rating: 5,
    text: "Placeholder testimonial — replace with real Google review content once pulled from the practice's Google Business profile.",
  },
];

export type NavLink = { label: string; href: string };
export type NavItem = { label: string; href: string; children?: NavLink[] };

export const navItems: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "About Us",
    href: "/about",
    children: [
      { label: "Doctors", href: "/about/doctors" },
      { label: "Team", href: "/about/team" },
      { label: "Our Culture", href: "/about/culture" },
      { label: "Master Ceramists", href: "/about/master-ceramists" },
    ],
  },
  { label: "Services", href: "/services" },
  {
    label: "Locations",
    href: "/locations",
    children: [
      { label: "Downtown Greenwich", href: "/locations/downtown-greenwich" },
      { label: "Old Greenwich", href: "/locations/old-greenwich" },
    ],
  },
  { label: "Gallery", href: "/gallery" },
  { label: "Testimonials", href: "/testimonials" },
  { label: "Internship", href: "/internship" },
  {
    label: "Patient Info",
    href: "/patient-info",
    children: [
      { label: "New Patient Form", href: "/patient-info/new-patient-form" },
      {
        label: "Complimentary Consultation",
        href: "/patient-info/complimentary-consultation",
      },
      { label: "FAQs", href: "/patient-info/faqs" },
    ],
  },
  { label: "Dental Technology", href: "/dental-technology" },
];
