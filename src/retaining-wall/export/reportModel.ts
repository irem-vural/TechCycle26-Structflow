import type { CircularityOrigin } from '../material-selection/types';
import type { Scenario } from '../types';

export const REPORT_METHODS = {
  lateralEarthPressure: 'Coulomb',
  bearingCapacity: 'Terzaghi',
  reinforcedConcrete: 'ACI CODE-318-25',
} as const;

export const TEKNOFEST_BEARING_BENCHMARK = {
  foundationPhiDeg: 34,
  Nc: 52.64,
  Nq: 36.50,
  Ngamma: 38.04,
} as const;

export const TEKNOFEST_RC_BENCHMARK = {
  fcMpa: 21,
  fyMpa: 400,
  coverMm: 70,
  shrinkageTemperatureRatio: 0.002,
} as const;

export const REPORT_REFERENCES = {
  aci31825: {
    label: 'ACI CODE-318-25 — Building Code for Structural Concrete',
    url: 'https://www.concrete.org/publications/typesofpublications/standards(codesandspecs)/suiteofcodes.aspx',
    scope: 'Betonarme kesit tasarımı, donatı ve detaylandırma; geoteknik hesaplara uygulanmaz.',
  },
  fhwaCoulomb: {
    label: 'FHWA GEC No. 6 — Shallow Foundations, Coulomb lateral earth pressure definitions',
    url: 'https://www.fhwa.dot.gov/engineering/geotech/pubs/010943.pdf',
    scope: 'Coulomb aktif yanal toprak basıncı kavramları ve geoteknik referans çerçevesi.',
  },
  terzaghi1943: {
    label: 'Terzaghi, K. (1943), Theoretical Soil Mechanics',
    url: 'https://doi.org/10.1002/9780470172766',
    scope: 'Klasik sığ temel taşıma gücü teorisinin kaynak referansı.',
  },
} as const;

export interface ScenarioReportModel {
  methods: {
    lateralEarthPressure: typeof REPORT_METHODS.lateralEarthPressure;
    scenarioLateralEarthPressure: string;
    lateralEarthPressureConsistent: boolean;
    bearingCapacity: typeof REPORT_METHODS.bearingCapacity;
    scenarioBearingCapacity: string;
    bearingCapacityConsistent: boolean;
    reinforcedConcrete: typeof REPORT_METHODS.reinforcedConcrete;
    reinforcedConcreteScope: string;
    reinforcedConcreteStatus: 'preliminary-screening';
    activeEarthPressureConvention: string;
    activeEarthPressureConventionConsistent: boolean;
  };
  assumptions: {
    backfillPhiDeg: number;
    backfillPhiBasis: string;
    baseInterfaceFrictionAngleDeg: number;
    baseInterfaceFrictionBasis: string;
    bearingWidthBasis: string;
    qMaxBasis: string;
  };
  geometry: {
    freeStemHeightM: number;
    freeStemHeightDefinition: string;
    foundationEmbedmentDepthM: number;
    foundationEmbedmentDepthDefinition: string;
    passivePressureDepthM: number;
    scenarioPassivePressureDepthM: number | null;
    passivePressureDepthDefinition: string;
    passivePressureDepthConsistent: boolean | null;
    toeOverburdenHeightM: number;
    toeOverburdenHeightDefinition: string;
    wallLengthM: number | null;
    shearKey: 'removed';
  };
  bearingFactors: {
    Nc: number | null;
    Nq: number | null;
    Ngamma: number | null;
    benchmarkApplies: boolean;
    benchmarkMatches: boolean | null;
    footingWidthM: number;
    effectiveBearingWidthM: number | null;
    eccentricityM: number | null;
    qMaxKpa: number | null;
  };
  rcDesign: {
    fcMpa: number | null;
    fyMpa: number | null;
    coverMm: number | null;
    shrinkageTemperatureRatio: number | null;
    benchmarkMatches: boolean | null;
  };
  carbon: {
    recipeProductionKgCo2ePerM3: number | null;
    recipeProductionProjectKgCo2e: number | null;
    reinforcementProjectKgCo2e: number | null;
    siteMachineryProjectKgCo2e: number | null;
    concreteLogisticsProjectKgCo2e: number | null;
    grandTotalProjectKgCo2e: number | null;
    grandTotalPerConcreteM3: number | null;
    grandTotalPerWallMeter: number | null;
  };
  warnings: string[];
}

function finite(value: number | null | undefined): number | null {
  return value == null || !Number.isFinite(value) ? null : value;
}

