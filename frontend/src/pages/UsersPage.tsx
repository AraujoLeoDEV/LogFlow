import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { UserFormSheet } from '@/components/users/UserFormSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { roleLabels } from '@/lib/roles';
import type { CreateUserPayload, UpdateUserPayload, User } from '@/types/user';

export function UsersPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
  });

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateUserPayload) => api.post('/users', payload),
    onSuccess: () => {
      toast.success('Usuário criado com sucesso.');
      setSheetOpen(false);
      invalidateUsers();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível criar o usuário.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      api.patch(`/users/${id}`, payload),
    onSuccess: () => {
      toast.success('Usuário atualizado com sucesso.');
      setSheetOpen(false);
      invalidateUsers();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar o usuário.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success('Usuário removido com sucesso.');
      invalidateUsers();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível remover o usuário.'));
    },
  });

  function openCreateSheet() {
    setEditingUser(null);
    setSheetOpen(true);
  }

  function openEditSheet(user: User) {
    setEditingUser(user);
    setSheetOpen(true);
  }

  function handleDelete(user: User) {
    if (window.confirm(`Remover o usuário "${user.name}"?`)) {
      deleteMutation.mutate(user.id);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Users}
        title="Usuários"
        description="Gerencie os usuários e perfis de acesso do sistema."
        action={
          <Button onClick={openCreateSheet}>
            <Plus />
            Novo usuário
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">E-mail</th>
              <th className="px-4 py-2 font-medium">Perfil</th>
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
            {!isLoading && users?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
            {users?.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{user.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-2">
                  <Badge variant="secondary">{roleLabels[user.role]}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Badge variant={user.isActive ? 'default' : 'outline'}>
                    {user.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEditSheet(user)}>
                    <Pencil />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(user)}>
                    <Trash2 />
                    <span className="sr-only">Remover</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <UserFormSheet
        open={sheetOpen}
        user={editingUser}
        isSubmitting={isSubmitting}
        onOpenChange={setSheetOpen}
        onSubmitCreate={(payload) => createMutation.mutate(payload)}
        onSubmitUpdate={(id, payload) => updateMutation.mutate({ id, payload })}
      />
    </div>
  );
}
