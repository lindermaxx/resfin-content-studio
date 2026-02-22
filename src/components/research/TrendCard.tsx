import { CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Trend } from "@/app/api/research/trends/route";

const pilarLabels: Record<Trend["pilar"], string> = {
  educacao_financeira: "Educação Financeira",
  investimentos_carteira: "Investimentos",
  organizacao_orcamento: "Orçamento",
  mentalidade_comportamento: "Mentalidade",
  noticias_comentadas: "Notícias",
  solucoes_patrimoniais: "Soluções Patrimoniais",
  bastidores: "Bastidores",
};

interface TrendCardProps {
  trend: Trend;
  selected: boolean;
  onSelect: () => void;
}

export function TrendCard({ trend, selected, onSelect }: TrendCardProps) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-xl"
    >
      <Card
        className={cn(
          "h-full transition-all cursor-pointer",
          selected
            ? "border-zinc-900 shadow-md ring-1 ring-zinc-900"
            : "hover:border-zinc-400 hover:shadow-sm"
        )}
      >
        <CardHeader className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">{trend.plataforma}</Badge>
              <Badge variant="secondary">{pilarLabels[trend.pilar]}</Badge>
            </div>
            {selected && (
              <CheckCircle className="h-5 w-5 shrink-0 text-zinc-900" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-sm font-semibold leading-snug">
              {trend.titulo}
            </CardTitle>
            <CardDescription className="text-xs italic leading-relaxed">
              &ldquo;{trend.hook}&rdquo;
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    </button>
  );
}
