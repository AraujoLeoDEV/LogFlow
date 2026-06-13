import { AlertSeverity, AlertType } from '../../../generated/prisma/client';
import {
  buildDriverCnhAlerts,
  buildTripDelayedAlert,
  buildVehicleExpirationAlerts,
  buildVehicleMaintenanceAlerts,
  combineSeverity,
  severityForDays,
  severityForKm,
} from './alerts.util';

describe('severityForDays', () => {
  it('retorna null quando não há vencimento', () => {
    expect(severityForDays(null)).toBeNull();
  });

  it('retorna null quando faltam mais de 30 dias', () => {
    expect(severityForDays(31)).toBeNull();
  });

  it('retorna INFO entre 16 e 30 dias', () => {
    expect(severityForDays(30)).toBe(AlertSeverity.INFO);
    expect(severityForDays(16)).toBe(AlertSeverity.INFO);
  });

  it('retorna AVISO entre 8 e 15 dias', () => {
    expect(severityForDays(15)).toBe(AlertSeverity.AVISO);
    expect(severityForDays(8)).toBe(AlertSeverity.AVISO);
  });

  it('retorna CRITICO com 7 dias ou menos, incluindo vencido (negativo)', () => {
    expect(severityForDays(7)).toBe(AlertSeverity.CRITICO);
    expect(severityForDays(0)).toBe(AlertSeverity.CRITICO);
    expect(severityForDays(-5)).toBe(AlertSeverity.CRITICO);
  });
});

describe('severityForKm', () => {
  it('retorna null quando não há vencimento por KM', () => {
    expect(severityForKm(null)).toBeNull();
  });

  it('retorna null quando faltam mais de 1000km', () => {
    expect(severityForKm(1001)).toBeNull();
  });

  it('retorna INFO entre 501 e 1000km', () => {
    expect(severityForKm(1000)).toBe(AlertSeverity.INFO);
    expect(severityForKm(501)).toBe(AlertSeverity.INFO);
  });

  it('retorna AVISO entre 101 e 500km', () => {
    expect(severityForKm(500)).toBe(AlertSeverity.AVISO);
    expect(severityForKm(101)).toBe(AlertSeverity.AVISO);
  });

  it('retorna CRITICO com 100km ou menos, incluindo vencido (negativo)', () => {
    expect(severityForKm(100)).toBe(AlertSeverity.CRITICO);
    expect(severityForKm(0)).toBe(AlertSeverity.CRITICO);
    expect(severityForKm(-50)).toBe(AlertSeverity.CRITICO);
  });
});

describe('combineSeverity', () => {
  it('retorna null quando ambos são null', () => {
    expect(combineSeverity(null, null)).toBeNull();
  });

  it('retorna a gravidade não-nula quando a outra é null', () => {
    expect(combineSeverity(null, AlertSeverity.AVISO)).toBe(
      AlertSeverity.AVISO,
    );
    expect(combineSeverity(AlertSeverity.INFO, null)).toBe(AlertSeverity.INFO);
  });

  it('a pior gravidade prevalece', () => {
    expect(combineSeverity(AlertSeverity.INFO, AlertSeverity.AVISO)).toBe(
      AlertSeverity.AVISO,
    );
    expect(combineSeverity(AlertSeverity.CRITICO, AlertSeverity.AVISO)).toBe(
      AlertSeverity.CRITICO,
    );
    expect(combineSeverity(AlertSeverity.AVISO, AlertSeverity.AVISO)).toBe(
      AlertSeverity.AVISO,
    );
  });
});

describe('buildVehicleExpirationAlerts', () => {
  const now = new Date('2026-06-13T00:00:00.000Z');

  const baseVehicle = {
    id: 'v1',
    plate: 'ABC1D23',
    currentKm: 1000,
    licensingExpiration: null,
    insuranceExpiration: null,
    nextOilChangeKm: null,
    nextOilChangeDate: null,
    nextTireChangeKm: null,
    nextTireChangeDate: null,
    nextReviewKm: null,
    nextReviewDate: null,
  };

  it('retorna [] quando não há vencimentos cadastrados', () => {
    expect(buildVehicleExpirationAlerts(baseVehicle, now)).toEqual([]);
  });

  it('gera alerta de LICENSING dentro da janela (AVISO)', () => {
    const vehicle = {
      ...baseVehicle,
      licensingExpiration: new Date('2026-06-23T00:00:00.000Z'), // +10 dias
    };

    const alerts = buildVehicleExpirationAlerts(vehicle, now);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: AlertType.LICENSING,
      referenceType: 'VEHICLE',
      referenceId: 'v1',
      severity: AlertSeverity.AVISO,
      dueDate: vehicle.licensingExpiration,
      targetRole: 'COORDENACAO',
      targetUserId: null,
    });
    expect(alerts[0].message).toContain('ABC1D23');
    expect(alerts[0].message).toContain('vence em 10 dia(s)');
  });

  it('ignora vencimentos fora da janela de 30 dias', () => {
    const vehicle = {
      ...baseVehicle,
      insuranceExpiration: new Date('2026-07-23T00:00:00.000Z'), // +40 dias
    };

    expect(buildVehicleExpirationAlerts(vehicle, now)).toEqual([]);
  });

  it('gera alerta CRITICO com mensagem de "venceu há" para datas vencidas', () => {
    const vehicle = {
      ...baseVehicle,
      insuranceExpiration: new Date('2026-06-08T00:00:00.000Z'), // -5 dias
    };

    const alerts = buildVehicleExpirationAlerts(vehicle, now);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe(AlertType.INSURANCE);
    expect(alerts[0].severity).toBe(AlertSeverity.CRITICO);
    expect(alerts[0].message).toContain('venceu há 5 dia(s)');
  });
});

