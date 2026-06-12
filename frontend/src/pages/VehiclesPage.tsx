import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { VehicleFormSheet } from '@/components/vehicles/VehicleFormSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { fuelTypeLabels } from '@/lib/fuelTypes';
import type { Route } from '@/types/route';
import type { CreateVehiclePayload, UpdateVehiclePayload, Vehicle } from '@/types/vehicle';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function VehiclesPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/vehicles')).data,
  });

  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => (await api.get<Route[]>('/routes')).data,
  });

  const routeNameById = new Map((routes ?? []).map((route) => [route.id, route.name]));

  const invalidateVehicles = () => queryClient.invalidateQueries({ queryKey: ['vehicles'] });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateVehiclePayload) => api.post('/vehicles', payload),
    onSuccess: () => {
      toast.success('Veículo criado com sucesso.');
      setSheetOpen(false);
      invalidateVehicles();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível criar o veículo.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateVehiclePayload }) =>
      api.patch(`/vehicles/${id}`, payload),
    onSuccess: () => {
      toast.success('Veículo atualizado com sucesso.');
      setSheetOpen(false);
      invalidateVehicles();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar o veículo.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/vehicles/${id}`),
    onSuccess: () => {
      toast.success('Veículo removido com sucesso.');
      invalidateVehicles();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível remover o veículo.'));
    },
  });

  function openCreateSheet() {
    setEditingVehicle(null);
    setSheetOpen(true);
  }

  function openEditSheet(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setSheetOpen(true);
  }

  function handleDelete(vehicle: Vehicle) {
    if (window.confirm(`Remover o veículo "${vehicle.plate}"?`)) {
      deleteMutation.mutate(vehicle.id);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Veículos</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie a frota e acompanhe a depreciação mensal calculada de cada veículo.
          </p>
        </div>
        <Button onClick={openCreateSheet}>
          <Plus />
          Novo veículo
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Placa</th>
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
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && vehicles?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum veículo cadastrado.
                </td>
              </tr>
            )}
            {vehicles?.map((vehicle) => (
              <tr key={vehicle.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{vehicle.plate}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {fuelTypeLabels[vehicle.fuelType]}
                </td>
                <td className="px-4 py-2">{vehicle.yearModel}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {vehicle.mainRouteId ? (routeNameById.get(vehicle.mainRouteId) ?? '—') : '—'}
                </td>
                <td className="px-4 py-2">{Number(vehicle.currentKm).toFixed(1)}</td>
                <td className="px-4 py-2">
                  {currencyFormatter.format(vehicle.monthlyDepreciation)}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={vehicle.active ? 'default' : 'outline'}>
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
