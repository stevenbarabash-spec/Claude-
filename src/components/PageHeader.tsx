export default function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-brand text-white text-center py-20 px-6">
      <h1 className="font-display text-4xl md:text-5xl">{title}</h1>
      {subtitle && (
        <p className="mt-4 text-white/75 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
