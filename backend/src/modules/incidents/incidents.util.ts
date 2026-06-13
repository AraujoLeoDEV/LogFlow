// Base usada para expressar o índice de ocorrências por KM rodado de forma
// legível (ocorrências por 1.000 km) - seção 4.8.
export const INCIDENT_RATE_PER_KM = 1000;

// Índice ocorrências/KM rodado - seção 4.8. Retorna null quando não há KM
// rodado no período (evita divisão por zero).
export function calculateIncidentRate(
  incidentCount: number,
  kmDriven: number,
): number | null {
  if (kmDriven <= 0) {
    return null;
  }

  return (incidentCount / kmDriven) * INCIDENT_RATE_PER_KM;
}
