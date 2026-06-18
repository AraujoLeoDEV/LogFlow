import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react';

import { DriverFormSheet } from '@/components/drivers/DriverFormSheet';
import { VehicleName } from '@/components/vehicles/VehicleName';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCrudResource } from '@/hooks/useCrudResource';
import { api } from '@/lib/api';
import type { CreateDriverPayload, Driver, UpdateDriverPayload } from '@/types/driver';
import type { Route } from '@/types/route';
import type { Vehicle } from '@/types/vehicle';

const dateFormatter = new Intl.DateTimeFormat('pt-BR');

export function DriversPage() {
  const {
    items: drivers,
    isLoading,
    sheetOpen,
    setSheetOpen,
    editingItem: editingDriver,
    openCreateSheet,
    openEditSheet,
    handleDelete,
    createMutation,
    updateMutation,
    isSubmitting,
  } = useCrudResource<Driver, CreateDriverPayload, UpdateDriverPayload>({
    queryKey: 'drivers',
    basePath: '/drivers',
    messages: {
      created: 'Motorista criado com sucesso.',
      updated: 'Motorista atualizado com sucesso.',
      deleted: 'Motorista removido com sucesso.',
      createError: 'Não foi possível criar o motorista.',
      updateError: 'Não foi possível atualizar o motorista.',
      deleteError: 'Não foi possível remover o motorista.',
    },
    confirmDelete: (driver) => `Remover o motorista "${driver.name}"?`,
  });

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/vehicles')).data,
  });

  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => (await api.get<Route[]>('/routes')).data,
  });

  const vehicleById = new Map((vehicles ?? []).map((vehicle) => [vehicle.id, vehicle]));
  const routeNameById = new Map((routes ?? []).map((route) => [route.id, route.name]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={UserRound}
        title="Motoristas"
        description="Gerencie os motoristas, veículos vinculados e rotas padrão."
        action={
          <Button onClick={openCreateSheet}>
            <Plus />
            Novo motorista
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Cargo</th>
              <th className="px-4 py-2 font-medium">Veículo</th>
              <th className="px-4 py-2 font-medium">Rota padrão</th>
              <th className="px-4 py-2 font-medium">KM atual</th>
              <th className="px-4 py-2 font-medium">CNH vence em</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && drivers?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum motorista cadastrado.
                </td>
              </tr>
            )}
            {drivers?.map((driver) => (
              <tr key={driver.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{driver.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{driver.position}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {driver.vehicleId && vehicleById.get(driver.vehicleId) ? (
                    <VehicleName vehicle={vehicleById.get(driver.vehicleId)!} />
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {driver.defaultRouteId ? (routeNameById.get(driver.defaultRouteId) ?? '—') : '—'}
                </td>
                <td className="px-4 py-2">{Number(driver.currentKm).toFixed(1)}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {driver.cnhExpiration
                    ? dateFormatter.format(new Date(driver.cnhExpiration))
                    : '—'}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={driver.active ? 'success' : 'outline'}>
                    {driver.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEditSheet(driver)}>
                    <Pencil />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(driver)}>
                    <Trash2 />
                    <span className="sr-only">Remover</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <DriverFormSheet
        open={sheetOpen}
        driver={editingDriver}
        isSubmitting={isSubmitting}
        onOpenChange={setSheetOpen}
        onSubmitCreate={(payload) => createMutation.mutate(payload)}
        onSubmitUpdate={(id, payload) => updateMutation.mutate({ id, payload })}
      />
    </div>
  );
}
