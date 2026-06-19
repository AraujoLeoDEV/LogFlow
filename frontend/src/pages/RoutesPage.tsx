import { Map, Pencil, Plus, Trash2 } from 'lucide-react';

import { RouteFormSheet } from '@/components/routes/RouteFormSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCrudResource } from '@/hooks/useCrudResource';
import type { CreateRoutePayload, Route, UpdateRoutePayload } from '@/types/route';

export function RoutesPage() {
  const {
    items: routes,
    isLoading,
    sheetOpen,
    setSheetOpen,
    editingItem: editingRoute,
    openCreateSheet,
    openEditSheet,
    handleDelete,
    createMutation,
    updateMutation,
    isSubmitting,
  } = useCrudResource<Route, CreateRoutePayload, UpdateRoutePayload>({
    queryKey: 'routes',
    basePath: '/routes',
    messages: {
      created: 'Rota criada com sucesso.',
      updated: 'Rota atualizada com sucesso.',
      deleted: 'Rota inativada com sucesso.',
      createError: 'Não foi possível criar a rota.',
      updateError: 'Não foi possível atualizar a rota.',
      deleteError: 'Não foi possível inativar a rota.',
    },
    confirmDelete: (route) => `Inativar a rota "${route.name}"?`,
  });

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
              <th className="px-4 py-2 font-medium">Distância (km)</th>
              <th className="px-4 py-2 font-medium">Duração (min)</th>
              <th className="px-4 py-2 font-medium">Usos</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && routes?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhuma rota cadastrada.
                </td>
              </tr>
            )}
            {routes?.map((route) => (
              <tr key={route.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{route.name}</td>
                <td className="px-4 py-2">{Number(route.estimatedDistanceKm).toFixed(1)}</td>
                <td className="px-4 py-2">{route.estimatedDurationMinutes}</td>
                <td className="px-4 py-2 font-mono tabular-nums">{route.usageCount}</td>
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
