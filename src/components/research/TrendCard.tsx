import { CheckCircle, BarChart2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">{trend.plataforma}</Badge>
              <Badge variant="secondary">{pilarLabels[trend.pilar]}</Badge>
            </div>
            {selected && (
              <CheckCircle className="h-5 w-5 shrink-0 text-zinc-900" />
            )}
          </div>
          <CardTitle className="text-sm font-semibold leading-snug mt-2">
            {trend.titulo}
          </CardTitle>
          <CardDescription className="text-xs italic leading-relaxed">
            &ldquo;{trend.hook}&rdquo;
          </CardDescription>
        </CardHeader>

        {(trend.justificativa || trend.dados?.length > 0) && (
          <CardContent className="pt-0 flex flex-col gap-2">
            <Separator />

            {trend.justificativa && (
              <p className="text-xs text-zinc-600 leading-relaxed">
                {trend.justificativa}
              </p>
            )}

            {trend.dados?.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <BarChart2 className="h-3 w-3 text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-500">Evidências</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {trend.dados.map((d, i) => (
                    <li key={i} className="text-xs text-zinc-500 leading-relaxed pl-2 border-l-2 border-zinc-100">
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </button>
  );
}
