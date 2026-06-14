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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DailyLogWithRelations, ReturnDailyLogPayload } from '@/types/dailyLog';

const schema = z.object({
  endKm: z.number({ message: 'Informe o KM final.' }).min(0, 'O KM final não pode ser negativo.'),
  observations: z.string(),
});

type ReturnFormValues = z.infer<typeof schema>;

interface ReturnDailyLogSheetProps {
  open: boolean;
  dailyLog: DailyLogWithRelations | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, payload: ReturnDailyLogPayload) => void;
}

export function ReturnDailyLogSheet({
  open,
  dailyLog,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: ReturnDailyLogSheetProps) {
  const form = useForm<ReturnFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { endKm: 0, observations: '' },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        endKm: dailyLog ? Number(dailyLog.startKm) : 0,
        observations: '',
      });
    }
  }, [open, dailyLog, form]);

  function handleSubmit(values: ReturnFormValues) {
    if (!dailyLog) return;
    onSubmit(dailyLog.id, {
      endKm: values.endKm,
      observations: values.observations || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar retorno</DialogTitle>
          <DialogDescription>
            {dailyLog
              ? `Veículo ${dailyLog.vehicle.plate} · Motorista ${dailyLog.driver.name} · Rota ${dailyLog.route.name}`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4"
          >
            <FormField
              control={form.control}
              name="endKm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>KM final</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
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
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="mt-auto px-0">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Registrar retorno'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
