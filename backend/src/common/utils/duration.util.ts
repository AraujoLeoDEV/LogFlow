const UNIT_TO_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());

  if (!match) {
    throw new Error(`Formato de duração inválido: "${duration}"`);
  }

  const [, value, unit] = match;
  return Number(value) * UNIT_TO_MS[unit];
}
