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
import type { FinishTripPayload, TripWithRelations } from '@/types/trip';

const schema = z.object({
  endKm: z
    .number({ message: 'Informe o KM de devolução.' })
    .min(0, 'O KM de devolução não pode ser negativo.'),
});

type FinishFormValues = z.infer<typeof schema>;

interface FinishTripSheetProps {
  open: boolean;
  trip: TripWithRelations | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, payload: FinishTripPayload) => void;
}

export function FinishTripSheet({
  open,
  trip,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: FinishTripSheetProps) {
  const form = useForm<FinishFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { endKm: 0 },
  });

  useEffect(() => {
    if (open) {
      form.reset({ endKm: trip ? Number(trip.startKm) : 0 });
    }
  }, [open, trip, form]);

  function handleSubmit(values: FinishFormValues) {
    if (!trip) return;
    onSubmit(trip.id, { endKm: values.endKm });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar viagem</DialogTitle>
          <DialogDescription>
            {trip
              ? `Veículo ${trip.vehicle.plate} · Motorista ${trip.driver.name} · Destino ${trip.destination}`
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
                  <FormLabel>KM de devolução</FormLabel>
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
            <DialogFooter className="mt-auto px-0">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Encerrar viagem'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
