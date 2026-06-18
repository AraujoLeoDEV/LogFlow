import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';

import { UnitFormSheet } from '@/components/units/UnitFormSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCrudResource } from '@/hooks/useCrudResource';
import type { CreateUnitPayload, Unit, UpdateUnitPayload } from '@/types/unit';

export function UnitsPage() {
  const {
    items: units,
    isLoading,
    sheetOpen,
    setSheetOpen,
    editingItem: editingUnit,
    openCreateSheet,
    openEditSheet,
    handleDelete,
    createMutation,
    updateMutation,
    isSubmitting,
  } = useCrudResource<Unit, CreateUnitPayload, UpdateUnitPayload>({
    queryKey: 'units',
    basePath: '/units',
    messages: {
      created: 'Unidade criada com sucesso.',
      updated: 'Unidade atualizada com sucesso.',
      deleted: 'Unidade inativada com sucesso.',
      createError: 'Não foi possível criar a unidade.',
      updateError: 'Não foi possível atualizar a unidade.',
      deleteError: 'Não foi possível inativar a unidade.',
    },
    confirmDelete: (unit) => `Inativar a unidade "${unit.name}"?`,
  });

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
