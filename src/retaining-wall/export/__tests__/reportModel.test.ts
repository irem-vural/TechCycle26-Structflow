import { describe, expect, it } from 'vitest';
import type ExcelJS from 'exceljs';
import { runEngine } from '../../engine';
import { calculateMixMetrics, createDefaultConcreteMix } from '../../material-selection/mixModel';
import { DEFAULT_LOGISTICS, DEFAULT_WALL_INPUT } from '../../store/useRetainingWallStore';
import type { EmissionResult, MachineryEmissionDetail, Scenario } from '../../types';
import { buildScenarioWorkbook } from '../exportExcel';
import { buildScenarioReportHtml } from '../exportPdf';
import {
  buildScenarioReportModel,
  circularityOriginLabel,
  REPORT_METHODS,
  TEKNOFEST_BEARING_BENCHMARK,
} from '../reportModel';

function baseScenario(): Scenario {
  const input = {
    ...DEFAULT_WALL_INPUT,
    geometry: { ...DEFAULT_WALL_INPUT.geometry, H: 6, L: 10, Df: 0.75 },
    backfillSoil: { ...DEFAULT_WALL_INPUT.backfillSoil, gamma: 17.5, beta: 0, c: 0 },
    foundationSoil: { ...DEFAULT_WALL_INPUT.foundationSoil, gamma: 18.5, phi: 34, c: 0 },
    surchargeLoad: 30,
    earthPressureTheory: 'coulomb' as const,
    bearingCapacityMethod: 'terzaghi' as const,
  };
  const concreteMix = createDefaultConcreteMix('C30');
  const quantities = {
    concreteVolume: 10,
    reinforcementWeight: 0.05,
    formworkArea: 20,
    excavationVolume: 15,
    backfillVolume: 12,
    concreteVolumePerMeter: 1,
    reinforcementWeightPerMeter: 0.005,
    reinforcementWeightKg: 50,
    reinforcementWeightKgPerMeter: 5,
    reinforcementRequiredKg: 45,
    reinforcementRequiredKgPerMeter: 4.5,
    formworkAreaPerMeter: 2,
    excavationVolumePerMeter: 1.5,
    backfillVolumePerMeter: 1.2,
    wallLength: 10,
    reinforcementRatioKgM3: 5,
    reinforcementMode: 'structural' as const,
    reinforcementWarnings: [],
  };

  return {
    id: 'export-parity-test',
    name: 'Export parity test',
    input,
    logistics: { ...DEFAULT_LOGISTICS, vatPercent: 0 },
    concreteMix,
    customCoefficients: {},
    mixMetrics: calculateMixMetrics(concreteMix, quantities.concreteVolume),
    earthPressures: {
      theory: 'coulomb',
      activeConvention: 'heel-edge-vertical-virtual-plane',
      wallFrictionAngle: 0,
      backfillSlopeAngle: 0,
      virtualPlaneAngle: 90,
      Ka: 0.28,
      Kp: 3.5,
      PaSoil: 88,
      PaSurcharge: 50,
      Pa: 138,
      Pp: 10,
      PaSoil_h: 88,
      PaSoil_v: 0,
      PaSurcharge_h: 50,
      PaSurcharge_v: 0,
      Pa_h: 138,
      Pa_v: 0,
      soilLeverArm: 2,
      surchargeLeverArm: 3,
      passiveHeight: 0.75,
    },
    stability: {
      sliding: { factorOfSafety: 1.8, requiredFS: 1.25, status: 'safe', steps: [] },
      overturning: { factorOfSafety: 2.1, requiredFS: 1.5, status: 'safe', steps: [] },
      bearingCapacity: {
        factorOfSafety: 3.4,
        requiredFS: 3,
        status: 'safe',
        steps: [{
          description: 'Taşıma gücü katsayıları',
          formula: 'q_ult = cNc + qNq + 0.5γBNγ',
          variables: { Nc: 52.64, Nq: 36.5, Ngamma: 38.04 },
          result: 500,
          unit: 'kPa',
          reference: 'TEKNOFEST benchmark',
        }],
      },
      eccentricity: 0.1,
      effectiveBearingWidth: 3.8,
      qMax: 150,
      qMin: 70,
    },
    quantities,
    emissions: emissionsForParity(),
    createdAt: new Date('2026-09-12T00:00:00.000Z'),
  };
}

