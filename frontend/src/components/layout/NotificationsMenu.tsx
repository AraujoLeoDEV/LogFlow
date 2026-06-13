import { Bell } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { alertSeverityBadgeVariants, alertSeverityLabels, alertTypeLabels } from '@/lib/alertTypes';
import { cn } from '@/lib/utils';
import type { Alert } from '@/types/alert';

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const POLL_INTERVAL_MS = 60_000;
const MAX_VISIBLE_ALERTS = 10;

export function NotificationsMenu() {
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => (await api.get<Alert[]>('/alerts')).data,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const unreadCount = alerts.filter((alert) => alert.status !== 'LIDO').length;

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => (await api.patch<Alert>(`/alerts/${id}/read`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Não foi possível marcar o alerta como lido.'));
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 justify-center rounded-full px-1"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Alertas</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {alerts.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              Nenhum alerta no momento.
            </div>
          )}
          {alerts.slice(0, MAX_VISIBLE_ALERTS).map((alert) => (
            <DropdownMenuItem
              key={alert.id}
              className="flex flex-col items-start gap-1 py-2 whitespace-normal"
              onClick={() => {
                if (alert.status !== 'LIDO') {
                  markAsReadMutation.mutate(alert.id);
                }
              }}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {alertTypeLabels[alert.type]}
                </span>
                <Badge variant={alertSeverityBadgeVariants[alert.severity]}>
                  {alertSeverityLabels[alert.severity]}
                </Badge>
              </div>
              <p
                className={cn(
                  'text-sm',
                  alert.status === 'LIDO' ? 'text-muted-foreground' : 'font-medium',
                )}
              >
                {alert.message}
              </p>
              <span className="text-xs text-muted-foreground">
                {dateTimeFormatter.format(new Date(alert.createdAt))}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
