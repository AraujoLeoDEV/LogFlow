import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type {
  CreateReportPayload,
  Report,
  ReportFormat,
  ReportStatus,
  ReportType,
} from '@/types/report';
import type { Driver } from '@/types/driver';
import type { Vehicle } from '@/types/vehicle';

const reportTypeLabels: Record<ReportType, string> = {
  DAILY_USAGE: 'Uso diário da frota',
  VEHICLE_HISTORY: 'Histórico por veículo',
  DRIVER_HISTORY: 'Histórico por motorista',
  MONTHLY_COSTS: 'Custos mensais',
  FUEL: 'Abastecimentos',
  MAINTENANCE: 'Manutenções',
  INCIDENTS: 'Ocorrências',
  SAVINGS: 'Economia (comparativo mensal)',
  RANKING: 'Ranking de metas',
};

const reportFormatLabels: Record<ReportFormat, string> = {
  PDF: 'PDF',
  EXCEL: 'Excel',
  CSV: 'CSV',
};

const reportFormatExtensions: Record<ReportFormat, string> = {
  PDF: 'pdf',
  EXCEL: 'xlsx',
  CSV: 'csv',
};

const reportStatusLabels: Record<ReportStatus, string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  DONE: 'Concluído',
  ERROR: 'Erro',
};

function statusBadgeVariant(status: ReportStatus): 'secondary' | 'success' | 'destructive' {
  if (status === 'DONE') return 'success';
  if (status === 'ERROR') return 'destructive';
  return 'secondary';
}

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

const reportTypeOptions: { value: ReportType; label: string }[] = Object.entries(
  reportTypeLabels,
).map(([value, label]) => ({ value: value as ReportType, label }));

const reportFormatOptions: { value: ReportFormat; label: string }[] = Object.entries(
  reportFormatLabels,
).map(([value, label]) => ({ value: value as ReportFormat, label }));

const reportSchema = z
  .object({
    type: z.enum([
      'DAILY_USAGE',
      'VEHICLE_HISTORY',
      'DRIVER_HISTORY',
      'MONTHLY_COSTS',
      'FUEL',
      'MAINTENANCE',
      'INCIDENTS',
      'SAVINGS',
      'RANKING',
    ]),
    format: z.enum(['PDF', 'EXCEL', 'CSV']),
    from: z.string().optional(),
    to: z.string().optional(),
    vehicleId: z.string().optional(),
    driverId: z.string().optional(),
    period: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'VEHICLE_HISTORY' && !values.vehicleId) {
      ctx.addIssue({
        code: 'custom',
        path: ['vehicleId'],
        message: 'Selecione o veículo.',
      });
    }
    if (values.type === 'DRIVER_HISTORY' && !values.driverId) {
      ctx.addIssue({
        code: 'custom',
        path: ['driverId'],
        message: 'Selecione o motorista.',
      });
    }
    if (values.type === 'RANKING' && !values.period) {
      ctx.addIssue({
        code: 'custom',
        path: ['period'],
        message: 'Informe o período (AAAA-MM).',
      });
    }
  });

type ReportFormValues = z.infer<typeof reportSchema>;

const EMPTY_VALUES: ReportFormValues = {
  type: 'DAILY_USAGE',
  format: 'PDF',
  from: '',
  to: '',
  vehicleId: '',
  driverId: '',
  period: '',
};

