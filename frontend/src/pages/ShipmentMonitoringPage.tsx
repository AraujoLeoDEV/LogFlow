import { useQuery } from '@tanstack/react-query';
import { Siren } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  shipmentPriorityLabels,
  shipmentStatusBadgeVariants,
  shipmentStatusLabels,
} from '@/lib/shipmentTypes';
import type { ShipmentMonitoringItem, ShipmentPriority } from '@/types/shipment';

const POLL_INTERVAL_MS = 60_000;

const PRIORITY_COLUMNS: ShipmentPriority[] = ['URGENTE', 'MODERADO', 'BAIXO'];

function formatHoursWaiting(hours: number): string {
  if (hours < 1) return 'menos de 1h';
  const rounded = Math.floor(hours);
  return `${rounded}h`;
}

export function ShipmentMonitoringPage() {
  const navigate = useNavigate();

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['shipments', 'monitoring'],
    queryFn: async () => (await api.get<ShipmentMonitoringItem[]>('/shipments/monitoring')).data,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const byPriority = (priority: ShipmentPriority) =>
    shipments.filter((shipment) => shipment.priority === priority);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Siren}
        title="Monitoramento de envios"
        description="Acompanhe envios ainda não confirmados, organizados por criticidade. Envios urgentes aguardando confirmação há 24h ou mais piscam em vermelho."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {PRIORITY_COLUMNS.map((priority) => {
          const columnShipments = byPriority(priority);

          return (
            <Card key={priority}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {shipmentPriorityLabels[priority]}
                  <Badge variant="outline">{columnShipments.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
                {!isLoading && columnShipments.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum envio {shipmentPriorityLabels[priority].toLowerCase()} aguardando.
                  </p>
                )}
                {columnShipments.map((shipment) => (
                  <button
                    key={shipment.id}
                    type="button"
                    onClick={() => navigate(`/envios?envioId=${shipment.id}`)}
                    className={cn(
                      'flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors hover:bg-muted/60',
                      shipment.overdue && 'animate-blink-red border-destructive',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{shipment.protocolNumber}</span>
                      <Badge variant={shipmentStatusBadgeVariants[shipment.status]}>
                        {shipmentStatusLabels[shipment.status]}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Destino: {shipment.destinationUnit.name}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        shipment.overdue ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {shipment.overdue && <Siren className="mr-1 inline size-3.5" />}
                      Aguardando há {formatHoursWaiting(shipment.hoursWaiting)}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
