import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Map, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { RouteFormSheet } from '@/components/routes/RouteFormSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { CreateRoutePayload, Route, UpdateRoutePayload } from '@/types/route';

export function RoutesPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);

  const { data: routes, isLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => (await api.get<Route[]>('/routes')).data,
  });

  const invalidateRoutes = () => queryClient.invalidateQueries({ queryKey: ['routes'] });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateRoutePayload) => api.post('/routes', payload),
    onSuccess: () => {
      toast.success('Rota criada com sucesso.');
      setSheetOpen(false);
      invalidateRoutes();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível criar a rota.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateRoutePayload }) =>
      api.patch(`/routes/${id}`, payload),
    onSuccess: () => {
      toast.success('Rota atualizada com sucesso.');
      setSheetOpen(false);
      invalidateRoutes();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar a rota.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/routes/${id}`),
    onSuccess: () => {
      toast.success('Rota inativada com sucesso.');
      invalidateRoutes();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível inativar a rota.'));
    },
  });

  function openCreateSheet() {
    setEditingRoute(null);
    setSheetOpen(true);
  }

  function openEditSheet(route: Route) {
    setEditingRoute(route);
    setSheetOpen(true);
  }

  function handleDelete(route: Route) {
    if (window.confirm(`Inativar a rota "${route.name}"?`)) {
      deleteMutation.mutate(route.id);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Map}
        title="Rotas"
        description="Gerencie as rotas cadastradas, com distância e duração estimadas."
        action={
          <Button onClick={openCreateSheet}>
            <Plus />
            Nova rota
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Origem</th>
              <th className="px-4 py-2 font-medium">Destino</th>
              <th className="px-4 py-2 font-medium">Distância (km)</th>
              <th className="px-4 py-2 font-medium">Duração (min)</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && routes?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhuma rota cadastrada.
                </td>
              </tr>
            )}
            {routes?.map((route) => (
              <tr key={route.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{route.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{route.origin}</td>
                <td className="px-4 py-2 text-muted-foreground">{route.destination}</td>
                <td className="px-4 py-2">{Number(route.estimatedDistanceKm).toFixed(1)}</td>
                <td className="px-4 py-2">{route.estimatedDurationMinutes}</td>
                <td className="px-4 py-2">
                  <Badge variant={route.active ? 'default' : 'outline'}>
                    {route.active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEditSheet(route)}>
                    <Pencil />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(route)}>
                    <Trash2 />
                    <span className="sr-only">Inativar</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <RouteFormSheet
        open={sheetOpen}
        route={editingRoute}
        isSubmitting={isSubmitting}
        onOpenChange={setSheetOpen}
        onSubmitCreate={(payload) => createMutation.mutate(payload)}
        onSubmitUpdate={(id, payload) => updateMutation.mutate({ id, payload })}
      />
    </div>
  );
}