function machine(machineName: string, emission = 0): MachineryEmissionDetail {
  return { machineName, workingTime: 0, fuelConsumption: 0, emission, cost: 0 };
}

function emissionsForParity(): EmissionResult {
  return {
    materials: {
      cement: 100,
      aggregate: 0,
      coarseAggregate: 0,
      fineAggregate: 0,
      steel: 50,
      totalEmission: 150,
      knownSubtotal: 150,
      dataComplete: true,
      missingFactors: [],
      missingAmounts: [],
      byMaterial: [
        {
          id: 'cement',
          name: 'Portland çimentosu',
          amountKgM3: 100,
          projectAmountKg: 1000,
          factorKgCo2ePerKg: 0.1,
          emissionKgCo2eM3: 10,
          emissionKgCo2eProject: 100,
          source: 'test source',
          sourceUrl: null,
        },
        {
          id: 'reinforcement_steel',
          name: 'Donatı çeliği',
          amountKgM3: 5,
          projectAmountKg: 50,
          factorKgCo2ePerKg: 1,
          emissionKgCo2eM3: 5,
          emissionKgCo2eProject: 50,
          source: 'test source',
          sourceUrl: null,
        },
      ],
    },
    machinery: {
      excavator: machine('Ekskavatör', 10),
      dumperTruck: machine('Damperli kamyon', 10),
      rebarTruck: machine('Donatı kamyonu', 5),
      concreteMixer: machine('Beton mikseri', 10),
      concretePump: machine('Beton pompası', 5),
      compactor: machine('Kompaktör'),
      totalEmission: 40,
      totalFuel: 0,
      totalCost: 0,
    },
    logistics: {
      mixerLogistics: 10,
      pumpLogistics: 5,
      totalEmission: 15,
    },
    grandTotal: 190,
    grandTotalPerMeter: 19,
    knownSubtotal: 190,
    dataComplete: true,
    warnings: [],
  } satisfies EmissionResult;
}

function rowByFirstCell(worksheet: ExcelJS.Worksheet, label: string): ExcelJS.Row | undefined {
  let found: ExcelJS.Row | undefined;
  worksheet.eachRow((row) => {
    if (String(row.getCell(1).value ?? '') === label) found = row;
  });
  return found;
}

