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
import type { CreateUnitPayload, Unit, UpdateUnitPayload } from '@/types/unit';

const schema = z.object({
  name: z.string().min(1, 'Informe o nome.'),
  address: z.string().min(1, 'Informe o endereço.'),
  active: z.boolean(),
});

type UnitFormValues = z.infer<typeof schema>;

interface UnitFormSheetProps {
  open: boolean;
  unit: Unit | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitCreate: (payload: CreateUnitPayload) => void;
  onSubmitUpdate: (id: string, payload: UpdateUnitPayload) => void;
}

const EMPTY_VALUES: UnitFormValues = {
  name: '',
  address: '',
  active: true,
};

export function UnitFormSheet({
  open,
  unit,
  isSubmitting,
  onOpenChange,
  onSubmitCreate,
  onSubmitUpdate,
}: UnitFormSheetProps) {
  const isEditing = !!unit;

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        unit ? { name: unit.name, address: unit.address, active: unit.active } : EMPTY_VALUES,
      );
    }
  }, [open, unit, form]);

  function onSubmit(values: UnitFormValues) {
    if (isEditing && unit) {
      onSubmitUpdate(unit.id, values);
    } else {
      onSubmitCreate(values);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar unidade' : 'Nova unidade'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Atualize os dados da unidade.'
              : 'Preencha os dados para cadastrar uma nova unidade.'}
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
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                      Unidade ativa
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
