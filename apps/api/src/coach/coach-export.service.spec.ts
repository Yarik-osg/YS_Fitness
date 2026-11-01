import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CoachExportService } from './coach-export.service.js';

function dec(value: number) {
  return new Prisma.Decimal(value);
}

function sheetRows(sheet: ExcelJS.Worksheet) {
  const headers = (sheet.getRow(1).values as string[]).slice(1);
  const rows: Record<string, ExcelJS.CellValue>[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const record: Record<string, ExcelJS.CellValue> = {};
    headers.forEach((header, offset) => {
      record[header] = row.getCell(offset + 1).value;
    });
    rows.push(record);
  });
  return rows;
}

describe('CoachExportService', () => {
  it('writes the table it was given and keeps formula text as text', async () => {
    const service = new CoachExportService({} as PrismaService);
    const file = await service.table({
      filename: 'ys-fitness-clients-2026-01-15.xlsx',
      sheet: 'Clients',
      headers: ['Name', 'Email'],
      rows: [
        ['Olena', 'olena@example.com'],
        ['=cmd', 'quiet@example.com'],
      ],
    });
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file.body as never);

    expect(book.getWorksheet('Program')).toBeUndefined();
    expect(sheetRows(book.getWorksheet('Clients')!)).toEqual([
      { Name: 'Olena', Email: 'olena@example.com' },
      { Name: "'=cmd", Email: 'quiet@example.com' },
    ]);
  });

  it('exports one client profile, nutrition, and assigned program', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'active',
      email: 'active@example.com',
      createdAt: new Date('2024-02-01T00:00:00.000Z'),
      profile: {
        name: '=Active',
        dateOfBirth: new Date('1994-05-02T00:00:00.000Z'),
        biologicalSexForCalculation: 'FEMALE',
        heightCm: dec(170),
        activityLevel: 'MODERATELY_ACTIVE',
        goal: 'LOSE_WEIGHT',
        timezone: 'Europe/Kyiv',
      },
      nutritionProfile: { activity: 'HIGH', goal: 'MAINTAIN' },
      onboardingResponses: { trainingFrequency: '4' },
      nutritionTargets: [
        {
          source: 'MANUAL',
          targetCalories: dec(2000),
          proteinGrams: dec(140),
          fatGrams: dec(60),
          carbsGrams: dec(200),
          calculation: null,
        },
      ],
      workoutProgram: {
        assignedAt: new Date('2020-03-01T00:00:00.000Z'),
        assignmentSource: 'ADMIN',
        template: {
          name: 'Current program',
          level: 'BEGINNER',
          frequencyPerWeek: 3,
          accent: 'LEGS',
          days: [
            {
              dayNumber: 1,
              exercises: [
                {
                  order: 1,
                  sets: 4,
                  repsMin: 8,
                  repsMax: 12,
                  allowsAbsAddon: false,
                  exercise: { code: 'SQ', name: 'Присідання' },
                },
                {
                  order: 2,
                  sets: 3,
                  repsMin: 10,
                  repsMax: 12,
                  allowsAbsAddon: true,
                  exercise: { code: 'PR', name: 'Жим' },
                },
              ],
            },
            {
              dayNumber: 2,
              exercises: [
                {
                  sets: 3,
                  repsMin: 12,
                  repsMax: 15,
                  allowsAbsAddon: false,
                  exercise: { name: 'Тяга' },
                },
              ],
            },
          ],
        },
      },
    });
    const service = new CoachExportService({
      user: { findFirst },
    } as unknown as PrismaService);

    const file = await service.clientWorkbook(
      'active',
      new Date('2026-01-15T03:00:00.000Z'),
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file.body as never);

    expect(file.filename).toBe('ys-fitness-client-2026-01-15.xlsx');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'active', role: 'CLIENT' },
      }),
    );
    expect(book.getWorksheet('Training')).toBeUndefined();
    expect(book.getWorksheet('Measurements')).toBeUndefined();
    expect(sheetRows(book.getWorksheet('Профіль')!)).toEqual(
      expect.arrayContaining([
        { Поле: "Ім'я", Значення: "'=Active" },
        { Поле: 'Зріст, см', Значення: 170 },
        { Поле: 'Мета', Значення: 'Знизити вагу' },
        { Поле: 'Стать', Значення: 'Жіноча' },
      ]),
    );
    expect(sheetRows(book.getWorksheet('Харчування')!)).toEqual([
      {
        Пошта: 'active@example.com',
        Мета: 'Підтримка',
        Активність: 'Висока',
        'Тренувань на тиждень': 4,
        Ккал: 2000,
        Білки: 140,
        Жири: 60,
        Вуглеводи: 200,
      },
    ]);
    const program = sheetRows(book.getWorksheet('Програма')!);
    expect(program.map((row) => row['Вправа'])).toEqual([
      'День 1',
      'Присідання',
      'Жим',
      'День 2',
      'Тяга',
    ]);
    expect(program[0]).toMatchObject({
      Програма: 'Current program',
      Призначення: 'Закріплена',
    });
    expect(program[1]).toMatchObject({
      Вправа: 'Присідання',
      Підходи: 4,
      Прес: 'Ні',
    });
    expect(book.getWorksheet('Програма')!.getRow(2).font?.bold).toBe(true);
  });

  it('leaves nutrition and program empty when the client has neither', async () => {
    const service = new CoachExportService({
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'blank',
          email: 'blank@example.com',
          createdAt: new Date('2025-08-01T00:00:00.000Z'),
          profile: null,
          onboardingResponses: null,
          nutritionProfile: null,
          nutritionTargets: [],
          workoutProgram: null,
        }),
      },
    } as unknown as PrismaService);

    const file = await service.clientWorkbook('blank');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file.body as never);

    expect(sheetRows(book.getWorksheet('Харчування')!)).toEqual([]);
    expect(sheetRows(book.getWorksheet('Програма')!)).toEqual([]);
    expect(sheetRows(book.getWorksheet('Профіль')!)).toEqual(
      expect.arrayContaining([
        { Поле: 'Пошта', Значення: 'blank@example.com' },
        { Поле: 'Зріст, см', Значення: null },
      ]),
    );
  });

  it('rejects a user who is not a client', async () => {
    const service = new CoachExportService({
      user: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(service.clientWorkbook('admin')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
