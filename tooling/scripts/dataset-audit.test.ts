import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseSustainableConcreteXlsx } from '../../src/retaining-wall/sustainable-concrete/importers';
import { sustainableMixToConcreteMix } from '../../src/retaining-wall/sustainable-concrete/adapter';
import { runEngine } from '../../src/retaining-wall/engine';
import { DEFAULT_LOGISTICS, DEFAULT_WALL_INPUT } from '../../src/retaining-wall/store/useRetainingWallStore';
import { validateConcreteMix } from '../../src/retaining-wall/material-selection/mixModel';

const CORRECTED_XLSX = path.resolve('artifacts/archive/outputs/019ff77a-cfb6-7fc3-972d-7a74ef4961fb/Karışım tablosu-sıfır atık Teknofest 2026_reçete_duzeltilmis.xlsx');
const ORIGINAL_XLSX = path.resolve('artifacts/archive/outputs/019ff6df-d8cd-7140-b2c9-dc029eb91e63/Karışım tablosu-sıfır atık Teknofest 2026_duzenlenmis.xlsx');

function toArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

describe('literature dataset full-program audit', () => {
  it('parses all candidate workbooks and runs every corrected-dataset mix through the real engine', async () => {
    const originalParsed = await parseSustainableConcreteXlsx(toArrayBuffer(fs.readFileSync(ORIGINAL_XLSX)), path.basename(ORIGINAL_XLSX));
    const parsed = await parseSustainableConcreteXlsx(toArrayBuffer(fs.readFileSync(CORRECTED_XLSX)), path.basename(CORRECTED_XLSX));
    const selected = { file: CORRECTED_XLSX, parsed };
    const datasetStats = [
      {
        file: ORIGINAL_XLSX,
        directXlsxImport: 'OK',
        mixes: originalParsed.mixes.length,
        issues: originalParsed.issues.length,
      },
      {
        file: CORRECTED_XLSX,
        directXlsxImport: 'OK',
        mixes: parsed.mixes.length,
        issues: parsed.issues.length,
        errors: parsed.issues.filter((issue) => issue.severity === 'error').length,
        warnings: parsed.issues.filter((issue) => issue.severity === 'warning').length,
      },
    ];

    const issuesByRow = new Map<number, string[]>();
    for (const issue of selected.parsed.issues) {
      if (issue.row == null) continue;
      const items = issuesByRow.get(issue.row) ?? [];
      items.push(`${issue.severity.toUpperCase()}: ${issue.field ? `[${issue.field}] ` : ''}${issue.message}`);
      issuesByRow.set(issue.row, items);
    }

    const cases = selected.parsed.mixes.map((mix, index) => {
      const testId = `D-${String(index + 1).padStart(3, '0')}`;
      const startedAt = performance.now();
      try {
        const concreteMix = sustainableMixToConcreteMix(mix, undefined, DEFAULT_WALL_INPUT.concreteClass);
        const validation = validateConcreteMix(concreteMix);
        const scenario = runEngine({
          wallInput: DEFAULT_WALL_INPUT,
          logistics: DEFAULT_LOGISTICS,
          customCoefficients: new Map(),
          concreteMix,
          scenarioId: testId,
          scenarioName: `${testId} · ${mix.mixNo ?? mix.name}`,
        });

        const validationErrors = validation.filter((item) => item.severity === 'error');
        const validationWarnings = validation.filter((item) => item.severity === 'warning');
        const importIssues = issuesByRow.get(mix.sourceRow ?? -1) ?? [];
        const runtimeWarnings = [
          ...(scenario.engineeringWarnings ?? []),
          ...(scenario.mixMetrics.warnings ?? []),
          ...(scenario.stability?.warnings ?? []),
          ...(scenario.quantities?.reinforcementWarnings ?? []),
          ...(scenario.emissions?.warnings ?? []),
          ...(scenario.cost?.warnings ?? []),
        ];
        const dataComplete = Boolean(scenario.emissions?.dataComplete) && Boolean(scenario.cost?.dataComplete);
        const status = validationErrors.length > 0 ? 'VALIDATION_ERROR'
          : dataComplete ? (validationWarnings.length + importIssues.length + runtimeWarnings.length > 0 ? 'OK_WITH_WARNINGS' : 'OK')
            : 'INCOMPLETE_OUTPUT';

        return {
          testId,
          order: index + 1,
          sourceRow: mix.sourceRow ?? null,
          mixNo: mix.mixNo ?? null,
          name: mix.name,
          materialSystem: mix.materialSystem ?? null,
          literatureStudy: mix.literatureStudy ?? null,
          sourceUrl: mix.sourceUrl ?? null,
          sourceLine: mix.sourceLine ?? null,
          status,
          elapsedMs: performance.now() - startedAt,
          importIssues,
          validation,
          runtimeWarnings: [...new Set(runtimeWarnings)],
          rawValues: mix.rawValues ?? {},
          normalizedInputs: {
            cementKgM3: mix.cementKgM3,
            flyAshKgM3: mix.flyAshKgM3,
            ggbfsKgM3: mix.ggbfsKgM3,
            silicaFumeKgM3: mix.silicaFumeKgM3,
            metakaolinKgM3: mix.metakaolinKgM3,
            naturalFineAggregateKgM3: mix.naturalFineAggregateKgM3 ?? null,
            naturalCoarseAggregateKgM3: mix.naturalCoarseAggregateKgM3 ?? null,
            recycledAggregateUnspecifiedKgM3: mix.recycledAggregateUnspecifiedKgM3 ?? null,
            recycledFineAggregateKgM3: mix.recycledFineAggregateKgM3 ?? null,
            recycledCoarseAggregateKgM3: mix.recycledCoarseAggregateKgM3 ?? null,
            lightweightAggregateKgM3: mix.lightweightAggregateKgM3 ?? null,
            heavyweightAggregateKgM3: mix.heavyweightAggregateKgM3 ?? null,
            naturalAggregateKgM3: mix.naturalAggregateKgM3,
            recycledAggregateKgM3: mix.recycledAggregateKgM3,
            waterKgM3: mix.waterKgM3,
            sodiumHydroxideKgM3: mix.sodiumHydroxideKgM3 ?? null,
            sodiumSilicateKgM3: mix.sodiumSilicateKgM3 ?? null,
            alkaliActivatorKgM3: mix.alkaliActivatorKgM3 ?? null,
            superplasticizerKgM3: mix.superplasticizerKgM3 ?? null,
            airEntrainingKgM3: mix.airEntrainingKgM3 ?? null,
            acceleratorRetarderKgM3: mix.acceleratorRetarderKgM3 ?? null,
            fiberKgM3: mix.fiberKgM3 ?? null,
            airTargetContentPercent: mix.airTargetContentPercent ?? null,
            strength7DaysMpa: mix.strength7DaysMpa,
            strength28DaysMpa: mix.strength28DaysMpa,
            strength56DaysMpa: mix.strength56DaysMpa,
            strength90DaysMpa: mix.strength90DaysMpa,
            compressiveStrengthMeasurements: mix.compressiveStrengthMeasurements ?? [],
          },
          outputs: {
            mixMetrics: scenario.mixMetrics,
            earthPressures: scenario.earthPressures ?? null,
            internalStability: scenario.internalStability ?? null,
            stability: scenario.stability ?? null,
            quantities: scenario.quantities ?? null,
            emissions: scenario.emissions ?? null,
            cost: scenario.cost ?? null,
          },
          keyOutputs: {
            totalBinderKgM3: finiteOrNull(scenario.mixMetrics.totalBinderKgM3),
            totalAggregateKgM3: finiteOrNull(scenario.mixMetrics.totalAggregateKgM3),
            totalRecycledAggregateKgM3: finiteOrNull(scenario.mixMetrics.totalRecycledAggregateKgM3),
            recycledAggregatePercent: finiteOrNull(scenario.mixMetrics.totalRecycledAggregatePercent),
            waterBinderRatio: finiteOrNull(scenario.mixMetrics.waterBinderRatio),
            freshMassKgM3: finiteOrNull(scenario.mixMetrics.totalFreshMassKgM3),
            ka: finiteOrNull(scenario.earthPressures?.Ka),
            paKnM: finiteOrNull(scenario.earthPressures?.Pa),
            slidingFs: finiteOrNull(scenario.stability?.sliding.factorOfSafety),
            overturningFs: finiteOrNull(scenario.stability?.overturning.factorOfSafety),
            bearingFs: finiteOrNull(scenario.stability?.bearingCapacity.factorOfSafety),
            qMaxKpa: finiteOrNull(scenario.stability?.qMax),
            qMinKpa: finiteOrNull(scenario.stability?.qMin),
            concreteVolumeM3: finiteOrNull(scenario.quantities?.concreteVolume),
            reinforcementTon: finiteOrNull(scenario.quantities?.reinforcementWeight),
            materialEmissionKgCo2e: finiteOrNull(scenario.emissions?.materials.totalEmission),
            totalEmissionKgCo2e: finiteOrNull(scenario.emissions?.grandTotal),
            knownEmissionSubtotalKgCo2e: finiteOrNull(scenario.emissions?.knownSubtotal),
            recipeCostTlM3: finiteOrNull(scenario.cost?.recipeCostPerM3),
            totalProjectCostTl: finiteOrNull(scenario.cost?.totalCost),
          },
          missing: {
            emissionFactors: scenario.emissions?.materials.missingFactors ?? [],
            emissionAmounts: scenario.emissions?.materials.missingAmounts ?? [],
            prices: scenario.cost?.missingPrices ?? [],
            costAmounts: scenario.cost?.missingAmounts ?? [],
          },
        };
      } catch (error) {
        return {
          testId,
          order: index + 1,
          sourceRow: mix.sourceRow ?? null,
          mixNo: mix.mixNo ?? null,
          name: mix.name,
          materialSystem: mix.materialSystem ?? null,
          literatureStudy: mix.literatureStudy ?? null,
          sourceUrl: mix.sourceUrl ?? null,
          sourceLine: mix.sourceLine ?? null,
          status: 'RUNTIME_ERROR',
          elapsedMs: performance.now() - startedAt,
          importIssues: issuesByRow.get(mix.sourceRow ?? -1) ?? [],
          validation: [],
          runtimeWarnings: [],
          rawValues: mix.rawValues ?? {},
          normalizedInputs: {},
          outputs: null,
          keyOutputs: {},
          missing: {},
          exception: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) },
        };
      }
    });

    const statusCounts = cases.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});
    const report = {
      generatedAt: new Date().toISOString(),
      selectedDataset: selected.file,
      datasetStats,
      fixedProjectInputs: { wallInput: DEFAULT_WALL_INPUT, logistics: DEFAULT_LOGISTICS },
      totals: {
        cases: cases.length,
        statuses: statusCounts,
        runtimeErrors: cases.filter((item) => item.status === 'RUNTIME_ERROR').length,
        validationErrors: cases.filter((item) => item.status === 'VALIDATION_ERROR').length,
        incompleteOutputs: cases.filter((item) => item.status === 'INCOMPLETE_OUTPUT').length,
      },
      parserIssuesWithoutRow: selected.parsed.issues.filter((issue) => issue.row == null),
      duplicateRows: selected.parsed.duplicateRows ?? [],
      headers: selected.parsed.headers,
      cases,
    };

    const outDir = path.resolve('artifacts/generated/dataset-audit');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'full-audit.json'), JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({
      selectedDataset: report.selectedDataset,
      datasetStats,
      totals: report.totals,
      duplicateRows: report.duplicateRows,
      headers: report.headers,
      cases: cases.map((item) => ({
        testId: item.testId,
        order: item.order,
        sourceRow: item.sourceRow,
        mixNo: item.mixNo,
        name: item.name,
        materialSystem: item.materialSystem,
        status: item.status,
        keyOutputs: item.keyOutputs,
        missing: item.missing,
        importIssues: item.importIssues,
        validation: item.validation,
        runtimeWarnings: item.runtimeWarnings,
        exception: 'exception' in item ? item.exception : undefined,
      })),
    }, null, 2), 'utf8');

    expect(cases).toHaveLength(121);
    expect(report.totals.runtimeErrors).toBe(0);
    expect(report.totals.validationErrors).toBe(0);
    expect(report.totals.incompleteOutputs).toBe(0);
    expect(cases.some((item) => item.missing?.emissionFactors?.includes('air_entraining'))).toBe(false);
  }, 120_000);
});
