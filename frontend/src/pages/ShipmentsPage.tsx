import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageSearch } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import {
  shipmentItemUnitLabels,
  shipmentItemUnitOptions,
  shipmentStatusBadgeVariants,
  shipmentStatusLabels,
  shipmentStatusOptions,
  validShipmentTransitions,
} from '@/lib/shipmentTypes';
import type {
  ConfirmShipmentPayload,
  CreateShipmentPayload,
  ShipmentItemUnit,
  ShipmentQuery,
  ShipmentStatus,
  ShipmentWithRelations,
  ShipmentWithTimeline,
  UpdateShipmentPayload,
  UpdateShipmentStatusPayload,
} from '@/types/shipment';
import type { Driver } from '@/types/driver';
import type { PaginatedResult } from '@/types/pagination';
import type { Unit } from '@/types/unit';

const API_URL = import.meta.env.VITE_API_URL as string;

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function todayDateOnly(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const shipmentItemSchema = z.object({
  description: z.string().min(1, 'Informe a descrição.'),
  category: z.string(),
  quantity: z
    .number({ message: 'Informe a quantidade.' })
    .min(0.01, 'A quantidade deve ser maior que zero.'),
  unit: z.string().min(1, 'Selecione a unidade.'),
  notes: z.string(),
});

const shipmentSchema = z.object({
  destinationUnitId: z.string().min(1, 'Selecione a unidade de destino.'),
  originUnitId: z.string(),
  shippedAt: z.string().min(1, 'Selecione a data do envio.'),
  items: z.array(shipmentItemSchema).min(1, 'Informe ao menos um item.'),
  transporterId: z.string(),
  observations: z.string(),
});

type ShipmentFormValues = z.infer<typeof shipmentSchema>;

const EMPTY_ITEM: ShipmentFormValues['items'][number] = {
  description: '',
  category: '',
  quantity: 1,
  unit: 'UND',
  notes: '',
};

function buildEmptyValues(): ShipmentFormValues {
  return {
    destinationUnitId: '',
    originUnitId: '',
    shippedAt: todayDateOnly(),
    items: [{ ...EMPTY_ITEM }],
    transporterId: '',
    observations: '',
  };
}

const statusUpdateSchema = z.object({
  status: z.string().min(1, 'Selecione o novo status.'),
  transporterId: z.string(),
  notes: z.string(),
});

type StatusUpdateFormValues = z.infer<typeof statusUpdateSchema>;

const EMPTY_STATUS_VALUES: StatusUpdateFormValues = {
  status: '',
  transporterId: '',
  notes: '',
};

const confirmReceiptSchema = z.object({
  notes: z.string(),
});

type ConfirmReceiptFormValues = z.infer<typeof confirmReceiptSchema>;

const EMPTY_CONFIRM_VALUES: ConfirmReceiptFormValues = {
  notes: '',
};

const editShipmentSchema = z.object({
  items: z.array(shipmentItemSchema).min(1, 'Informe ao menos um item.'),
  transporterId: z.string(),
  observations: z.string(),
});

type EditShipmentFormValues = z.infer<typeof editShipmentSchema>;

function buildWhatsappShareUrl(shipment: ShipmentWithTimeline, pdfUrl: string | null): string {
  const phone = shipment.destinationUnit.phone;
  const digits = phone?.replace(/\D/g, '') ?? '';

  let message: string;

  if (pdfUrl) {
    message =
      `📦 *Comprovante de Envio — LogFlow*\n\n` +
      `Olá! Segue o comprovante do envio destinado a *${shipment.destinationUnit.name}*.\n\n` +
      `🔖 *Protocolo:* ${shipment.protocolNumber}\n\n` +
      `📄 *Comprovante (PDF):*\n${pdfUrl}`;
  } else {
    const itemsList = shipment.items
      .map(
        (item) => `  • ${item.description} — ${item.quantity} ${shipmentItemUnitLabels[item.unit]}`,
      )
      .join('\n');

    message =
      `🚚 *Aviso de Envio — LogFlow*\n\n` +
      `Olá! Um envio foi registrado para *${shipment.destinationUnit.name}* e está a caminho.\n\n` +
      `🔖 *Protocolo:* ${shipment.protocolNumber}\n\n` +
      `📋 *Itens:*\n${itemsList}\n\n` +
      `⏳ Fique atento(a) para o recebimento!`;
  }

  // Sem telefone cadastrado na unidade, abre o WhatsApp para o usuário
  // escolher o contato manualmente.
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function ShipmentsPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN', 'COORDENACAO');
  const isConferente = hasRole('CONFERENTE');
  const canCreate = canManage || isConferente;

  const [filters, setFilters] = useState<ShipmentQuery>({});
  const [page, setPage] = useState(1);
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: async () => (await api.get<Unit[]>('/units')).data,
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => (await api.get<Driver[]>('/drivers')).data,
  });

  const { data: shipments, isLoading: isLoadingShipments } = useQuery({
    queryKey: ['shipments', 'list', filters, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResult<ShipmentWithRelations>>('/shipments', {
          params: { ...filters, page },
        })
      ).data,
  });

  const { data: selectedShipment, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['shipments', 'detail', selectedProtocol],
    queryFn: async () =>
      (await api.get<ShipmentWithTimeline>(`/shipments/${selectedProtocol}`)).data,
    enabled: !!selectedProtocol,
  });

  const invalidateShipments = () => {
    queryClient.invalidateQueries({ queryKey: ['shipments'] });
  };

  const activeUnits = (units ?? []).filter((unit) => unit.active);
  const activeDrivers = (drivers ?? []).filter((driver) => driver.active);

  const form = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: buildEmptyValues(),
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('photo', file);
      return api.post(`/shipments/${id}/upload-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Envio registrado, mas não foi possível enviar a foto.'));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateShipmentPayload) =>
      api.post<ShipmentWithRelations>('/shipments', payload),
    onSuccess: async (response) => {
      if (photoFile) {
        await uploadPhotoMutation.mutateAsync({ id: response.data.id, file: photoFile });
      }
      toast.success(`Envio registrado com o protocolo ${response.data.protocolNumber}.`);
      form.reset(buildEmptyValues());
      setPhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      setCreateDialogOpen(false);
      invalidateShipments();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível registrar o envio.'));
    },
  });

  function onSubmit(values: ShipmentFormValues) {
    if (isConferente && !photoFile) {
      toast.error('A foto é obrigatória para registrar um envio.');
      return;
    }
    createMutation.mutate({
      destinationUnitId: values.destinationUnitId,
      originUnitId: isConferente ? undefined : values.originUnitId || undefined,
      shippedAt: values.shippedAt
        ? new Date(`${values.shippedAt}T00:00:00`).toISOString()
        : undefined,
      items: values.items.map((item) => ({
        description: item.description,
        category: item.category || undefined,
        quantity: item.quantity,
        unit: item.unit as ShipmentItemUnit,
        notes: item.notes || undefined,
      })),
      transporterId: values.transporterId || undefined,
      observations: values.observations || undefined,
    });
  }

  function handleFilterChange<K extends keyof ShipmentQuery>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (value || undefined) as ShipmentQuery[K] }));
    setPage(1);
  }

  const statusForm = useForm<StatusUpdateFormValues>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: EMPTY_STATUS_VALUES,
  });

  const confirmForm = useForm<ConfirmReceiptFormValues>({
    resolver: zodResolver(confirmReceiptSchema),
    defaultValues: EMPTY_CONFIRM_VALUES,
  });

  useEffect(() => {
    statusForm.reset(EMPTY_STATUS_VALUES);
    confirmForm.reset(EMPTY_CONFIRM_VALUES);
  }, [selectedProtocol, statusForm, confirmForm]);

  const updateStatusMutation = useMutation({
    mutationFn: async (payload: { id: string; data: UpdateShipmentStatusPayload }) =>
      api.patch<ShipmentWithRelations>(`/shipments/${payload.id}/status`, payload.data),
    onSuccess: () => {
      toast.success('Status do envio atualizado.');
      statusForm.reset(EMPTY_STATUS_VALUES);
      invalidateShipments();
      queryClient.invalidateQueries({ queryKey: ['shipments', 'detail', selectedProtocol] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar o status do envio.'));
    },
  });

  function onSubmitStatus(values: StatusUpdateFormValues) {
    if (!selectedShipment) return;
    updateStatusMutation.mutate({
      id: selectedShipment.id,
      data: {
        status: values.status as ShipmentStatus,
        transporterId: values.transporterId || undefined,
        notes: values.notes || undefined,
      },
    });
  }

  const confirmReceiptMutation = useMutation({
    mutationFn: async (payload: { id: string; data: ConfirmShipmentPayload }) =>
      api.post<ShipmentWithRelations>(`/shipments/${payload.id}/confirm`, payload.data),
    onSuccess: () => {
      toast.success('Recebimento confirmado.');
      confirmForm.reset(EMPTY_CONFIRM_VALUES);
      setConfirmDialogOpen(false);
      invalidateShipments();
      queryClient.invalidateQueries({ queryKey: ['shipments', 'detail', selectedProtocol] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível confirmar o recebimento.'));
    },
  });

  function onSubmitConfirmReceipt(values: ConfirmReceiptFormValues) {
    if (!selectedShipment) return;
    confirmReceiptMutation.mutate({
      id: selectedShipment.id,
      data: { notes: values.notes || undefined },
    });
  }

  const editForm = useForm<EditShipmentFormValues>({
    resolver: zodResolver(editShipmentSchema),
    defaultValues: { items: [{ ...EMPTY_ITEM }], transporterId: '', observations: '' },
  });

  const {
    fields: editFields,
    append: editAppend,
    remove: editRemove,
  } = useFieldArray({
    control: editForm.control,
    name: 'items',
  });

  const updateShipmentMutation = useMutation({
    mutationFn: async (payload: { id: string; data: UpdateShipmentPayload }) =>
      api.patch<ShipmentWithRelations>(`/shipments/${payload.id}`, payload.data),
    onSuccess: () => {
      toast.success('Envio atualizado.');
      setEditDialogOpen(false);
      invalidateShipments();
      queryClient.invalidateQueries({ queryKey: ['shipments', 'detail', selectedProtocol] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar o envio.'));
    },
  });

  function openEditDialog() {
    if (!selectedShipment) return;
    editForm.reset({
      items: selectedShipment.items.map((item) => ({
        description: item.description,
        category: item.category ?? '',
        quantity: Number(item.quantity),
        unit: item.unit,
        notes: item.notes ?? '',
      })),
      transporterId: selectedShipment.transporterId ?? '',
      observations: selectedShipment.observations ?? '',
    });
    setEditDialogOpen(true);
  }

  function onSubmitEdit(values: EditShipmentFormValues) {
    if (!selectedShipment) return;
    updateShipmentMutation.mutate({
      id: selectedShipment.id,
      data: {
        items: values.items.map((item) => ({
          description: item.description,
          category: item.category || undefined,
          quantity: item.quantity,
          unit: item.unit as ShipmentItemUnit,
          notes: item.notes || undefined,
        })),
        transporterId: values.transporterId || undefined,
        observations: values.observations,
      },
    });
  }

  const nextStatusOptions = selectedShipment
    ? validShipmentTransitions[selectedShipment.status]
    : [];

  const pdfFile = selectedShipment?.files.find((file) => file.type === 'PDF');
  const pdfUrl = pdfFile ? `${API_URL}/shipments/files/${pdfFile.publicToken}/download` : null;
  const whatsappUrl = selectedShipment ? buildWhatsappShareUrl(selectedShipment, pdfUrl) : null;

  const canConfirmReceipt =
    selectedShipment &&
    selectedShipment.status !== 'CANCELADO' &&
    selectedShipment.status !== 'CONFIRMADO' &&
    !selectedShipment.receipt &&
    hasRole('ADMIN', 'COORDENACAO', 'CONFERENTE');

  const canEditShipment =
    !!selectedShipment && selectedShipment.status !== 'CANCELADO' && canManage;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={PackageSearch}
        title={isConferente ? 'Confirmação de recebimento' : 'Envios'}
        description={
          isConferente
            ? 'Confira e confirme o recebimento dos envios destinados à sua unidade.'
            : 'Acompanhe envios de itens entre unidades, com protocolo automático, comprovante em PDF e timeline de status.'
        }
        action={
          canCreate && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <Button type="button" onClick={() => setCreateDialogOpen(true)}>
                Novo envio
              </Button>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Registrar envio</DialogTitle>
                  <DialogDescription>
                    Informe origem, destino e os itens enviados. O número de protocolo e o status
                    inicial ("Pendente") são definidos automaticamente.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-4 pb-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {canManage && (
                        <FormField
                          control={form.control}
                          name="originUnitId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unidade de origem (opcional)</FormLabel>
                              <FormControl>
                                <Select {...field}>
                                  <option value="">Não definida</option>
                                  {activeUnits.map((unit) => (
                                    <option key={unit.id} value={unit.id}>
                                      {unit.name}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={form.control}
                        name="destinationUnitId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unidade de destino</FormLabel>
                            <FormControl>
                              <Select {...field} required>
                                <option value="">Selecione...</option>
                                {activeUnits.map((unit) => (
                                  <option key={unit.id} value={unit.id}>
                                    {unit.name}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="shippedAt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data do envio</FormLabel>
                            <FormControl>
                              <DatePicker value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="transporterId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Transportador (opcional)</FormLabel>
                            <FormControl>
                              <Select {...field}>
                                <option value="">Não definido</option>
                                {activeDrivers.map((driver) => (
                                  <option key={driver.id} value={driver.id}>
                                    {driver.name}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <Label>Status inicial</Label>
                      <p className="text-sm text-muted-foreground">
                        Pendente (definido automaticamente)
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="observations"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Observações sobre o envio" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col gap-2">
                      <Label>Itens</Label>
                      {fields.map((item, index) => (
                        <div key={item.id} className="grid items-start gap-2 sm:grid-cols-12">
                          <FormField
                            control={form.control}
                            name={`items.${index}.description`}
                            render={({ field }) => (
                              <FormItem className="sm:col-span-4">
                                <FormControl>
                                  <Input {...field} placeholder="Descrição do item" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.category`}
                            render={({ field }) => (
                              <FormItem className="sm:col-span-2">
                                <FormControl>
                                  <Input {...field} placeholder="Categoria" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem className="sm:col-span-1">
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={field.value ?? ''}
                                    onChange={(event) =>
                                      field.onChange(
                                        event.target.value === ''
                                          ? undefined
                                          : event.target.valueAsNumber,
                                      )
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.unit`}
                            render={({ field }) => (
                              <FormItem className="sm:col-span-2">
                                <FormControl>
                                  <Select {...field}>
                                    {shipmentItemUnitOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.notes`}
                            render={({ field }) => (
                              <FormItem className="sm:col-span-2">
                                <FormControl>
                                  <Input {...field} placeholder="Observação" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="sm:col-span-1"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                          >
                            Remover
                          </Button>
                        </div>
                      ))}
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => append({ ...EMPTY_ITEM })}
                        >
                          Adicionar item
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="photo-upload">
                        Foto{' '}
                        {isConferente ? <span className="text-destructive">*</span> : '(opcional)'}
                      </Label>
                      <input
                        id="photo-upload"
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        title="Foto do envio"
                        required={isConferente}
                        className="text-sm file:mr-2 file:rounded file:border file:px-2 file:py-1 file:text-xs"
                        onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                      />
                      {photoFile && (
                        <p className="text-xs text-muted-foreground">{photoFile.name}</p>
                      )}
                    </div>

                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || uploadPhotoMutation.isPending}
                      >
                        {createMutation.isPending || uploadPhotoMutation.isPending
                          ? 'Registrando...'
                          : 'Registrar envio'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{isConferente ? 'Envios da sua unidade' : 'Histórico de envios'}</CardTitle>
          <CardDescription>
            {isConferente
              ? 'Selecione um protocolo para ver os itens e confirmar o recebimento.'
              : 'Filtre os envios e selecione um protocolo para ver os itens e a timeline de status.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!isConferente && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={filters.status ?? ''}
                  onChange={(event) => handleFilterChange('status', event.target.value)}
                >
                  <option value="">Todos</option>
                  {shipmentStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              {canManage && (
                <div className="grid gap-1.5">
                  <Label>Unidade de destino</Label>
                  <Select
                    value={filters.destinationUnitId ?? ''}
                    onChange={(event) =>
                      handleFilterChange('destinationUnitId', event.target.value)
                    }
                  >
                    <option value="">Todas</option>
                    {(units ?? []).map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="grid gap-1.5">
                <Label>De</Label>
                <DatePicker
                  value={filters.from}
                  onChange={(value) => handleFilterChange('from', value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Até</Label>
                <DatePicker
                  value={filters.to}
                  onChange={(value) => handleFilterChange('to', value)}
                />
              </div>
            </div>
          )}

          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-2 py-2 font-medium">Protocolo</th>
                <th className="px-2 py-2 font-medium">Destino</th>
                <th className="px-2 py-2 font-medium">Remetente</th>
                <th className="px-2 py-2 font-medium">Transportador</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Criado em</th>
                <th className="px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {isLoadingShipments && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoadingShipments && shipments?.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    Nenhum envio encontrado.
                  </td>
                </tr>
              )}
              {shipments?.data.map((shipment) => (
                <tr key={shipment.id} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">{shipment.protocolNumber}</td>
                  <td className="px-2 py-2">{shipment.destinationUnit.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{shipment.sender.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {shipment.transporter?.name ?? '—'}
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant={shipmentStatusBadgeVariants[shipment.status]}>
                      {shipmentStatusLabels[shipment.status]}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {formatDateTime(shipment.createdAt)}
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProtocol(shipment.protocolNumber)}
                    >
                      Ver detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={shipments?.page ?? page}
            totalPages={shipments?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedProtocol}
        onOpenChange={(open) => {
          if (!open) setSelectedProtocol(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Protocolo {selectedProtocol}</DialogTitle>
            <DialogDescription>Itens, comprovante e timeline de status do envio.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
            {isLoadingDetail && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {selectedShipment && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Origem</p>
                    <p className="text-sm font-medium">
                      {selectedShipment.originUnit?.name ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Destino</p>
                    <p className="text-sm font-medium">{selectedShipment.destinationUnit.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Status atual</p>
                    <Badge variant={shipmentStatusBadgeVariants[selectedShipment.status]}>
                      {shipmentStatusLabels[selectedShipment.status]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Data do envio</p>
                    <p className="text-sm font-medium">
                      {formatDateTime(selectedShipment.shippedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Remetente</p>
                    <p className="text-sm font-medium">{selectedShipment.sender.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Transportador</p>
                    <p className="text-sm font-medium">
                      {selectedShipment.transporter?.name ?? '—'}
                    </p>
                  </div>
                </div>

                {canEditShipment && (
                  <div>
                    <Button type="button" variant="outline" size="sm" onClick={openEditDialog}>
                      Editar envio
                    </Button>
                    {selectedShipment.status === 'CONFIRMADO' && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Este envio já foi confirmado. Edições serão registradas na timeline para
                        auditoria.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <p className="mb-2 text-sm font-medium">Itens</p>
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-2 py-2 font-medium">Descrição</th>
                        <th className="px-2 py-2 font-medium">Categoria</th>
                        <th className="px-2 py-2 font-medium">Quantidade</th>
                        <th className="px-2 py-2 font-medium">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedShipment.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-2 py-2">{item.description}</td>
                          <td className="px-2 py-2 text-muted-foreground">
                            {item.category ?? '—'}
                          </td>
                          <td className="px-2 py-2">
                            {item.quantity} {shipmentItemUnitLabels[item.unit]}
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">{item.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedShipment.observations && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Observações</p>
                    <p className="text-sm">{selectedShipment.observations}</p>
                  </div>
                )}

                {(pdfUrl || whatsappUrl) && (
                  <div>
                    {pdfUrl && <p className="mb-2 text-sm font-medium">Comprovante (PDF)</p>}
                    <div className="flex flex-wrap gap-2">
                      {pdfUrl && (
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          Ver / baixar PDF
                        </a>
                      )}
                      {whatsappUrl && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          {pdfUrl ? 'Compartilhar via WhatsApp' : 'Avisar via WhatsApp'}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {selectedShipment.files.some((f) => f.type === 'PHOTO') && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Fotos do envio</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedShipment.files
                        .filter((f) => f.type === 'PHOTO')
                        .map((f) => (
                          <a
                            key={f.id}
                            href={`${API_URL}/shipments/files/${f.publicToken}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className={buttonVariants({ variant: 'outline', size: 'sm' })}
                          >
                            Ver foto
                          </a>
                        ))}
                    </div>
                  </div>
                )}

                {selectedShipment.receipt && (
                  <div>
                    <p className="mb-1 text-sm font-medium">Confirmação de recebimento</p>
                    <p className="text-sm">
                      Confirmado por{' '}
                      <span className="font-medium">
                        {selectedShipment.receipt.confirmedByUser.name}
                      </span>{' '}
                      em {formatDateTime(selectedShipment.receipt.confirmedAt)}.
                    </p>
                    {selectedShipment.receipt.notes && (
                      <p className="text-sm text-muted-foreground">
                        {selectedShipment.receipt.notes}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <p className="mb-2 text-sm font-medium">Timeline de status</p>
                  <ul className="flex flex-col gap-2">
                    {selectedShipment.statusHistory.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between border-b pb-2 text-sm last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={shipmentStatusBadgeVariants[entry.status]}>
                            {shipmentStatusLabels[entry.status]}
                          </Badge>
                          {entry.notes && (
                            <span className="text-muted-foreground">{entry.notes}</span>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {formatDateTime(entry.changedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {canManage && nextStatusOptions.length > 0 && (
                  <Form {...statusForm}>
                    <form
                      onSubmit={statusForm.handleSubmit(onSubmitStatus)}
                      className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
                    >
                      <FormField
                        control={statusForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Novo status</FormLabel>
                            <FormControl>
                              <Select {...field} required>
                                <option value="">Selecione...</option>
                                {nextStatusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {shipmentStatusLabels[status]}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={statusForm.control}
                        name="transporterId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Transportador</FormLabel>
                            <FormControl>
                              <Select {...field}>
                                <option value="">Manter atual</option>
                                {activeDrivers.map((driver) => (
                                  <option key={driver.id} value={driver.id}>
                                    {driver.name}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={statusForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Observação da timeline</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Opcional" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={updateStatusMutation.isPending}>
                        {updateStatusMutation.isPending ? 'Atualizando...' : 'Atualizar status'}
                      </Button>
                    </form>
                  </Form>
                )}

                {canConfirmReceipt && (
                  <div>
                    <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                      <Button type="button" onClick={() => setConfirmDialogOpen(true)}>
                        Confirmar recebimento
                      </Button>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirmar recebimento</DialogTitle>
                          <DialogDescription>
                            Confirme o recebimento do protocolo {selectedShipment.protocolNumber}.
                            {selectedShipment.status !== 'ENTREGUE' &&
                              ' O envio será marcado como entregue e o recebimento será confirmado.'}{' '}
                            Você pode registrar uma observação opcional.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...confirmForm}>
                          <form
                            onSubmit={confirmForm.handleSubmit(onSubmitConfirmReceipt)}
                            className="flex flex-col gap-4 px-4 pb-4"
                          >
                            <FormField
                              control={confirmForm.control}
                              name="notes"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Observação (opcional)</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Ex.: recebido sem avarias" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <DialogFooter>
                              <Button type="submit" disabled={confirmReceiptMutation.isPending}>
                                {confirmReceiptMutation.isPending
                                  ? 'Confirmando...'
                                  : 'Confirmar recebimento'}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar envio {selectedShipment?.protocolNumber}</DialogTitle>
            <DialogDescription>
              Atualize os itens, o transportador e as observações do envio.
              {selectedShipment?.status === 'CONFIRMADO' &&
                ' Como este envio já foi confirmado, a edição será registrada na timeline para auditoria.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-4 pb-4"
            >
              <FormField
                control={editForm.control}
                name="transporterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transportador</FormLabel>
                    <FormControl>
                      <Select {...field}>
                        <option value="">Não definido</option>
                        {activeDrivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="observations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Observações sobre o envio" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <Label>Itens</Label>
                {editFields.map((item, index) => (
                  <div key={item.id} className="grid items-start gap-2 sm:grid-cols-12">
                    <FormField
                      control={editForm.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-4">
                          <FormControl>
                            <Input {...field} placeholder="Descrição do item" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name={`items.${index}.category`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormControl>
                            <Input {...field} placeholder="Categoria" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-1">
                          <FormControl>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={field.value ?? ''}
                              onChange={(event) =>
                                field.onChange(
                                  event.target.value === ''
                                    ? undefined
                                    : event.target.valueAsNumber,
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name={`items.${index}.unit`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormControl>
                            <Select {...field}>
                              {shipmentItemUnitOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name={`items.${index}.notes`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormControl>
                            <Input {...field} placeholder="Observação" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:col-span-1"
                      onClick={() => editRemove(index)}
                      disabled={editFields.length === 1}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => editAppend({ ...EMPTY_ITEM })}
                  >
                    Adicionar item
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={updateShipmentMutation.isPending}>
                  {updateShipmentMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
