"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Search,
  FileText,
  CheckCircle,
  Image,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const navItems = [
  {
    href: "/strategy",
    label: "Estratégia",
    icon: CalendarDays,
    description: "Big ideas do mês",
  },
  {
    href: "/research",
    label: "Banco de Conteúdo",
    icon: Search,
    description: "Referências extraídas",
  },
  {
    href: "/copy",
    label: "Copy Studio",
    icon: FileText,
    description: "Geração de copy",
  },
  {
    href: "/review",
    label: "Review",
    icon: CheckCircle,
    description: "Revisão & edição",
  },
  {
    href: "/image",
    label: "Image Studio",
    icon: Image,
    description: "Geração de imagem",
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: LayoutDashboard,
    description: "Kanban de posts",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex flex-col gap-1 px-6 py-5">
        <span className="text-sm font-semibold tracking-tight text-zinc-900">
          ResFin Content Studio
        </span>
        <span className="text-xs text-zinc-500">@residenciaemfinancas</span>
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-zinc-100 text-zinc-900 font-medium"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="flex flex-col">
                <span>{item.label}</span>
                {isActive && (
                  <span className="text-xs font-normal text-zinc-500">
                    {item.description}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
