import { MaintenanceCategory } from '../../../generated/prisma/client';
import {
  REVIEW_INTERVAL_MONTHS,
  TIRE_CHANGE_INTERVAL_MONTHS,
  TIRE_CHANGE_KM_MULTIPLIER,
  OIL_CHANGE_INTERVAL_MONTHS,
  addMonths,
  buildScheduleEntries,
  calculateNextMaintenance,
} from './maintenance.util';

describe('calculateNextMaintenance', () => {
  const performedDate = new Date('2026-06-13T00:00:00.000Z');
  const kmAlertOilChange = 10000;
  const kmAlertMaintenance = 5000;

  it('recalcula nextOilChangeKm/Date para TROCA_OLEO', () => {
    const result = calculateNextMaintenance({
      category: MaintenanceCategory.TROCA_OLEO,
      performedKm: 50000,
      performedDate,
      kmAlertOilChange,
      kmAlertMaintenance,
    });

    expect(result?.nextOilChangeKm).toBe(60000);
    expect(result?.nextOilChangeDate).toEqual(
      addMonths(performedDate, OIL_CHANGE_INTERVAL_MONTHS),
    );
    expect(result?.nextTireChangeKm).toBeUndefined();
    expect(result?.nextReviewKm).toBeUndefined();
  });

  it('recalcula nextTireChangeKm/Date para TROCA_PNEUS', () => {
    const result = calculateNextMaintenance({
      category: MaintenanceCategory.TROCA_PNEUS,
      performedKm: 50000,
      performedDate,
      kmAlertOilChange,
      kmAlertMaintenance,
    });

    expect(result?.nextTireChangeKm).toBe(
      50000 + kmAlertMaintenance * TIRE_CHANGE_KM_MULTIPLIER,
    );
    expect(result?.nextTireChangeDate).toEqual(
      addMonths(performedDate, TIRE_CHANGE_INTERVAL_MONTHS),
    );
  });

  it('recalcula nextReviewKm/Date para REVISAO_GERAL', () => {
    const result = calculateNextMaintenance({
      category: MaintenanceCategory.REVISAO_GERAL,
      performedKm: 50000,
      performedDate,
      kmAlertOilChange,
      kmAlertMaintenance,
    });

    expect(result?.nextReviewKm).toBe(50000 + kmAlertMaintenance);
    expect(result?.nextReviewDate).toEqual(
      addMonths(performedDate, REVIEW_INTERVAL_MONTHS),
    );
  });

  it('retorna null para OUTROS (sem campo next* associado)', () => {
    const result = calculateNextMaintenance({
      category: MaintenanceCategory.OUTROS,
      performedKm: 50000,
      performedDate,
      kmAlertOilChange,
      kmAlertMaintenance,
    });

    expect(result).toBeNull();
  });
});

describe('buildScheduleEntries', () => {
  const now = new Date('2026-06-13T00:00:00.000Z');

  it('ignora veículos sem nenhum campo next* preenchido', () => {
    const entries = buildScheduleEntries(
      [
        {
          id: 'v1',
          plate: 'AAA0000',
          model: 'Modelo A',
          currentKm: 1000,
          nextOilChangeKm: null,
          nextOilChangeDate: null,
          nextTireChangeKm: null,
          nextTireChangeDate: null,
          nextReviewKm: null,
          nextReviewDate: null,
        },
      ],
      now,
    );

    expect(entries).toHaveLength(0);
  });

  it('calcula kmRemaining e daysRemaining e ordena por proximidade', () => {
    const entries = buildScheduleEntries(
      [
        {
          id: 'v1',
          plate: 'AAA0000',
          model: 'Modelo A',
          currentKm: 9000,
          // troca de óleo a 1000km de distância
          nextOilChangeKm: 10000,
          nextOilChangeDate: null,
          nextTireChangeKm: null,
          // revisão geral em 5 dias - mais urgente que a troca de óleo
          nextTireChangeDate: null,
          nextReviewKm: null,
          nextReviewDate: new Date('2026-06-18T00:00:00.000Z'),
        },
        {
          id: 'v2',
          plate: 'BBB0000',
          model: 'Modelo B',
          currentKm: 5000,
          nextOilChangeKm: null,
          nextOilChangeDate: null,
          // troca de pneus em 30 dias
          nextTireChangeKm: null,
          nextTireChangeDate: new Date('2026-07-13T00:00:00.000Z'),
          nextReviewKm: null,
          nextReviewDate: null,
        },
      ],
      now,
    );

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      vehicleId: 'v1',
      category: 'REVISAO_GERAL',
      daysRemaining: 5,
    });
    expect(entries[1]).toMatchObject({
      vehicleId: 'v2',
      category: 'TROCA_PNEUS',
      daysRemaining: 30,
    });
    expect(entries[2]).toMatchObject({
      vehicleId: 'v1',
      category: 'TROCA_OLEO',
      kmRemaining: 1000,
    });
  });

  it('trata datas/KMs já vencidos como mais urgentes (valores negativos primeiro)', () => {
    const entries = buildScheduleEntries(
      [
        {
          id: 'v1',
          plate: 'AAA0000',
          model: 'Modelo A',
          currentKm: 11000,
          // já passou 1000km do previsto
          nextOilChangeKm: 10000,
          nextOilChangeDate: null,
          nextTireChangeKm: null,
          nextTireChangeDate: null,
          nextReviewKm: null,
          // ainda faltam 10 dias
          nextReviewDate: new Date('2026-06-23T00:00:00.000Z'),
        },
      ],
      now,
    );

    expect(entries[0]).toMatchObject({
      category: 'TROCA_OLEO',
      kmRemaining: -1000,
    });
    expect(entries[1]).toMatchObject({
      category: 'REVISAO_GERAL',
      daysRemaining: 10,
    });
  });
});