describe('export report model parity', () => {
  it('matches the approved bearing benchmark when fed by the real engine defaults', () => {
    const scenario = runEngine({
      wallInput: DEFAULT_WALL_INPUT,
      logistics: DEFAULT_LOGISTICS,
      customCoefficients: new Map(),
      concreteMix: createDefaultConcreteMix(DEFAULT_WALL_INPUT.concreteClass),
      scenarioId: 'export-engine-integration',
      scenarioName: 'Export engine integration',
    });
    const report = buildScenarioReportModel(scenario);
    expect(report.methods.scenarioLateralEarthPressure).toBe('Coulomb');
    expect(report.methods.scenarioBearingCapacity).toBe('Terzaghi');
    expect(report.bearingFactors.Nc).toBeCloseTo(TEKNOFEST_BEARING_BENCHMARK.Nc, 2);
    expect(report.bearingFactors.Nq).toBeCloseTo(TEKNOFEST_BEARING_BENCHMARK.Nq, 2);
    expect(report.bearingFactors.Ngamma).toBeCloseTo(TEKNOFEST_BEARING_BENCHMARK.Ngamma, 2);
    expect(report.bearingFactors.benchmarkMatches).toBe(true);
    expect(report.rcDesign.benchmarkMatches).toBe(true);
  });

  it('splits recipe, steel and machinery/logistics without double counting', () => {
    const scenario = baseScenario();

    const report = buildScenarioReportModel(scenario);
    expect(report.carbon.recipeProductionProjectKgCo2e).toBe(100);
    expect(report.carbon.recipeProductionKgCo2ePerM3).toBe(10);
    expect(report.carbon.reinforcementProjectKgCo2e).toBe(50);
    expect(report.carbon.siteMachineryProjectKgCo2e).toBe(25);
    expect(report.carbon.concreteLogisticsProjectKgCo2e).toBe(15);
    expect(report.carbon.grandTotalProjectKgCo2e).toBe(190);
    expect(report.carbon.grandTotalPerConcreteM3).toBe(19);
    expect(report.carbon.grandTotalPerWallMeter).toBe(19);
    expect(
      (report.carbon.recipeProductionProjectKgCo2e ?? 0)
      + (report.carbon.reinforcementProjectKgCo2e ?? 0)
      + (report.carbon.siteMachineryProjectKgCo2e ?? 0)
      + (report.carbon.concreteLogisticsProjectKgCo2e ?? 0),
    ).toBe(report.carbon.grandTotalProjectKgCo2e);
  });

  it('keeps the approved method boundaries and H definition in one shared model', () => {
    const report = buildScenarioReportModel(baseScenario());
    expect(report.methods.lateralEarthPressure).toBe(REPORT_METHODS.lateralEarthPressure);
    expect(report.methods.scenarioLateralEarthPressure).toBe('Coulomb');
    expect(report.methods.bearingCapacity).toBe('Terzaghi');
    expect(report.methods.reinforcedConcrete).toBe('ACI CODE-318-25');
    expect(report.methods.reinforcedConcreteScope).toContain('geoteknik');
    expect(report.methods.reinforcedConcreteScope).toContain('preliminary screening');
    expect(report.methods.reinforcedConcreteStatus).toBe('preliminary-screening');
    expect(report.methods.activeEarthPressureConventionConsistent).toBe(true);
    expect(report.methods.activeEarthPressureConvention).toContain('δ=0°');
    expect(report.assumptions.backfillPhiDeg).toBe(30);
    expect(report.assumptions.backfillPhiBasis).toContain('Modelleme varsayımı');
    expect(report.assumptions.baseInterfaceFrictionAngleDeg).toBeCloseTo(34 * 2 / 3, 12);
    expect(report.assumptions.baseInterfaceFrictionBasis).toContain('Modelleme varsayımı');
    expect(report.geometry.freeStemHeightDefinition).toContain('taban plağı üst kotundan');
    expect(report.geometry.foundationEmbedmentDepthM).toBe(0.75);
    expect(report.geometry.passivePressureDepthM).toBe(0.75);
    expect(report.geometry.scenarioPassivePressureDepthM).toBe(0.75);
    expect(report.geometry.passivePressureDepthConsistent).toBe(true);
    expect(report.geometry.toeOverburdenHeightM).toBeCloseTo(0.15, 12);
    expect(report.geometry.toeOverburdenHeightDefinition).toContain('Df - x5');
    expect(report.geometry.shearKey).toBe('removed');
    expect(report.rcDesign).toMatchObject({ fcMpa: 21, fyMpa: 400, coverMm: 70, shrinkageTemperatureRatio: 0.002, benchmarkMatches: true });
  });

  it('exposes the approved φ=34 bearing-factor benchmark without overwriting scenario values', () => {
    const report = buildScenarioReportModel(baseScenario());
    expect(report.bearingFactors.benchmarkApplies).toBe(true);
    expect(TEKNOFEST_BEARING_BENCHMARK).toEqual({
      foundationPhiDeg: 34,
      Nc: 52.64,
      Nq: 36.5,
      Ngamma: 38.04,
    });
    expect(report.bearingFactors.Nc).not.toBeNull();
    expect(report.bearingFactors.Nq).not.toBeNull();
    expect(report.bearingFactors.Ngamma).not.toBeNull();
    expect(report.bearingFactors.footingWidthM).toBe(4);
    expect(report.bearingFactors.effectiveBearingWidthM).toBe(3.8);
    expect(report.bearingFactors.eccentricityM).toBe(0.1);
    expect(report.bearingFactors.qMaxKpa).toBe(150);
    expect(report.assumptions.bearingWidthBasis).toContain('tam fiziksel temel genişliği');
    expect(report.assumptions.qMaxBasis).toContain('Eksantrisite');
  });

  it('builds Excel from the same carbon metric definitions used by the report model', async () => {
    const scenario = baseScenario();
    const workbook = await buildScenarioWorkbook(scenario, new Date('2026-09-12T00:00:00.000Z'));
    const emissions = workbook.getWorksheet('Emisyon');
    const methods = workbook.getWorksheet('Yöntem & Kaynak');
    expect(emissions).toBeTruthy();
    expect(methods).toBeTruthy();

    expect(rowByFirstCell(emissions!, 'Beton reçetesi üretimi (donatı hariç)')?.getCell(2).value).toBe('100.00');
    expect(rowByFirstCell(emissions!, 'Donatı')?.getCell(2).value).toBe('50.00');
    expect(rowByFirstCell(emissions!, 'Şantiye iş makineleri (mikser/pompa hariç)')?.getCell(2).value).toBe('25.00');
    expect(rowByFirstCell(emissions!, 'Beton lojistiği (mikser + pompa; makine toplamının alt kümesi)')?.getCell(2).value).toBe('15.00');
    expect(rowByFirstCell(emissions!, 'Aktif reçete üretim CO₂e / m³ beton (donatı hariç)')?.getCell(2).value).toBe('10.00');
    expect(rowByFirstCell(emissions!, 'Toplam proje CO₂e / m³ beton')?.getCell(2).value).toBe('19.00');
    expect(rowByFirstCell(methods!, 'H')?.getCell(4).value).toContain('taban plağı üst kotundan');
    expect(rowByFirstCell(methods!, 'Df')?.getCell(4).value).toContain('temel plağının alt kotuna');
    expect(rowByFirstCell(methods!, 'Pasif basınç derinliği')?.getCell(2).value).toBe('0.750');
    expect(rowByFirstCell(methods!, 'Burun üstü zemin örtüsü')?.getCell(2).value).toBe('0.150');
    expect(rowByFirstCell(methods!, 'Aktif basınç konvansiyonu')?.getCell(3).value).toBe('Uyumlu');
    expect(rowByFirstCell(methods!, 'Dolgu φ')?.getCell(5).value).toContain('Modelleme varsayımı');
    expect(rowByFirstCell(methods!, 'Taban arayüzü δbase')?.getCell(5).value).toContain('Modelleme varsayımı');
    expect(rowByFirstCell(methods!, 'Betonarme ön tarama')?.getCell(3).value).toBe('PRELIMINARY SCREENING');
    expect(rowByFirstCell(methods!, 'Terzaghi kapasite genişliği B')?.getCell(2).value).toBe('4.000');
    expect(rowByFirstCell(methods!, 'Diagnostik etkili genişlik B′')?.getCell(3).value).toBe('Kapasitede kullanılmaz');
    expect(rowByFirstCell(methods!, 'qMax')?.getCell(5).value).toContain('eksantrisite qMax içinde');
    expect(rowByFirstCell(methods!, 'Kayma FS min')?.getCell(2).value).toBe('1.250');
    expect(rowByFirstCell(methods!, 'Kayma FS min')?.getCell(3).value).toBe('1.250');
    expect(rowByFirstCell(methods!, 'Donatı ölçekleme esası')?.getCell(2).value).toContain('1,00 m duvar şeridi');
    expect(rowByFirstCell(methods!, 'Nc (φ=34° benchmark)')?.getCell(3).value).toBe('52.64');
    expect(rowByFirstCell(methods!, "f'c")?.getCell(3).value).toBe('21.00');
  });

  it('builds the reviewed report HTML from the active scenario without browser save side effects', () => {
    const html = buildScenarioReportHtml(
      baseScenario(),
      { projectName: 'Test İstinat Projesi' },
      new Date('2026-09-12T12:00:00.000Z'),
    );
    expect(html.length).toBeGreaterThan(20_000);
    expect(html).toContain('Test İstinat Projesi');
    expect(html).toContain('Coulomb');
    expect(html).toContain('190,0');
    expect(html.match(/<section class="page/g)).toHaveLength(18);
    expect(html).toContain('Hesap modelinde tanımlı değil');
    expect(html).toContain('Bu sürümde hesaplanmıyor');
    expect(html).not.toMatch(/\{\{[^{}]+\}\}/);
    expect(html).not.toContain('<!--REPORT_MATERIAL_ROWS-->');
    expect(html).not.toContain('<!--REPORT_WARNING_ROWS-->');
  });

  it('labels secondary material separately from recycled waste', () => {
    expect(circularityOriginLabel('secondary_material')).toBe('Alternatif mineral / ikincil malzeme');
    expect(circularityOriginLabel('alternative_mineral')).toBe('Alternatif mineral / ikincil malzeme');
    expect(circularityOriginLabel('recycled_waste')).toBe('Geri dönüştürülmüş atık');
  });

  it('keeps missing carbon data missing instead of turning it into zero', () => {
    const scenario = { ...baseScenario(), emissions: undefined } satisfies Scenario;
    const report = buildScenarioReportModel(scenario);
    expect(report.carbon.recipeProductionKgCo2ePerM3).toBeNull();
    expect(report.carbon.recipeProductionProjectKgCo2e).toBeNull();
    expect(report.carbon.grandTotalProjectKgCo2e).toBeNull();
    expect(report.carbon.grandTotalPerConcreteM3).toBeNull();
  });

  it('flags Df-x5 if a stale scenario used it as passive pressure depth', () => {
    const source = baseScenario();
    const scenario: Scenario = {
      ...source,
      earthPressures: source.earthPressures
        ? { ...source.earthPressures, passiveHeight: Math.max(0, source.input.geometry.Df - source.input.geometry.x5) }
        : undefined,
    };
    const report = buildScenarioReportModel(scenario);
    expect(report.geometry.passivePressureDepthM).toBe(0.75);
    expect(report.geometry.scenarioPassivePressureDepthM).toBeCloseTo(0.15, 12);
    expect(report.geometry.passivePressureDepthConsistent).toBe(false);
    expect(report.warnings.some((warning) => warning.includes('Df-x5 yalnız burun plağı üstündeki zemin örtüsü'))).toBe(true);
  });

  it('flags a legacy beneficial active vertical component instead of presenting it as final convention', () => {
    const source = baseScenario();
    const scenario: Scenario = {
      ...source,
      earthPressures: source.earthPressures
        ? { ...source.earthPressures, activeConvention: undefined, wallFrictionAngle: 20, Pa_v: 25 }
        : undefined,
    };
    const report = buildScenarioReportModel(scenario);
    expect(report.methods.activeEarthPressureConventionConsistent).toBe(false);
    expect(report.warnings.some((warning) => warning.includes('Pa_v=0'))).toBe(true);
  });

  it('includes metakaolin in the upper circular/alternative metric but never labels it recycled waste', async () => {
    const source = baseScenario();
    const concreteMix = {
      ...source.concreteMix,
      recipeMode: 'custom' as const,
      materials: source.concreteMix.materials.map((item) => item.id === 'metakaolin'
        ? {
            ...item,
            enabled: true,
            value: 20,
            basis: 'amount' as const,
            unit: 'kg/m³' as const,
            rawValue: 20,
            rawUnit: 'kg/m³' as const,
            canonicalKgPerM3: 20,
          }
        : item),
    };
    const scenario: Scenario = {
      ...source,
      concreteMix,
      mixMetrics: calculateMixMetrics(concreteMix, source.quantities?.concreteVolume ?? null),
    };
    const workbook = await buildScenarioWorkbook(scenario, new Date('2026-09-12T00:00:00.000Z'));
    const zeroWaste = workbook.getWorksheet('Sıfır Atık Analizi');
    expect(zeroWaste).toBeTruthy();
    const metakaolin = rowByFirstCell(zeroWaste!, 'Metakaolin');
    expect(metakaolin?.getCell(3).value).toBe('Alternatif mineral / ikincil malzeme');
    expect(metakaolin?.getCell(6).value).toBe('Geri dönüştürülmüş atık olarak etiketlenmez');
  });
});