function divide(value: number | null, denominator: number | null): number | null {
  return value == null || denominator == null || denominator <= 0 ? null : value / denominator;
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  if (values.length === 0) return null;
  if (values.some((value) => value == null || !Number.isFinite(value))) return null;
  return values.reduce<number>((sum, value) => sum + (value as number), 0);
}

function methodLabel(value: string | null | undefined): string {
  if (!value) return 'Belirtilmedi';
  if (value === 'coulomb') return 'Coulomb';
  if (value === 'rankine') return 'Rankine';
  if (value === 'terzaghi') return 'Terzaghi';
  if (value === 'hansen') return 'Hansen';
  return value;
}

/**
 * PDF ve Excel raporlarının aynı senaryo alanlarını ve aynı metrik tanımlarını
 * kullanması için tek raporlama görünümü. Hesap motorunu yeniden çalıştırmaz ve
 * kullanıcı onaylı değerleri başka bir kaynakla sessizce değiştirmez.
 */
export function buildScenarioReportModel(scenario: Scenario): ScenarioReportModel {
  const emissions = scenario.emissions;
  const quantities = scenario.quantities;
  const wallLength = finite(quantities?.wallLength ?? scenario.input.geometry.L);
  const concreteVolume = finite(quantities?.concreteVolume);
  const foundationEmbedmentDepthM = scenario.input.geometry.Df;
  const passivePressureDepthM = foundationEmbedmentDepthM;
  const scenarioPassivePressureDepthM = finite(scenario.earthPressures?.passiveHeight);
  const passivePressureDepthConsistent = scenarioPassivePressureDepthM == null
    ? null
    : Math.abs(scenarioPassivePressureDepthM - passivePressureDepthM) < 1e-9;
  const toeOverburdenHeightM = Math.max(0, foundationEmbedmentDepthM - scenario.input.geometry.x5);

  const recipeItems = (emissions?.materials.byMaterial ?? []).filter((item) => item.id !== 'reinforcement_steel');
  const recipeProductionProjectKgCo2e = sumNullable(recipeItems.map((item) => item.emissionKgCo2eProject));
  const recipeProductionKgCo2ePerM3 = sumNullable(recipeItems.map((item) => item.emissionKgCo2eM3));
  const reinforcementProjectKgCo2e = finite(emissions?.materials.steel);
  const concreteLogisticsProjectKgCo2e = finite(emissions?.logistics.totalEmission);
  const machineryTotal = finite(emissions?.machinery.totalEmission);
  const siteMachineryRaw = machineryTotal == null || concreteLogisticsProjectKgCo2e == null
    ? null
    : machineryTotal - concreteLogisticsProjectKgCo2e;
  const machineryBreakdownInvalid = siteMachineryRaw != null && siteMachineryRaw < -1e-9;
  const siteMachineryProjectKgCo2e = machineryBreakdownInvalid
    ? null
    : siteMachineryRaw == null ? null : Math.max(0, siteMachineryRaw);
  const grandTotalProjectKgCo2e = finite(emissions?.grandTotal);
  const grandTotalPerWallMeter = finite(emissions?.grandTotalPerMeter)
    ?? divide(grandTotalProjectKgCo2e, wallLength);

  const scenarioEarthPressure = scenario.earthPressures?.theory ?? scenario.input.earthPressureTheory;
  const scenarioBearingCapacity = scenario.input.bearingCapacityMethod;
  const earth = scenario.earthPressures;
  const activeEarthPressureConventionConsistent = earth?.activeConvention === 'heel-edge-vertical-virtual-plane'
    && Math.abs(earth.wallFrictionAngle ?? scenario.input.wallFrictionAngle) < 1e-9
    && Math.abs(earth.backfillSlopeAngle ?? scenario.input.backfillSoil.beta) < 1e-9
    && Math.abs((earth.virtualPlaneAngle ?? 90) - 90) < 1e-9
    && Math.abs(earth.Pa_v) < 1e-9;
  const baseInterfaceFrictionAngleDeg = (2 / 3) * scenario.input.foundationSoil.phi;
  const bearingStep = scenario.stability?.bearingCapacity.steps.find((step) => (
    Number.isFinite(step.variables?.Nc) || Number.isFinite(step.variables?.Nq) || Number.isFinite(step.variables?.Ngamma)
  ));
  const Nc = finite(bearingStep?.variables?.Nc);
  const Nq = finite(bearingStep?.variables?.Nq);
  const Ngamma = finite(bearingStep?.variables?.Ngamma);
  const benchmarkApplies = Math.abs(scenario.input.foundationSoil.phi - TEKNOFEST_BEARING_BENCHMARK.foundationPhiDeg) < 1e-9;
  const benchmarkMatches = benchmarkApplies && Nc != null && Nq != null && Ngamma != null
    ? Math.abs(Nc - TEKNOFEST_BEARING_BENCHMARK.Nc) < 0.005
      && Math.abs(Nq - TEKNOFEST_BEARING_BENCHMARK.Nq) < 0.005
      && Math.abs(Ngamma - TEKNOFEST_BEARING_BENCHMARK.Ngamma) < 0.005
    : null;
  const fcMpa = finite(scenario.input.rcDesign?.fcMpa);
  const fyMpa = finite(scenario.input.rcDesign?.fyMpa);
  const coverMm = finite(scenario.input.reinforcement?.coverMm);
  const shrinkageTemperatureRatio = finite(scenario.input.rcDesign?.shrinkageTemperatureRatio);
  const rcValuesComplete = fcMpa != null && fyMpa != null && coverMm != null && shrinkageTemperatureRatio != null;
  const rcBenchmarkMatches = rcValuesComplete
    ? Math.abs(fcMpa - TEKNOFEST_RC_BENCHMARK.fcMpa) < 1e-9
      && Math.abs(fyMpa - TEKNOFEST_RC_BENCHMARK.fyMpa) < 1e-9
      && Math.abs(coverMm - TEKNOFEST_RC_BENCHMARK.coverMm) < 1e-9
      && Math.abs(shrinkageTemperatureRatio - TEKNOFEST_RC_BENCHMARK.shrinkageTemperatureRatio) < 1e-12
    : null;
  const warnings: string[] = [];
  if (scenarioEarthPressure !== 'coulomb') {
    warnings.push(`Rapor mimarisi Coulomb yanal toprak basıncını gerektiriyor; bu senaryoda ${methodLabel(scenarioEarthPressure)} kayıtlı.`);
  }
  if (scenarioBearingCapacity !== 'terzaghi') {
    warnings.push(`Rapor mimarisi Terzaghi taşıma gücünü gerektiriyor; bu senaryoda ${methodLabel(scenarioBearingCapacity)} kayıtlı.`);
  }
  if (!activeEarthPressureConventionConsistent) {
    warnings.push('Final aktif basınç konvansiyonu topuk kenarında düşey sanal düzlem (ε=90°, δ=0°, β=0°, Pa_v=0) olmalıdır; senaryo sonucu bu konvansiyonla tutarlı değil.');
  }
  if (benchmarkApplies && benchmarkMatches === false) {
    warnings.push(`TEKNOFEST onaylı φ=34° taşıma gücü benchmarkı Nc=${TEKNOFEST_BEARING_BENCHMARK.Nc}, Nq=${TEKNOFEST_BEARING_BENCHMARK.Nq}, Nγ=${TEKNOFEST_BEARING_BENCHMARK.Ngamma}; senaryo değerleri farklı. Onaylı benchmark sessizce değiştirilmedi.`);
  }
  if (rcBenchmarkMatches === false) {
    warnings.push(`TEKNOFEST RC benchmarkı f'c=${TEKNOFEST_RC_BENCHMARK.fcMpa} MPa, fy=${TEKNOFEST_RC_BENCHMARK.fyMpa} MPa, pas payı=${TEKNOFEST_RC_BENCHMARK.coverMm} mm, rötre/sıcaklık oranı=${TEKNOFEST_RC_BENCHMARK.shrinkageTemperatureRatio}; senaryo değerleri farklı. Onaylı benchmark sessizce değiştirilmedi.`);
  }
  if (machineryBreakdownInvalid) {
    warnings.push('Beton lojistiği emisyonu toplam makine emisyonundan büyük; şantiye-makine alt toplamı 0 kabul edilmedi ve eksik bırakıldı.');
  }
  if (passivePressureDepthConsistent === false) {
    warnings.push(`Pasif yanal zemin basıncı derinliği bu fiziksel modelde Df=${foundationEmbedmentDepthM} m olmalıdır; senaryo sonucu ${scenarioPassivePressureDepthM} m kullanıyor. Df-x5 yalnız burun plağı üstündeki zemin örtüsü yüksekliğidir.`);
  }

  return {
    methods: {
      lateralEarthPressure: REPORT_METHODS.lateralEarthPressure,
      scenarioLateralEarthPressure: methodLabel(scenarioEarthPressure),
      lateralEarthPressureConsistent: scenarioEarthPressure === 'coulomb',
      bearingCapacity: REPORT_METHODS.bearingCapacity,
      scenarioBearingCapacity: methodLabel(scenarioBearingCapacity),
      bearingCapacityConsistent: scenarioBearingCapacity === 'terzaghi',
      reinforcedConcrete: REPORT_METHODS.reinforcedConcrete,
      reinforcedConcreteScope: 'ACI CODE-318-25 referanslı ön boyutlandırma / preliminary screening; tam ACI tasarımı veya code-compliance sonucu değildir; geoteknik zemin basıncı, kayma, devrilme veya taşıma gücü hesabı değildir.',
      reinforcedConcreteStatus: 'preliminary-screening',
      activeEarthPressureConvention: 'Topuk kenarında düşey sanal düzlem: ε=90°, δ=0°, β=0°, Pa_v=0.',
      activeEarthPressureConventionConsistent,
    },
    assumptions: {
      backfillPhiDeg: scenario.input.backfillSoil.phi,
      backfillPhiBasis: Math.abs(scenario.input.backfillSoil.phi - 30) < 1e-9
        ? 'Modelleme varsayımı: varsayılan φ_backfill=30°; saha/geoteknik kaynakla doğrulanmış değer olarak sunulmaz.'
        : 'Senaryo girdisi; zemin etüdü/kaynak metadata olmadan kaynak-backed değer olarak sunulmaz.',
      baseInterfaceFrictionAngleDeg,
      baseInterfaceFrictionBasis: 'Modelleme varsayımı: δbase = 2/3·φfoundation; kod hükmü veya saha ölçümü olarak sunulmaz.',
      bearingWidthBasis: 'Terzaghi q_ult tam fiziksel temel genişliği B=x1 ile hesaplanır; diagnostik B′=B-2e kapasiteye ikinci kez uygulanmaz.',
      qMaxBasis: 'Eksantrisite ve gerekirse kısmi temas etkisi taban temas basıncı qMax içinde taşınır.',
    },
    geometry: {
      freeStemHeightM: scenario.input.geometry.H,
      freeStemHeightDefinition: 'H = taban plağı üst kotundan duvar tepesine serbest gövde yüksekliği.',
      foundationEmbedmentDepthM,
      foundationEmbedmentDepthDefinition: 'Df = zemin yüzeyinden temel plağının alt kotuna kadar düşey gömülme derinliği.',
      passivePressureDepthM,
      scenarioPassivePressureDepthM,
      passivePressureDepthDefinition: 'Pasif yanal zemin basıncı ön taraftaki tam gömülü düşey yüz boyunca Df derinliğinde etkir.',
      passivePressureDepthConsistent,
      toeOverburdenHeightM,
      toeOverburdenHeightDefinition: 'Burun plağı üstündeki zemin örtüsü yüksekliği = max(0, Df - x5); pasif basınç derinliği değildir.',
      wallLengthM: wallLength,
      shearKey: 'removed',
    },
    bearingFactors: {
      Nc,
      Nq,
      Ngamma,
      benchmarkApplies,
      benchmarkMatches,
      footingWidthM: scenario.input.geometry.x1,
      effectiveBearingWidthM: finite(scenario.stability?.effectiveBearingWidth),
      eccentricityM: finite(scenario.stability?.eccentricity),
      qMaxKpa: finite(scenario.stability?.qMax),
    },
    rcDesign: {
      fcMpa,
      fyMpa,
      coverMm,
      shrinkageTemperatureRatio,
      benchmarkMatches: rcBenchmarkMatches,
    },
    carbon: {
      recipeProductionKgCo2ePerM3,
      recipeProductionProjectKgCo2e,
      reinforcementProjectKgCo2e,
      siteMachineryProjectKgCo2e,
      concreteLogisticsProjectKgCo2e,
      grandTotalProjectKgCo2e,
      grandTotalPerConcreteM3: divide(grandTotalProjectKgCo2e, concreteVolume),
      grandTotalPerWallMeter,
    },
    warnings,
  };
}

export function circularityOriginLabel(origin: CircularityOrigin): string {
  switch (origin) {
    case 'virgin': return 'Birincil malzeme';
    case 'industrial_byproduct': return 'Endüstriyel yan ürün';
    case 'recycled_waste': return 'Geri dönüştürülmüş atık';
    case 'secondary_material': return 'Alternatif mineral / ikincil malzeme';
    case 'alternative_mineral': return 'Alternatif mineral / ikincil malzeme';
    case 'unknown': return 'Sınıflandırılmamış';
  }
}
