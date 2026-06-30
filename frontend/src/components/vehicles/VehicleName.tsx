import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDecimal } from '@/lib/formatters';

interface VehicleNameProps {
  vehicle: { plate: string; model: string; currentKm: string | number };
  className?: string;
}

export function VehicleName({ vehicle, className }: VehicleNameProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={`cursor-default underline-offset-2 hover:underline ${className ?? ''}`}
          />
        }
      >
        {vehicle.model}
      </TooltipTrigger>
      <TooltipContent>
        <p>Placa: {vehicle.plate}</p>
        <p>KM atual: {formatDecimal(vehicle.currentKm)} km</p>
      </TooltipContent>
    </Tooltip>
  );
}