describe('buildVehicleMaintenanceAlerts', () => {
  const now = new Date('2026-06-13T00:00:00.000Z');

  const baseVehicle = {
    id: 'v1',
    plate: 'ABC1D23',
    currentKm: 9000,
    licensingExpiration: null,
    insuranceExpiration: null,
    nextOilChangeKm: null,
    nextOilChangeDate: null,
    nextTireChangeKm: null,
    nextTireChangeDate: null,
    nextReviewKm: null,
    nextReviewDate: null,
  };

  it('retorna [] quando todos os campos next* são null', () => {
    expect(buildVehicleMaintenanceAlerts(baseVehicle, now)).toEqual([]);
  });

  it('ignora item com KM definido mas sem data prevista (sem dueDate)', () => {
    const vehicle = { ...baseVehicle, nextOilChangeKm: 9050 };
    expect(buildVehicleMaintenanceAlerts(vehicle, now)).toEqual([]);
  });

  it('usa apenas a severidade por data quando o KM está fora da janela', () => {
    const vehicle = {
      ...baseVehicle,
      // vence em 5 dias (CRITICO por data)
      nextOilChangeDate: new Date('2026-06-18T00:00:00.000Z'),
      // faltam 2000km (fora da janela de 1000km)
      nextOilChangeKm: 11000,
    };

    const alerts = buildVehicleMaintenanceAlerts(vehicle, now);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: AlertType.OIL_CHANGE,
      referenceType: 'VEHICLE',
      referenceId: 'v1',
      severity: AlertSeverity.CRITICO,
      dueDate: vehicle.nextOilChangeDate,
    });
    expect(alerts[0].message).toContain('Troca de óleo');
    expect(alerts[0].message).toContain('vence em 5 dia(s)');
    expect(alerts[0].message).toContain('faltam 2000 km');
  });

  it('combina severidade por data e por KM (a pior prevalece)', () => {
    const vehicle = {
      ...baseVehicle,
      // revisão em 25 dias (INFO por data)
      nextReviewDate: new Date('2026-07-08T00:00:00.000Z'),
      // mas faltam só 50km (CRITICO por KM)
      nextReviewKm: 9050,
    };

    const alerts = buildVehicleMaintenanceAlerts(vehicle, now);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe(AlertType.REVIEW);
    expect(alerts[0].severity).toBe(AlertSeverity.CRITICO);
    expect(alerts[0].message).toContain('faltam 50 km');
  });

  it('não gera alerta quando data e KM estão fora da janela', () => {
    const vehicle = {
      ...baseVehicle,
      nextTireChangeDate: new Date('2026-08-12T00:00:00.000Z'), // +60 dias
      nextTireChangeKm: 15000, // +6000km
    };

    expect(buildVehicleMaintenanceAlerts(vehicle, now)).toEqual([]);
  });
});

describe('buildDriverCnhAlerts', () => {
  const now = new Date('2026-06-13T00:00:00.000Z');

  it('retorna [] quando o motorista não possui cnhExpiration', () => {
    expect(
      buildDriverCnhAlerts(
        { id: 'd1', name: 'Carlos Pereira', userId: null, cnhExpiration: null },
        now,
      ),
    ).toEqual([]);
  });

  it('retorna [] quando o vencimento está fora da janela de 30 dias', () => {
    expect(
      buildDriverCnhAlerts(
        {
          id: 'd1',
          name: 'Carlos Pereira',
          userId: null,
          cnhExpiration: new Date('2026-08-12T00:00:00.000Z'), // +60 dias
        },
        now,
      ),
    ).toEqual([]);
  });

  it('gera alerta CNH direcionado ao motorista vinculado', () => {
    const alerts = buildDriverCnhAlerts(
      {
        id: 'd1',
        name: 'Motorista Teste',
        userId: 'user-1',
        cnhExpiration: new Date('2026-06-18T00:00:00.000Z'), // +5 dias
      },
      now,
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: AlertType.CNH,
      referenceType: 'DRIVER',
      referenceId: 'd1',
      severity: AlertSeverity.CRITICO,
      targetRole: 'COORDENACAO',
      targetUserId: 'user-1',
    });
    expect(alerts[0].message).toContain('Motorista Teste');
  });
});

describe('buildTripDelayedAlert', () => {
  it('calcula o prazo a partir de startedAt + estimatedDurationMinutes e gera severidade CRITICO', () => {
    const trip = {
      id: 't1',
      destination: 'Filial - Zona Sul',
      startedAt: new Date('2026-06-12T08:00:00.000Z'),
      estimatedDurationMinutes: 120,
      driverName: 'Motorista Teste',
      driverUserId: 'user-1',
      vehiclePlate: 'ABC1D23',
    };

    const alert = buildTripDelayedAlert(trip);

    expect(alert).toMatchObject({
      type: AlertType.TRIP_DELAYED,
      referenceType: 'TRIP',
      referenceId: 't1',
      severity: AlertSeverity.CRITICO,
      dueDate: new Date('2026-06-12T10:00:00.000Z'),
      targetRole: 'COORDENACAO',
      targetUserId: 'user-1',
    });
    expect(alert.message).toContain('Motorista Teste');
    expect(alert.message).toContain('ABC1D23');
    expect(alert.message).toContain('Filial - Zona Sul');
    expect(alert.message).toContain('12/06/2026 10:00');
  });
});
