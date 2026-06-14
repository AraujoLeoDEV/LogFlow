import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
        <p>KM atual: {Number(vehicle.currentKm).toFixed(1)} km</p>
      </TooltipContent>
    </Tooltip>
  );
}
