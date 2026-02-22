import { CheckCircle, TrendingUp, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Trend } from "@/lib/research-types";

interface TrendCardProps {
  trend: Trend;
  selected: boolean;
  onSelect: () => void;
}

export function TrendCard({ trend, selected, onSelect }: TrendCardProps) {
  return (
    <div className={cn(
      "rounded-xl border transition-all",
      selected
        ? "border-zinc-900 shadow-md ring-1 ring-zinc-900"
        : "border-zinc-200 hover:border-zinc-400 hover:shadow-sm"
    )}>
      {/* Área clicável para seleção */}
      <button
        onClick={onSelect}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-t-xl"
      >
        <Card className="border-0 shadow-none rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <Badge variant="outline">{trend.plataforma}</Badge>
              {selected && <CheckCircle className="h-5 w-5 shrink-0 text-zinc-900" />}
            </div>
            <CardTitle className="text-sm font-semibold leading-snug mt-2">
              {trend.titulo}
            </CardTitle>
          </CardHeader>

          {trend.metricas?.length > 0 && (
            <CardContent className="pt-0 pb-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-500">Viralização</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {trend.metricas.map((m, i) => (
                    <li
                      key={i}
                      className="text-xs text-zinc-600 leading-relaxed pl-2 border-l-2 border-zinc-100"
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          )}
        </Card>
      </button>

      {/* Fonte — separada da área de seleção para link funcionar */}
      {trend.fonte && (
        <>
          <Separator />
          <div className="px-4 py-2.5 flex items-center justify-between gap-2 rounded-b-xl">
            <span className="text-xs text-zinc-400">{trend.fonte}</span>
            {trend.url && (
              <a
                href={trend.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                Ver fonte
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