export function ReportsPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN', 'COORDENACAO', 'FINANCEIRO');

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => (await api.get<Driver[]>('/drivers')).data,
    enabled: canManage,
  });

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/vehicles')).data,
    enabled: canManage,
  });

  const { data: reports, isLoading: isLoadingReports } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => (await api.get<Report[]>('/reports')).data,
    enabled: canManage,
    refetchInterval: (query) => {
      const hasPending = query.state.data?.some(
        (report) => report.status === 'PENDING' || report.status === 'PROCESSING',
      );
      return hasPending ? 3000 : false;
    },
  });

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: EMPTY_VALUES,
  });

  const type = form.watch('type');

  const createMutation = useMutation({
    mutationFn: async (payload: CreateReportPayload) => api.post('/reports', payload),
    onSuccess: () => {
      toast.success('Relatório solicitado. Acompanhe o status na lista abaixo.');
      form.reset({ ...EMPTY_VALUES, type, format: form.getValues('format') });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível solicitar o relatório.'));
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (report: Report) => {
      const response = await api.get(`/reports/${report.id}/download`, {
        responseType: 'blob',
      });

      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.type.toLowerCase()}-${report.id}.${reportFormatExtensions[report.format]}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível baixar o relatório.'));
    },
  });

  const activeDrivers = (drivers ?? []).filter((driver) => driver.active);
  const activeVehicles = (vehicles ?? []).filter((vehicle) => vehicle.active);

  function onSubmit(values: ReportFormValues) {
    const payload: CreateReportPayload = {
      type: values.type,
      format: values.format,
      filters: {
        from: values.from || undefined,
        to: values.to || undefined,
        vehicleId: values.vehicleId || undefined,
        driverId: values.driverId || undefined,
        period: values.period || undefined,
      },
    };

    createMutation.mutate(payload);
  }

  if (!canManage) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Central de Relatórios</h2>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Central de Relatórios</h2>
        <p className="text-sm text-muted-foreground">
          Solicite a geração de relatórios em PDF, Excel ou CSV. A geração é feita em segundo plano
          - acompanhe o status e baixe o arquivo quando estiver concluído.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerar relatório</CardTitle>
          <CardDescription>
            Escolha o tipo de relatório, os filtros desejados e o formato de exportação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de relatório</FormLabel>
                    <FormControl>
                      <Select {...field}>
                        {reportTypeOptions.map((option) => (
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
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Formato</FormLabel>
                    <FormControl>
                      <Select {...field}>
                        {reportFormatOptions.map((option) => (
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

              {(type === 'DAILY_USAGE' ||
                type === 'VEHICLE_HISTORY' ||
                type === 'DRIVER_HISTORY' ||
                type === 'MONTHLY_COSTS' ||
                type === 'FUEL' ||
                type === 'MAINTENANCE' ||
                type === 'INCIDENTS' ||
                type === 'SAVINGS') && (
                <>
                  <FormField
                    control={form.control}
                    name="from"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>De</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Até</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {type === 'VEHICLE_HISTORY' && (
                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Veículo</FormLabel>
                      <FormControl>
                        <Select {...field} required>
                          <option value="">Selecione...</option>
                          {activeVehicles.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.plate}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {type === 'DRIVER_HISTORY' && (
                <FormField
                  control={form.control}
                  name="driverId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motorista</FormLabel>
                      <FormControl>
                        <Select {...field} required>
                          <option value="">Selecione...</option>
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
              )}

              {type === 'RANKING' && (
                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Período</FormLabel>
                      <FormControl>
                        <Input type="month" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Solicitando...' : 'Gerar relatório'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relatórios gerados</CardTitle>
          <CardDescription>
            Relatórios solicitados recentemente. A lista é atualizada automaticamente enquanto há
            relatórios em processamento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-2 py-2 font-medium">Solicitado em</th>
                <th className="px-2 py-2 font-medium">Tipo</th>
                <th className="px-2 py-2 font-medium">Formato</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingReports && (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoadingReports && reports?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                    Nenhum relatório gerado ainda.
                  </td>
                </tr>
              )}
              {reports?.map((report) => (
                <tr key={report.id} className="border-b last:border-0">
                  <td className="px-2 py-2 text-muted-foreground">
                    {formatDateTime(report.createdAt)}
                  </td>
                  <td className="px-2 py-2 font-medium">{reportTypeLabels[report.type]}</td>
                  <td className="px-2 py-2">{reportFormatLabels[report.format]}</td>
                  <td className="px-2 py-2">
                    <Badge variant={statusBadgeVariant(report.status)}>
                      {reportStatusLabels[report.status]}
                    </Badge>
                    {report.status === 'ERROR' && report.errorMessage && (
                      <p className="mt-1 text-xs text-destructive">{report.errorMessage}</p>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={report.status !== 'DONE' || downloadMutation.isPending}
                      onClick={() => downloadMutation.mutate(report)}
                    >
                      Baixar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
