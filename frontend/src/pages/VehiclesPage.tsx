import { Ban, Pencil, Plus, Trash2, Truck } from 'lucide-react';

import { VehicleFormSheet } from '@/components/vehicles/VehicleFormSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useCrudResource } from '@/hooks/useCrudResource';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, formatDecimal } from '@/lib/formatters';
import { fuelTypeLabels } from '@/lib/fuelTypes';
import type { Route } from '@/types/route';
import type { CreateVehiclePayload, UpdateVehiclePayload, Vehicle } from '@/types/vehicle';

export function VehiclesPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const {
    items: vehicles,
    isLoading,
    sheetOpen,
    setSheetOpen,
    editingItem: editingVehicle,
    openCreateSheet,
    openEditSheet,
    handleDelete,
    handlePermanentDelete,
    createMutation,
    updateMutation,
    isSubmitting,
  } = useCrudResource<Vehicle, CreateVehiclePayload, UpdateVehiclePayload>({
    queryKey: 'vehicles',
    basePath: '/vehicles',
    messages: {
      created: 'Veículo criado com sucesso.',
      updated: 'Veículo atualizado com sucesso.',
      deleted: 'Veículo removido com sucesso.',
      createError: 'Não foi possível criar o veículo.',
      updateError: 'Não foi possível atualizar o veículo.',
      deleteError: 'Não foi possível remover o veículo.',
    },
    confirmDelete: (vehicle) => `Remover o veículo "${vehicle.plate}"?`,
    permanentDelete: {
      messages: {
        deleted: 'Veículo excluído definitivamente.',
        deleteError: 'Não foi possível excluir o veículo.',
      },
      confirmDelete: (vehicle) =>
        `Excluir DEFINITIVAMENTE o veículo "${vehicle.plate}"? Essa ação não pode ser desfeita.`,
    },
  });

  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => (await api.get<Route[]>('/routes')).data,
  });

  const routeNameById = new Map((routes ?? []).map((route) => [route.id, route.name]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Truck}
        title="Veículos"
        description="Gerencie a frota e acompanhe a depreciação mensal calculada de cada veículo."
        action={
          <Button onClick={openCreateSheet}>
            <Plus />
            Novo veículo
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Placa</th>
              <th className="px-4 py-2 font-medium">Modelo</th>
              <th className="px-4 py-2 font-medium">Combustível</th>
              <th className="px-4 py-2 font-medium">Ano/Modelo</th>
              <th className="px-4 py-2 font-medium">Rota principal</th>
              <th className="px-4 py-2 font-medium">KM atual</th>
              <th className="px-4 py-2 font-medium">Depreciação mensal</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && vehicles?.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum veículo cadastrado.
                </td>
              </tr>
            )}
            {vehicles?.map((vehicle) => (
              <tr key={vehicle.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{vehicle.plate}</td>
                <td className="px-4 py-2">{vehicle.model}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {fuelTypeLabels[vehicle.fuelType]}
                </td>
                <td className="px-4 py-2">{vehicle.yearModel}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {vehicle.mainRouteId ? (routeNameById.get(vehicle.mainRouteId) ?? '—') : '—'}
                </td>
                <td className="px-4 py-2">{formatDecimal(vehicle.currentKm)}</td>
                <td className="px-4 py-2">{formatCurrency(vehicle.monthlyDepreciation)}</td>
                <td className="px-4 py-2">
                  <Badge variant={vehicle.active ? 'success' : 'outline'}>
                    {vehicle.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEditSheet(vehicle)}>
                    <Pencil />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(vehicle)}>
                    <Trash2 />
                    <span className="sr-only">Remover</span>
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handlePermanentDelete(vehicle)}
                    >
                      <Ban />
                      <span className="sr-only">Excluir definitivamente</span>
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <VehicleFormSheet
        open={sheetOpen}
        vehicle={editingVehicle}
        isSubmitting={isSubmitting}
        onOpenChange={setSheetOpen}
        onSubmitCreate={(payload) => createMutation.mutate(payload)}
        onSubmitUpdate={(id, payload) => updateMutation.mutate({ id, payload })}
      />
    </div>
  );
}
