import { Ban, Pencil, Plus, Trash2, Users } from 'lucide-react';

import { UserFormSheet } from '@/components/users/UserFormSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useCrudResource } from '@/hooks/useCrudResource';
import { roleLabels } from '@/lib/roles';
import type { CreateUserPayload, UpdateUserPayload, User } from '@/types/user';

export function UsersPage() {
  const { hasRole, user: currentUser } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const {
    items: users,
    isLoading,
    sheetOpen,
    setSheetOpen,
    editingItem: editingUser,
    openCreateSheet,
    openEditSheet,
    handleDelete,
    handlePermanentDelete,
    createMutation,
    updateMutation,
    isSubmitting,
  } = useCrudResource<User, CreateUserPayload, UpdateUserPayload>({
    queryKey: 'users',
    basePath: '/users',
    messages: {
      created: 'Usuário criado com sucesso.',
      updated: 'Usuário atualizado com sucesso.',
      deleted: 'Usuário removido com sucesso.',
      createError: 'Não foi possível criar o usuário.',
      updateError: 'Não foi possível atualizar o usuário.',
      deleteError: 'Não foi possível remover o usuário.',
    },
    confirmDelete: (user) => `Remover o usuário "${user.name}"?`,
    permanentDelete: {
      messages: {
        deleted: 'Usuário excluído definitivamente.',
        deleteError: 'Não foi possível excluir o usuário.',
      },
      confirmDelete: (user) =>
        `Excluir DEFINITIVAMENTE o usuário "${user.name}"? Essa ação não pode ser desfeita.`,
    },
  });

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
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={user.id === currentUser?.id}
                      title={
                        user.id === currentUser?.id
                          ? 'Você não pode excluir a própria conta.'
                          : undefined
                      }
                      onClick={() => handlePermanentDelete(user)}
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
