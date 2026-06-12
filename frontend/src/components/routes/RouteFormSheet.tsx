import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { CreateRoutePayload, Route, UpdateRoutePayload } from '@/types/route';

const schema = z.object({
  name: z.string().min(1, 'Informe o nome.'),
  origin: z.string().min(1, 'Informe a origem.'),
  destination: z.string().min(1, 'Informe o destino.'),
  estimatedDistanceKm: z
    .number({ message: 'Informe a distância estimada.' })
    .positive('A distância estimada deve ser maior que zero.'),
  estimatedDurationMinutes: z
    .number({ message: 'Informe a duração estimada.' })
    .int('A duração estimada deve ser um número inteiro de minutos.')
    .positive('A duração estimada deve ser maior que zero.'),
  active: z.boolean(),
});

type RouteFormValues = z.infer<typeof schema>;

interface RouteFormSheetProps {
  open: boolean;
  route: Route | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitCreate: (payload: CreateRoutePayload) => void;
  onSubmitUpdate: (id: string, payload: UpdateRoutePayload) => void;
}

const EMPTY_VALUES: RouteFormValues = {
  name: '',
  origin: '',
  destination: '',
  estimatedDistanceKm: 0,
  estimatedDurationMinutes: 0,
  active: true,
};

export function RouteFormSheet({
  open,
  route,
  isSubmitting,
  onOpenChange,
  onSubmitCreate,
  onSubmitUpdate,
}: RouteFormSheetProps) {
  const isEditing = !!route;

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        route
          ? {
              name: route.name,
              origin: route.origin,
              destination: route.destination,
              estimatedDistanceKm: Number(route.estimatedDistanceKm),
              estimatedDurationMinutes: route.estimatedDurationMinutes,
              active: route.active,
            }
          : EMPTY_VALUES,
      );
    }
  }, [open, route, form]);

  function onSubmit(values: RouteFormValues) {
    if (isEditing && route) {
      onSubmitUpdate(route.id, values);
    } else {
      onSubmitCreate(values);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar rota' : 'Nova rota'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Atualize os dados da rota.'
              : 'Preencha os dados para cadastrar uma nova rota.'}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="origin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origem</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destino</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="estimatedDistanceKm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distância estimada (km)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="estimatedDurationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração estimada (minutos)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      {...field}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEditing && (
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                        className="size-4 rounded border-input"
                      />
                      Rota ativa
                    </label>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <SheetFooter className="mt-auto px-0">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
