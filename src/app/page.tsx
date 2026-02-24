import Link from "next/link";
import {
  CalendarDays,
  Search,
  FileText,
  CheckCircle,
  Image,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const modules = [
  {
    href: "/strategy",
    label: "Estratégia Mensal",
    icon: CalendarDays,
    description:
      "Converse com Gemini para definir diagnóstico, Big Ideas e calendário editorial do mês.",
    badge: "Passo 1",
    badgeVariant: "secondary" as const,
  },
  {
    href: "/research",
    label: "Banco de Conteúdo",
    icon: Search,
    description:
      "Salve links de referência e extraia legenda/transcrição para alimentar o processo criativo.",
    badge: "Passo 2",
    badgeVariant: "secondary" as const,
  },
  {
    href: "/copy",
    label: "Copy Studio",
    icon: FileText,
    description:
      "Gere 3 ideias de copy com a persona Leandro Ladeira e o contexto completo do @residenciaemfinancas.",
    badge: "Passo 3",
    badgeVariant: "secondary" as const,
  },
  {
    href: "/review",
    label: "Review",
    icon: CheckCircle,
    description:
      "Veja o mockup visual do post no Instagram. Edite inline, aprove ou peça nova versão.",
    badge: "Passo 4",
    badgeVariant: "secondary" as const,
  },
  {
    href: "/image",
    label: "Image Studio",
    icon: Image,
    description:
      "Gere imagens com Google Imagen a partir da copy aprovada. Selecione a melhor variação.",
    badge: "Passo 5",
    badgeVariant: "secondary" as const,
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: LayoutDashboard,
    description:
      "Kanban com todos os posts: Pending → Approved → Published. Histórico completo.",
    badge: "Passo 6",
    badgeVariant: "secondary" as const,
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8 px-8 py-10">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          ResFin Content Studio
        </h1>
        <p className="text-sm text-zinc-500">
          Crie conteúdo para o @residenciaemfinancas em 6 passos — sem terminal,
          sem colar prompts.
        </p>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link key={mod.href} href={mod.href} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 group-hover:bg-zinc-200 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant={mod.badgeVariant}>{mod.badge}</Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{mod.label}</CardTitle>
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <CardDescription className="text-xs leading-relaxed">
                      {mod.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Start flow CTA */}
      <div className="rounded-xl border border-zinc-200 bg-white px-6 py-5">
        <p className="text-sm text-zinc-600">
          <span className="font-medium text-zinc-900">Como começar:</span>{" "}
          comece por <span className="font-medium">Estratégia Mensal</span> para
          fechar Big Ideas e calendário, depois avance para{" "}
          <span className="font-medium">Banco de Conteúdo</span> e leve as
          referências para o Copy Studio.
        </p>
      </div>
    </div>
  );
}
