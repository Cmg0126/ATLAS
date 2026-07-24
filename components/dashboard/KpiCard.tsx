import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  color?: string;
}

export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "bg-orange-500",
}: Props) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-zinc-200 p-6">

      <div className="flex justify-between items-center">

        <div>

          <p className="text-sm text-zinc-500">

            {title}

          </p>

          <h2 className="text-4xl font-bold mt-2">

            {value}

          </h2>

          {subtitle && (

            <p className="text-sm text-green-600 mt-2">

              {subtitle}

            </p>

          )}

        </div>

        <div
          className={`w-14 h-14 rounded-xl ${color} flex items-center justify-center text-white`}
        >
          <Icon size={28} />
        </div>

      </div>

    </div>
  );
}