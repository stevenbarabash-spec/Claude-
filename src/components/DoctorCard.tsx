import Link from "next/link";
import Image from "next/image";
import { Doctor } from "@/lib/data";

export default function DoctorCard({ doctor }: { doctor: Doctor }) {
  return (
    <Link
      href={`/about/doctors/${doctor.slug}`}
      className="doctor-card group relative block aspect-[4/5] overflow-hidden bg-brand"
    >
      <Image
        src={doctor.image}
        alt={doctor.name}
        fill
        className="doctor-photo object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
      <div className="doctor-overlay absolute bottom-0 left-0 right-0 p-5 text-white">
        <p className="font-display text-2xl">{doctor.name}</p>
        <p className="text-xs tracking-wide-nav uppercase text-white/80 mt-1">
          {doctor.title}
        </p>
      </div>
    </Link>
  );
}
