import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service.js';

const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface TrainerExportFile {
  body: Buffer;
  filename: string;
  type: string;
}

export interface TableExport {
  filename: string;
  sheet: 'Clients' | 'Nutrition';
  headers: string[];
  rows: (string | number | null)[][];
}

type ExportClient = Prisma.UserGetPayload<{
  select: typeof clientSelect;
}>;

const clientSelect = {
  id: true,
  email: true,
  createdAt: true,
  profile: {
    select: {
      name: true,
      dateOfBirth: true,
      biologicalSexForCalculation: true,
      heightCm: true,
      activityLevel: true,
      goal: true,
      timezone: true,
    },
  },
  onboardingResponses: { select: { trainingFrequency: true } },
  nutritionProfile: { select: { activity: true, goal: true } },
  nutritionTargets: {
    where: { active: true },
    select: {
      targetCalories: true,
      proteinGrams: true,
      fatGrams: true,
      carbsGrams: true,
      calculation: {
        select: { goal: true, activity: true, frequency: true },
      },
    },
  },
  workoutProgram: {
    select: {
      assignmentSource: true,
      template: {
        select: {
          name: true,
          frequencyPerWeek: true,
          days: {
            orderBy: { dayNumber: 'asc' as const },
            select: {
              dayNumber: true,
              exercises: {
                orderBy: { order: 'asc' as const },
                select: {
                  sets: true,
                  repsMin: true,
                  repsMax: true,
                  allowsAbsAddon: true,
                  exercise: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class CoachExportService {
  constructor(private readonly prisma: PrismaService) {}

  async table(input: TableExport): Promise<TrainerExportFile> {
    const book = new ExcelJS.Workbook();
    book.creator = 'YS Fitness';
    const sheet = book.addWorksheet(input.sheet);
    sheet.addRow(input.headers.map(textCell));
    for (const row of input.rows) sheet.addRow(row.map(textCell));
    sheet.columns.forEach((column, index) => {
      column.width = Math.min(
        40,
        Math.max(12, input.headers[index]?.length ?? 12),
      );
    });
    styleHeader(sheet);
    return file(await book.xlsx.writeBuffer(), input.filename);
  }

  async clientWorkbook(
    userId: string,
    now = new Date(),
  ): Promise<TrainerExportFile> {
    const client = await this.prisma.user.findFirst({
      where: { id: userId, role: 'CLIENT' },
      select: clientSelect,
    });
    if (!client) {
      throw new NotFoundException({
        code: 'CLIENT_NOT_FOUND',
        message: 'Client not found.',
      });
    }

    const book = new ExcelJS.Workbook();
    book.creator = 'YS Fitness';
    addProfile(book, client);
    addNutrition(book, client);
    addProgram(book, client);
    const day = now.toISOString().slice(0, 10);
    return file(await book.xlsx.writeBuffer(), `ys-fitness-client-${day}.xlsx`);
  }
}

function addProfile(book: ExcelJS.Workbook, client: ExportClient) {
  const sheet = book.addWorksheet('Профіль');
  const profile = client.profile;
  sheet.columns = [
    { header: 'Поле', key: 'field', width: 22 },
    { header: 'Значення', key: 'value', width: 36 },
  ];
  sheet.addRows([
    { field: "Ім'я", value: profile?.name ?? null },
    { field: 'Пошта', value: client.email },
    { field: 'Реєстрація', value: day(client.createdAt) },
    {
      field: 'Дата народження',
      value: profile ? day(profile.dateOfBirth) : null,
    },
    { field: 'Стать', value: sexLabel(profile?.biologicalSexForCalculation) },
    { field: 'Зріст, см', value: decimal(profile?.heightCm) },
    { field: 'Активність', value: trainingActivity(profile?.activityLevel) },
    { field: 'Мета', value: trainingGoal(profile?.goal) },
    { field: 'Часовий пояс', value: profile?.timezone ?? null },
  ]);
  styleHeader(sheet);
}

function addNutrition(book: ExcelJS.Workbook, client: ExportClient) {
  const sheet = book.addWorksheet('Харчування');
  sheet.columns = [
    { header: 'Пошта', key: 'email', width: 32 },
    { header: 'Мета', key: 'goal', width: 18 },
    { header: 'Активність', key: 'activity', width: 16 },
    { header: 'Тренувань на тиждень', key: 'frequency', width: 24 },
    { header: 'Ккал', key: 'calories', width: 12 },
    { header: 'Білки', key: 'protein', width: 12 },
    { header: 'Жири', key: 'fat', width: 12 },
    { header: 'Вуглеводи', key: 'carbs', width: 14 },
  ];
  const target = client.nutritionTargets[0];
  if (target) {
    const calculation = target.calculation;
    sheet.addRow({
      email: client.email,
      goal: nutritionGoal(
        calculation?.goal ?? client.nutritionProfile?.goal ?? null,
      ),
      activity: nutritionActivity(
        calculation?.activity ?? client.nutritionProfile?.activity ?? null,
      ),
      frequency: workoutsPerWeek(client),
      calories: decimal(target.targetCalories),
      protein: decimal(target.proteinGrams),
      fat: decimal(target.fatGrams),
      carbs: decimal(target.carbsGrams),
    });
  }
  styleHeader(sheet);
}

function addProgram(book: ExcelJS.Workbook, client: ExportClient) {
  const sheet = book.addWorksheet('Програма');
  sheet.columns = [
    { header: 'Пошта', key: 'email', width: 32 },
    { header: 'Програма', key: 'program', width: 28 },
    { header: 'Призначення', key: 'assignment', width: 16 },
    { header: 'Вправа', key: 'exercise', width: 32 },
    { header: 'Підходи', key: 'sets', width: 12 },
    { header: 'Повтори від', key: 'repsMin', width: 14 },
    { header: 'Повтори до', key: 'repsMax', width: 14 },
    { header: 'Прес', key: 'abs', width: 10 },
  ];
  const program = client.workoutProgram;
  if (program) {
    const template = program.template;
    const shared = {
      email: client.email,
      program: template.name,
      assignment:
        program.assignmentSource === 'ADMIN' ? 'Закріплена' : 'Підібрана',
    };
    for (const dayRow of template.days) {
      const divider = sheet.addRow({
        ...shared,
        exercise: `День ${dayRow.dayNumber}`,
      });
      divider.font = { bold: true };
      for (const row of dayRow.exercises) {
        sheet.addRow({
          ...shared,
          exercise: row.exercise.name,
          sets: row.sets,
          repsMin: row.repsMin,
          repsMax: row.repsMax,
          abs: row.allowsAbsAddon ? 'Так' : 'Ні',
        });
      }
    }
  }
  styleHeader(sheet);
}

function workoutsPerWeek(client: ExportClient) {
  const calculated = client.nutritionTargets[0]?.calculation?.frequency;
  if (calculated != null) return calculated;
  const answered = Number(client.onboardingResponses?.trainingFrequency);
  if (Number.isInteger(answered)) return answered;
  return client.workoutProgram?.template.frequencyPerWeek ?? null;
}

function sexLabel(value: string | null | undefined) {
  if (value === 'FEMALE') return 'Жіноча';
  if (value === 'MALE') return 'Чоловіча';
  return null;
}

function trainingActivity(value: string | null | undefined) {
  const labels: Record<string, string> = {
    SEDENTARY: 'Сидяча',
    LIGHTLY_ACTIVE: 'Невисока',
    MODERATELY_ACTIVE: 'Середня',
    VERY_ACTIVE: 'Висока',
    EXTRA_ACTIVE: 'Дуже висока',
  };
  return value ? (labels[value] ?? value) : null;
}

function trainingGoal(value: string | null | undefined) {
  const labels: Record<string, string> = {
    LOSE_WEIGHT: 'Знизити вагу',
    MAINTAIN_WEIGHT: 'Утримувати вагу',
    GAIN_WEIGHT: 'Збільшити вагу',
  };
  return value ? (labels[value] ?? value) : null;
}

function nutritionActivity(value: string | null) {
  const labels: Record<string, string> = {
    SEDENTARY: 'Сидяча',
    MODERATE: 'Помірна',
    HIGH: 'Висока',
    VERY_HIGH: 'Дуже висока',
  };
  return value ? (labels[value] ?? value) : null;
}

function nutritionGoal(value: string | null) {
  const labels: Record<string, string> = {
    LOSE_WEIGHT: 'Схуднення',
    MAINTAIN: 'Підтримка',
    GAIN_MUSCLE: 'Набір',
    RECOMPOSITION: 'Рекомпозиція',
  };
  return value ? (labels[value] ?? value) : null;
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (typeof cell.value === 'string') cell.value = textCell(cell.value);
    });
  });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };
}

function textCell(value: string | number | null) {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

function decimal(value: Prisma.Decimal | null | undefined): number | null {
  return value == null ? null : value.toNumber();
}

function day(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function file(
  raw: ArrayBuffer,
  filename: string,
): Promise<TrainerExportFile> {
  return { body: Buffer.from(raw), filename, type: XLSX_TYPE };
}
