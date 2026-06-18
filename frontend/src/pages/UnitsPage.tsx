import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { UnitFormSheet } from '@/components/units/UnitFormSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { CreateUnitPayload, Unit, UpdateUnitPayload } from '@/types/unit';

export function UnitsPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const { data: units, isLoading } = useQuery({
    queryKey: ['units'],
    queryFn: async () => (await api.get<Unit[]>('/units')).data,
  });

  const invalidateUnits = () => queryClient.invalidateQueries({ queryKey: ['units'] });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateUnitPayload) => api.post('/units', payload),
    onSuccess: () => {
      toast.success('Unidade criada com sucesso.');
      setSheetOpen(false);
      invalidateUnits();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível criar a unidade.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateUnitPayload }) =>
      api.patch(`/units/${id}`, payload),
    onSuccess: () => {
      toast.success('Unidade atualizada com sucesso.');
      setSheetOpen(false);
      invalidateUnits();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar a unidade.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/units/${id}`),
    onSuccess: () => {
      toast.success('Unidade inativada com sucesso.');
      invalidateUnits();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível inativar a unidade.'));
    },
  });

  function openCreateSheet() {
    setEditingUnit(null);
    setSheetOpen(true);
  }

  function openEditSheet(unit: Unit) {
    setEditingUnit(unit);
    setSheetOpen(true);
  }

  function handleDelete(unit: Unit) {
    if (window.confirm(`Inativar a unidade "${unit.name}"?`)) {
      deleteMutation.mutate(unit.id);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Building2}
        title="Unidades"
        description="Gerencie as unidades cadastradas para envios e operações."
        action={
          <Button onClick={openCreateSheet}>
            <Plus />
            Nova unidade
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Endereço</th>
              <th className="px-4 py-2 font-medium">Telefone/WhatsApp</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading && units?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhuma unidade cadastrada.
                </td>
              </tr>
            )}
            {units?.map((unit) => (
              <tr key={unit.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{unit.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{unit.address}</td>
                <td className="px-4 py-2 text-muted-foreground">{unit.phone || '—'}</td>
                <td className="px-4 py-2">
                  <Badge variant={unit.active ? 'default' : 'outline'}>
                    {unit.active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEditSheet(unit)}>
                    <Pencil />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(unit)}>
                    <Trash2 />
                    <span className="sr-only">Inativar</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <UnitFormSheet
        open={sheetOpen}
        unit={editingUnit}
        isSubmitting={isSubmitting}
        onOpenChange={setSheetOpen}
        onSubmitCreate={(payload) => createMutation.mutate(payload)}
        onSubmitUpdate={(id, payload) => updateMutation.mutate({ id, payload })}
      />
    </div>
  );
}
