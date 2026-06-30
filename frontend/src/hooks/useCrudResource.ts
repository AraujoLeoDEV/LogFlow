import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface CrudMessages {
  created: string;
  updated: string;
  deleted: string;
  createError: string;
  updateError: string;
  deleteError: string;
}

interface PermanentDeleteMessages {
  deleted: string;
  deleteError: string;
}

interface UseCrudResourceOptions<T> {
  queryKey: string;
  basePath: string;
  messages: CrudMessages;
  confirmDelete: (item: T) => string;
  // Exclusão definitiva (ADMIN) - opcional, ao lado da inativação acima.
  permanentDelete?: {
    messages: PermanentDeleteMessages;
    confirmDelete: (item: T) => string;
  };
}

// Hook compartilhado para as telas de cadastro simples (CRUD com Dialog de
// formulário + tabela): listar, criar, editar, excluir com confirmação,
// toasts de sucesso/erro e invalidação de cache - mesmo padrão repetido em
// Usuários, Unidades, Rotas, Veículos e Motoristas.
export function useCrudResource<T extends { id: string }, CreatePayload, UpdatePayload>(
  options: UseCrudResourceOptions<T>,
) {
  const { queryKey, basePath, messages, confirmDelete, permanentDelete } = options;
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await api.get<T[]>(basePath)).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });

  const createMutation = useMutation({
    mutationFn: async (payload: CreatePayload) => api.post(basePath, payload),
    onSuccess: () => {
      toast.success(messages.created);
      setSheetOpen(false);
      invalidate();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, messages.createError));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePayload }) =>
      api.patch(`${basePath}/${id}`, payload),
    onSuccess: () => {
      toast.success(messages.updated);
      setSheetOpen(false);
      invalidate();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, messages.updateError));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`${basePath}/${id}`),
    onSuccess: () => {
      toast.success(messages.deleted);
      invalidate();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, messages.deleteError));
    },
  });

  function openCreateSheet() {
    setEditingItem(null);
    setSheetOpen(true);
  }

  function openEditSheet(item: T) {
    setEditingItem(item);
    setSheetOpen(true);
  }

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`${basePath}/${id}/permanent`),
    onSuccess: () => {
      toast.success(permanentDelete?.messages.deleted ?? '');
      invalidate();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, permanentDelete?.messages.deleteError ?? ''));
    },
  });

  function handleDelete(item: T) {
    if (window.confirm(confirmDelete(item))) {
      deleteMutation.mutate(item.id);
    }
  }

  function handlePermanentDelete(item: T) {
    if (!permanentDelete) return;
    if (window.confirm(permanentDelete.confirmDelete(item))) {
      permanentDeleteMutation.mutate(item.id);
    }
  }

  return {
    items,
    isLoading,
    sheetOpen,
    setSheetOpen,
    editingItem,
    openCreateSheet,
    openEditSheet,
    handleDelete,
    handlePermanentDelete,
    createMutation,
    updateMutation,
    deleteMutation,
    permanentDeleteMutation,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
  };
}
