import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import {
  shipmentStatusBadgeVariants,
  shipmentStatusLabels,
  shipmentStatusOptions,
  validShipmentTransitions,
} from '@/lib/shipmentTypes';
import type {
  CreateShipmentPayload,
  ShipmentQuery,
  ShipmentStatus,
  ShipmentWithRelations,
  ShipmentWithTimeline,
  UpdateShipmentStatusPayload,
} from '@/types/shipment';
import type { Driver } from '@/types/driver';
import type { Unit } from '@/types/unit';

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

const shipmentSchema = z.object({
  destinationUnitId: z.string().min(1, 'Selecione a unidade de destino.'),
  items: z
    .array(
      z.object({
        description: z.string().min(1, 'Informe a descrição.'),
        quantity: z
          .number({ message: 'Informe a quantidade.' })
          .int('A quantidade deve ser um número inteiro.')
          .min(1, 'A quantidade deve ser maior que zero.'),
      }),
    )
    .min(1, 'Informe ao menos um item.'),
  transporterId: z.string(),
  observations: z.string(),
});

type ShipmentFormValues = z.infer<typeof shipmentSchema>;

const EMPTY_VALUES: ShipmentFormValues = {
  destinationUnitId: '',
  items: [{ description: '', quantity: 1 }],
  transporterId: '',
  observations: '',
};

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

export function ShipmentsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ShipmentQuery>({});
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: async () => (await api.get<Unit[]>('/units')).data,
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => (await api.get<Driver[]>('/drivers')).data,
  });

  const { data: shipments, isLoading: isLoadingShipments } = useQuery({
    queryKey: ['shipments', 'list', filters],
    queryFn: async () =>
      (await api.get<ShipmentWithRelations[]>('/shipments', { params: filters })).data,
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
    defaultValues: EMPTY_VALUES,
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateShipmentPayload) =>
      api.post<ShipmentWithRelations>('/shipments', payload),
    onSuccess: (response) => {
      toast.success(`Envio registrado com o protocolo ${response.data.protocolNumber}.`);
      form.reset(EMPTY_VALUES);
      invalidateShipments();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível registrar o envio.'));
    },
  });

  function onSubmit(values: ShipmentFormValues) {
    createMutation.mutate({
      destinationUnitId: values.destinationUnitId,
      items: values.items,
      transporterId: values.transporterId || undefined,
      observations: values.observations || undefined,
    });
  }

  function handleFilterChange<K extends keyof ShipmentQuery>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (value || undefined) as ShipmentQuery[K] }));
  }

  const statusForm = useForm<StatusUpdateFormValues>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: EMPTY_STATUS_VALUES,
  });

  useEffect(() => {
    statusForm.reset(EMPTY_STATUS_VALUES);
  }, [selectedProtocol, statusForm]);

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

  const nextStatusOptions = selectedShipment
    ? validShipmentTransitions[selectedShipment.status]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Envios</h2>
        <p className="text-sm text-muted-foreground">
          Registre envios de itens entre unidades, com geração automática do número de protocolo e
          acompanhamento da timeline de status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar envio</CardTitle>
          <CardDescription>
            Informe a unidade de destino e os itens enviados. O número de protocolo é gerado
            automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              </div>

              <div className="flex flex-col gap-2">
                <Label>Itens</Label>
                {fields.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input {...field} placeholder="Descrição do item" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="w-28">
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              step="1"
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
                    <Button
                      type="button"
                      variant="outline"
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
                    onClick={() => append({ description: '', quantity: 1 })}
                  >
                    Adicionar item
                  </Button>
                </div>
              </div>

              <div>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Registrando...' : 'Registrar envio'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de envios</CardTitle>
          <CardDescription>
            Filtre os envios e selecione um protocolo para ver os itens e a timeline de status.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
            <div className="grid gap-1.5">
              <Label>Unidade de destino</Label>
              <Select
                value={filters.destinationUnitId ?? ''}
                onChange={(event) => handleFilterChange('destinationUnitId', event.target.value)}
              >
                <option value="">Todas</option>
                {(units ?? []).map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </Select>
            </div>
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
              {!isLoadingShipments && shipments?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    Nenhum envio encontrado.
                  </td>
                </tr>
              )}
              {shipments?.map((shipment) => (
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
        </CardContent>
      </Card>

      {selectedProtocol && (
        <Card>
          <CardHeader>
            <CardTitle>Protocolo {selectedProtocol}</CardTitle>
            <CardDescription>Itens, timeline de status e atualização do envio.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {isLoadingDetail && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {selectedShipment && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

                <div>
                  <p className="mb-2 text-sm font-medium">Itens</p>
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-2 py-2 font-medium">Descrição</th>
                        <th className="px-2 py-2 font-medium">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedShipment.items.map((item, index) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="px-2 py-2">{item.description}</td>
                          <td className="px-2 py-2">{item.quantity}</td>
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

                {nextStatusOptions.length > 0 && (
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
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
