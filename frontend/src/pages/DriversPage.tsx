import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { DriverFormSheet } from '@/components/drivers/DriverFormSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { CreateDriverPayload, Driver, UpdateDriverPayload } from '@/types/driver';
import type { Route } from '@/types/route';
import type { Vehicle } from '@/types/vehicle';

const dateFormatter = new Intl.DateTimeFormat('pt-BR');

export function DriversPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const { data: drivers, isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => (await api.get<Driver[]>('/drivers')).data,
  });

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/vehicles')).data,
  });

  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => (await api.get<Route[]>('/routes')).data,
  });

  const vehiclePlateById = new Map((vehicles ?? []).map((vehicle) => [vehicle.id, vehicle.plate]));
  const routeNameById = new Map((routes ?? []).map((route) => [route.id, route.name]));

  const invalidateDrivers = () => queryClient.invalidateQueries({ queryKey: ['drivers'] });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateDriverPayload) => api.post('/drivers', payload),
    onSuccess: () => {
      toast.success('Motorista criado com sucesso.');
      setSheetOpen(false);
      invalidateDrivers();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível criar o motorista.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateDriverPayload }) =>
      api.patch(`/drivers/${id}`, payload),
    onSuccess: () => {
      toast.success('Motorista atualizado com sucesso.');
      setSheetOpen(false);
      invalidateDrivers();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar o motorista.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/drivers/${id}`),
    onSuccess: () => {
      toast.success('Motorista removido com sucesso.');
      invalidateDrivers();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível remover o motorista.'));
    },
  });

  function openCreateSheet() {
    setEditingDriver(null);
    setSheetOpen(true);
  }

  function openEditSheet(driver: Driver) {
    setEditingDriver(driver);
    setSheetOpen(true);
  }

  function handleDelete(driver: Driver) {
    if (window.confirm(`Remover o motorista "${driver.name}"?`)) {
      deleteMutation.mutate(driver.id);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Motoristas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os motoristas, veículos vinculados e rotas padrão.
          </p>
        </div>
        <Button onClick={openCreateSheet}>
          <Plus />
          Novo motorista
        </Button>
      </div>

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
                  {driver.vehicleId ? (vehiclePlateById.get(driver.vehicleId) ?? '—') : '—'}
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
                  <Badge variant={driver.active ? 'default' : 'outline'}>
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
