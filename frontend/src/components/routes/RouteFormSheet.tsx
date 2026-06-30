import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
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
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CreateRoutePayload, Route, UpdateRoutePayload } from '@/types/route';

const schema = z.object({
  name: z.string().min(1, 'Informe o nome.'),
  active: z.boolean(),
  stops: z.array(z.object({ name: z.string().min(1, 'Informe o nome da parada.') })),
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
  active: true,
  stops: [],
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

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'stops' });

  useEffect(() => {
    if (open) {
      form.reset(
        route
          ? {
              name: route.name,
              active: route.active,
              stops: route.stops.map((stop) => ({ name: stop.name })),
            }
          : EMPTY_VALUES,
      );
    }
  }, [open, route, form]);

  function onSubmit(values: RouteFormValues) {
    const payload = {
      name: values.name,
      active: values.active,
      stops: values.stops,
    };

    if (isEditing && route) {
      onSubmitUpdate(route.id, payload);
    } else {
      onSubmitCreate(payload);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar rota' : 'Nova rota'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados da rota.'
              : 'Preencha os dados para cadastrar uma nova rota.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4"
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
            <div className="flex flex-col gap-2">
              <Label>Pontos de parada</Label>
              {fields.map((stop, index) => (
                <div key={stop.id} className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name={`stops.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input {...field} placeholder={`Parada ${index + 1}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="outline" onClick={() => remove(index)}>
                    Remover
                  </Button>
                </div>
              ))}
              <div>
                <Button type="button" variant="outline" onClick={() => append({ name: '' })}>
                  Adicionar parada
                </Button>
              </div>
            </div>
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
            <DialogFooter className="mt-auto px-0">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
