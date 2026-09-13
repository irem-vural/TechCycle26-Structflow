'use client';

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · theme: StructFlow dark · enrichment: none */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileText, Info, RefreshCw, ShieldAlert } from 'lucide-react';
import { useRetainingWallStore } from '@/retaining-wall/store/useRetainingWallStore';
import { exportScenarioToExcel } from '@/retaining-wall/export/exportExcel';
import { exportScenarioToPdf } from '@/retaining-wall/export/exportPdf';
import { calculateMixMetrics, createDefaultConcreteMix, evaluateMixBalance, normalizeConcreteMix } from '@/retaining-wall/material-selection/mixModel';
import { calculateZeroWasteImpact } from '@/retaining-wall/material-selection/zeroWasteImpact';
import { getDefaultMaterialPrice } from '@/retaining-wall/material-selection/defaultPrices';
import { ZeroWastePanel, ZeroWasteSummaryCard } from './ZeroWastePanel';
import { calculateMixCarbonKgM3, createCatalogConcreteMix, evaluateOptimizationScenario, OPTIMIZATION_SCENARIOS } from '@/retaining-wall/material-selection/optimization';
import type { ConcreteMixDesign } from '@/retaining-wall/material-selection/types';
import type { CalculationStep, RetainingWallInput, SafetyStatus, SectionDesign, StabilityCheck } from '@/retaining-wall/types';

type ResultTab = 'overview' | 'engineering' | 'sustainability' | 'cost-logistics';

const tabs: Array<{ id: ResultTab; label: string }> = [
  { id: 'overview', label: 'Genel Bakış' },
  { id: 'engineering', label: 'Mühendislik' },
  { id: 'sustainability', label: 'Sürdürülebilirlik' },
  { id: 'cost-logistics', label: 'Maliyet & Lojistik' },
];


function fmt(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function money(value: number | null | undefined, digits = 0): string {
  return value == null || !Number.isFinite(value) ? '—' : `₺${fmt(value, digits)}`;
}

function pct(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value) ? '—' : `${fmt(value, digits)}%`;
}

function percentChange(value: number | null, reference: number | null): number | null {
  return value == null || reference == null || reference === 0 ? null : (value - reference) / Math.abs(reference) * 100;
}

function amount(mix: ConcreteMixDesign, id: string): number {
  return mix.materials.find((item) => item.id === id)?.canonicalKgPerM3 ?? 0;
}

function Panel({ title, detail, children, className = '' }: { title: string; detail?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] p-3.5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-[var(--sf-divider)] pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-[var(--sf-text-primary)]">{title}</h2>
          {detail && <p className="mt-1 text-xs leading-5 text-[var(--sf-text-muted)]">{detail}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, unit, tone = 'default', detail }: { label: string; value: string; unit?: string; tone?: 'default' | 'success' | 'warning' | 'danger'; detail?: string }) {
  const toneClass = {
    default: 'text-[var(--sf-text-primary)]',
    success: 'text-[var(--sf-status-success)]',
    warning: 'text-[var(--sf-status-warning)]',
    danger: 'text-[var(--sf-status-danger)]',
  }[tone];
  return <div className="rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] px-3 py-2.5"><p className="text-xs font-medium text-[var(--sf-text-muted)]">{label}</p><p className={`mt-1 font-mono text-sm font-semibold ${toneClass}`}>{value}{unit && <span className="ml-1 text-xs font-normal text-[var(--sf-text-muted)]">{unit}</span>}</p>{detail && <p className="mt-1 text-xs leading-4 text-[var(--sf-text-secondary)]">{detail}</p>}</div>;
}

function Status({ status, preliminaryRc = false }: { status?: SafetyStatus; preliminaryRc?: boolean }) {
  const prefix = preliminaryRc ? 'Ön kontrol: ' : '';
  if (status === 'safe' || status === 'marginal') return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--sf-status-success)]"><CheckCircle2 className="size-3.5" /> {prefix}uygun</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--sf-status-danger)]"><ShieldAlert className="size-3.5" /> {prefix}yetersiz</span>;
}

function CalculationDetails({ steps }: { steps: CalculationStep[] | undefined }) {
  if (!steps?.length) return null;
  return (
    <details className="group mt-3 overflow-hidden rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold text-[var(--sf-text-secondary)] transition-colors hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)] [&::-webkit-details-marker]:hidden">
        <span>Hesap adımlarını göster</span>
        <ChevronDown className="size-4 shrink-0 text-[var(--sf-text-muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-3 border-t border-[var(--sf-divider)] p-3">
        {steps.map((step, index) => (
          <div key={`${step.description}-${index}`} className="rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold text-[var(--sf-text-primary)]">{index + 1}. {step.description}</p>
              <span className="shrink-0 font-mono text-xs font-semibold text-[var(--sf-text-primary)]">{fmt(step.result, 3)} {step.unit}</span>
            </div>
            <p className="mt-2 overflow-x-auto rounded bg-[var(--sf-bg-canvas)] px-2.5 py-2 font-mono text-xs text-[var(--sf-text-secondary)]">{step.formula}</p>
            {Object.keys(step.variables).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--sf-text-muted)]">
                {Object.entries(step.variables).map(([name, value]) => (
                  <span key={name}><span className="font-mono text-[var(--sf-text-secondary)]">{name}</span> = {fmt(value, 3)}</span>
                ))}
              </div>
            )}
            {step.reference && <p className="mt-2 text-xs text-[var(--sf-text-muted)]">Referans: {step.reference}</p>}
          </div>
        ))}
      </div>
    </details>
  );
}

function AreaHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mb-1 border-b border-[var(--sf-divider)] pb-3">
      <h2 className="text-base font-semibold tracking-tight text-[var(--sf-text-primary)]">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--sf-text-muted)]">{detail}</p>
    </div>
  );
}

function mixFingerprint(mix: ConcreteMixDesign): string {
  const materials = mix.materials
    .map((material) => [
      material.id,
      material.enabled ? 1 : 0,
      material.canonicalKgPerM3 ?? null,
      material.price?.value ?? null,
      material.price?.unit ?? null,
      material.emissionFactor?.value ?? null,
      material.emissionFactor?.unit ?? null,
    ])
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])));

  return JSON.stringify({
    id: mix.id,
    targetConcreteClass: mix.targetConcreteClass,
    targetAirContentPercent: mix.targetAirContentPercent ?? null,
    priceMode: mix.priceMode,
    readyMixPrice: mix.readyMixPrice?.value ?? null,
    materials,
  });
}

function wallInputFingerprint(input: RetainingWallInput): string {
  // Production scenarios deliberately normalize the final geotechnical
  // convention to a heel-edge vertical virtual plane (δ=0°, β=0°). Compare
  // the current editor state on the same runtime basis instead of by object
  // identity, otherwise every freshly calculated normalized scenario appears
  // stale merely because runEngine returns a new input object.
  return JSON.stringify({
    ...input,
    wallFrictionAngle: 0,
    backfillSoil: { ...input.backfillSoil, beta: 0 },
    foundationSoil: { ...input.foundationSoil, beta: 0 },
  });
}

function valueFingerprint(value: unknown): string {
  return JSON.stringify(value);
}

function SectionRow({ name, section }: { name: string; section: SectionDesign }) {
  const requiredKg = section.requiredRebarKgPerMeter ?? section.requiredAs * 1e-6 * 7850;
  const appliedKg = section.appliedRebarKgPerMeter ?? section.reinforcement.area * 1e-6 * 7850;
  return <div className="grid grid-cols-[0.85fr_1fr_1fr_1fr] items-center gap-3 border-b border-[var(--sf-divider)] py-2.5 last:border-0"><span className="text-xs font-semibold text-[var(--sf-text-primary)]">{name}</span><div><p className="text-xs text-[var(--sf-text-muted)]">ön kontrol talebi As</p><p className="font-mono text-xs text-[var(--sf-text-secondary)]">{fmt(section.requiredAs, 0)} <span className="text-[var(--sf-text-muted)]">mm²/m</span></p><p className="font-mono text-xs text-[var(--sf-text-muted)]">{fmt(requiredKg, 1)} kg/m</p></div><div><p className="text-xs text-[var(--sf-text-muted)]">seçilen düzen As</p><p className="font-mono text-xs font-medium text-[var(--sf-text-primary)]">{fmt(section.reinforcement.area, 0)} <span className="text-[var(--sf-text-muted)]">mm²/m</span></p><p className="font-mono text-xs text-[var(--sf-text-secondary)]">{fmt(appliedKg, 1)} kg/m</p></div><div className="text-right"><p className="font-mono text-xs text-[var(--sf-text-secondary)]">Ø{section.reinforcement.diameter} / {section.reinforcement.spacing} mm</p><p className="font-mono text-xs text-[var(--sf-text-muted)]">{fmt(section.reinforcement.count, 2)} adet/m · 1 m şerit</p><Status status={section.flexuralStatus} preliminaryRc /></div></div>;
}

function SoilLabel(type: string | undefined): string {
  return ({ granular: 'Granüler', clayey: 'Killi', silty: 'Siltli', rockfill: 'Kaya dolgu', custom: 'Özel / tanımsız' } as Record<string, string>)[type ?? 'custom'] ?? 'Özel / tanımsız';
}

export default function EngineeringResultsPanel({ projectName }: { projectName?: string }) {
  const { activeScenario, calculate, setConcreteMix, setActiveInputCategory, customCoefficients, geometryErrors, logistics, wallInput, concreteMix } = useRetainingWallStore();
  const [activeTab, setActiveTab] = useState<ResultTab>('overview');
  const [optimizationId, setOptimizationId] = useState(OPTIMIZATION_SCENARIOS[0]?.id ?? '');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scenario = activeScenario;
  const hasBlockingGeometry = geometryErrors.some((error) => error.severity === 'error');
  const scenarioIsStale = Boolean(scenario && (
    wallInputFingerprint(scenario.input) !== wallInputFingerprint(wallInput)
    || valueFingerprint(scenario.logistics) !== valueFingerprint(logistics)
    || mixFingerprint(scenario.concreteMix) !== mixFingerprint(concreteMix)
    || Object.entries(scenario.customCoefficients ?? {}).some(([key, value]) => customCoefficients.get(key) !== value)
    || customCoefficients.size !== Object.keys(scenario.customCoefficients ?? {}).length
  ));
  const resultsBlocked = hasBlockingGeometry || scenarioIsStale;
  const scenarioMix = scenario?.concreteMix ?? null;
  const isCustomRecipe = Boolean(
    scenarioMix
    && (
      scenarioMix.recipeMode === 'custom'
      || scenarioMix.id.startsWith('custom-')
      || scenarioMix.name.toLocaleLowerCase('tr-TR').includes('özel beton reçetesi')
    )
  );

  const activateTab = (tab: ResultTab) => {
    setActiveTab(tab);
    scrollContainerRef.current?.scrollTo({ top: 0 });
  };


  useEffect(() => {
    if (!isCustomRecipe) return;
    const frame = window.requestAnimationFrame(() => setOptimizationId('__custom__'));
    return () => window.cancelAnimationFrame(frame);
  }, [isCustomRecipe, scenarioMix?.id]);

  useEffect(() => {
    const captureWindow = window as Window & {
      __structflowCapture?: {
        openWorkspace?: () => void;
        showHub?: () => void;
        setInputCategory?: (category: 'geometry' | 'params' | 'logistics' | 'concrete' | 'rebar') => void;
        setResultTab?: (tab: ResultTab) => void;
      };
    };
    captureWindow.__structflowCapture = {
      ...captureWindow.__structflowCapture,
      setResultTab: (tab) => {
        if (tabs.some((candidate) => candidate.id === tab)) setActiveTab(tab);
      },
    };
  }, []);

  const zeroWasteImpact = useMemo(
    () => scenario ? calculateZeroWasteImpact(scenario) : null,
    [scenario],
  );
  const comparison = useMemo(() => {
    if (!scenario || !optimizationId || optimizationId === '__custom__') return null;
    try {
      return evaluateOptimizationScenario(optimizationId, scenario.concreteMix, scenario.quantities?.concreteVolume ?? 1, customCoefficients);
    } catch {
      return null;
    }
  }, [scenario, optimizationId, customCoefficients]);

  const customComparison = useMemo(() => {
    if (!scenario || !isCustomRecipe) return null;
    const volumeM3 = scenario.quantities?.concreteVolume ?? 1;
    const activeMix = scenario.concreteMix;
    const defaultReference = createDefaultConcreteMix(scenario.input.concreteClass);
    // Referansın bileşimi seçili beton sınıfının varsayılan reçetesidir ve sabit
    // tutulur. Yalnızca aynı fiyat / emisyon veri setini kullanması için aktif
    // projenin kullanıcı tanımlı tabloları referansa taşınır.
    const referenceMix = normalizeConcreteMix({
      ...defaultReference,
      prices: activeMix.prices ?? defaultReference.prices,
      emissionFactors: activeMix.emissionFactors ?? defaultReference.emissionFactors,
      priceMode: 'readyMix',
      readyMixPrice: activeMix.readyMixPrice ?? defaultReference.readyMixPrice,
    }, { projectConcreteVolumeM3: volumeM3 });
    const referenceMetrics = calculateMixMetrics(referenceMix, volumeM3);
    const activeMetrics = scenario.mixMetrics;
    const referenceCarbon = calculateMixCarbonKgM3(referenceMix, customCoefficients, volumeM3);
    const activeCarbon = calculateMixCarbonKgM3(activeMix, customCoefficients, volumeM3);
    // SCM/pozzolan replacement does not create a separate material-purchase
    // delta. Cost is the project ready-mix + logistics result; the replacement
    // quantities themselves affect carbon through amount × emission factor.
    const referenceCost = scenario.cost?.unitCostPerM3 ?? null;
    const activeCost = scenario.cost?.unitCostPerM3 ?? null;
    const referenceCement = amount(referenceMix, 'cement');
    const activeCement = amount(activeMix, 'cement');
    const cementReductionKgM3 = referenceCement - activeCement;
    const carbonSavingKgM3 = referenceCarbon.kgCo2eM3 == null || activeCarbon.kgCo2eM3 == null
      ? null
      : referenceCarbon.kgCo2eM3 - activeCarbon.kgCo2eM3;
    const carbonSavingPercent = carbonSavingKgM3 == null || referenceCarbon.kgCo2eM3 == null || referenceCarbon.kgCo2eM3 <= 0
      ? null
      : carbonSavingKgM3 / referenceCarbon.kgCo2eM3 * 100;
    const scmIncreaseKgM3 = referenceMetrics.totalScmKgM3 == null || activeMetrics.totalScmKgM3 == null
      ? null
      : activeMetrics.totalScmKgM3 - referenceMetrics.totalScmKgM3;
    const recycledAggregateIncreaseKgM3 = referenceMetrics.totalRecycledAggregateKgM3 == null || activeMetrics.totalRecycledAggregateKgM3 == null
      ? null
      : activeMetrics.totalRecycledAggregateKgM3 - referenceMetrics.totalRecycledAggregateKgM3;
    const activeMeasurement = (activeMix.compressiveStrengthMeasurements ?? []).find((measurement) => (
      Number.isFinite(measurement.valueMpa) && measurement.valueMpa > 0
    ));
    return {
      referenceMix,
      activeMix,
      referenceMetrics,
      activeMetrics,
      referenceCarbon,
      activeCarbon,
      referenceCost,
      activeCost,
      referenceCement,
      activeCement,
      cementReductionKgM3,
      carbonSavingKgM3,
      carbonSavingPercent,
      scmIncreaseKgM3,
      recycledAggregateIncreaseKgM3,
      activeMeasurement: activeMeasurement ?? null,
    };
  }, [scenario, isCustomRecipe, customCoefficients]);

  if (!scenario) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--sf-bg-app)] p-6 text-center">
        <div className="max-w-sm rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] p-5">
          <AlertTriangle className={`mx-auto size-6 ${hasBlockingGeometry ? 'text-[var(--sf-status-danger)]' : 'text-[var(--sf-status-warning)]'}`} />
          <h2 className="mt-3 text-sm font-semibold text-[var(--sf-text-primary)]">Sonuç üretilemedi</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--sf-text-muted)]">
            {hasBlockingGeometry
              ? 'Geometri hatalarını düzeltin. Geçersiz girdilerle sonuç veya dışa aktarım üretilmez.'
              : 'Geçerli bir hesap senaryosu oluştuğunda sonuçlar burada görünecek.'}
          </p>
        </div>
      </div>
    );
  }

  const q = scenario.quantities;
  const cost = scenario.cost;
  const emissions = scenario.emissions;
  const mix = scenario.concreteMix;
  const concreteCostPerM3 = cost?.concreteCostPerM3 ?? cost?.recipeCostPerM3 ?? null;
  const concreteCostPerMeter = cost?.concreteCostPerMeterWall ?? (cost?.concreteCost == null || q?.wallLength == null || q.wallLength <= 0 ? null : cost.concreteCost / q.wallLength);
  const totalCo2PerMeter = emissions?.grandTotalPerMeter ?? (emissions?.grandTotal == null || q?.wallLength == null || q.wallLength <= 0 ? null : emissions.grandTotal / q.wallLength);
  const totalCo2PerM3 = emissions?.grandTotal == null || q?.concreteVolume == null || q.concreteVolume <= 0 ? null : emissions.grandTotal / q.concreteVolume;
  const recipeMaterialEmissionExcludingSteel = emissions?.materials.totalEmission == null || emissions.materials.steel == null
    ? null
    : Math.max(0, emissions.materials.totalEmission - emissions.materials.steel);
  const siteEquipmentEmission = emissions
    ? Math.max(0, emissions.machinery.totalEmission - emissions.machinery.concreteMixer.emission - emissions.machinery.concretePump.emission)
    : null;
  const concreteDeliveryOperationEmission = emissions
    ? emissions.logistics.totalEmission + emissions.machinery.concreteMixer.emission + emissions.machinery.concretePump.emission
    : null;
  const balance = evaluateMixBalance(scenario.mixMetrics);
  const warnings = [...new Set([
    ...(geometryErrors ?? []).map((error) => error.message),
    ...(scenario.engineeringWarnings ?? []),
    ...(scenario.mixMetrics.warnings ?? []),
    ...(scenario.mixMetrics.errors ?? []),
    ...(balance.issues ?? []),
    ...(cost?.warnings ?? []),
    ...(emissions?.warnings ?? []),
    ...((emissions?.materials?.missingFactors?.length ?? 0) > 0 ? [`Emisyon faktörü eksik: ${emissions?.materials.missingFactors.join(', ')}`] : []),
    ...((cost?.missingPrices?.length ?? 0) > 0 ? [`Fiyat verisi eksik: ${cost?.missingPrices.join(', ')}`] : []),
    ...(!scenario.input.backfillSoil.type ? ['Arka dolgu zemin türü seçilmedi; sayısal parametreler özel zemin olarak yorumlanıyor.'] : []),
  ])];

  const applyOptimization = () => {
    if (!comparison) return;
    setConcreteMix(createCatalogConcreteMix(comparison.candidateDefinition, {
      ...mix,
      // Optimizasyonla reçete bileşimi değiştiği anda proje maliyeti de artık
      // malzeme dozajlarından hesaplanmalı. Aksi halde hazır beton C-sınıfı
      // fiyatı sabit kaldığı için Metraj & maliyet sekmesi değişmiyordu.
      priceMode: 'recipe',
      referenceMixId: comparison.scenario.referenceMixId,
    }));
    activateTab('sustainability');
  };

  const renderSummary = () => (
    <div className="space-y-3">
      <Panel title="Proje özeti" detail="Tüm değerler aktif geometri, aktif reçete ve toplam L uzunluğu üzerinden aynı hesap motorundan gelir.">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Toplam proje maliyeti" value={money(cost?.totalCost)} detail={`${money(cost?.unitCostPerMeterWall, 0)} / m duvar`} />
          <Metric label="Beton maliyeti" value={money(concreteCostPerM3)} unit="/ m³" detail={`Toplam ${money(cost?.concreteCost, 0)} · ${money(concreteCostPerMeter, 0)} / m`} />
          <Metric label="Toplam CO₂e" value={fmt(emissions?.grandTotal, 1)} unit="kgCO₂e" detail={`${fmt(totalCo2PerM3, 1)} kgCO₂e/m³ · ${fmt(totalCo2PerMeter, 1)} kgCO₂e/m`} />
          <Metric label="Beton hacmi" value={fmt(q?.concreteVolume, 2)} unit="m³" detail={`${fmt(q?.concreteVolumePerMeter, 3)} m³/m · L = ${fmt(q?.wallLength, 1)} m`} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[var(--sf-divider)] pt-2 text-xs
        "><span className="text-[var(--sf-text-muted)]">Aktif reçete</span><span className="text-right text-[var(--sf-text-primary)]">{mix.name}</span><span className="text-[var(--sf-text-muted)]">Beton sınıfı</span><span className="text-right font-mono text-[var(--sf-text-primary)]">{scenario.input.concreteClass} · hedef sabit</span></div>
      </Panel>

      <Panel title="1 m duvar ve toplam proje" detail="Birim değerler 1 m duvar şeridini, toplam değerler L = toplam duvar uzunluğunu gösterir.">
        <div className="overflow-hidden rounded-md border border-[var(--sf-border-subtle)]">
          <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]"><span>Kalem</span><span className="text-right">1 m duvar</span><span className="text-right">Toplam · L</span></div>
          {[
            ['Beton', `${fmt(q?.concreteVolumePerMeter, 3)} m³/m`, `${fmt(q?.concreteVolume, 3)} m³`],
            ['Donatı · uygulanan', `${fmt(q?.reinforcementWeightKgPerMeter, 2)} kg/m`, `${fmt(q?.reinforcementWeightKg ?? (q?.reinforcementWeightPerMeter ?? 0) * 1000 * (q?.wallLength ?? 0), 2)} kg`],
            ['Maliyet', `${money(cost?.unitCostPerMeterWall, 0)} / m`, `${money(cost?.totalCost, 0)}`],
            ['CO₂e', `${fmt(totalCo2PerMeter, 2)} kgCO₂e/m`, `${fmt(emissions?.grandTotal, 2)} kgCO₂e`],
          ].map(([label, perMeter, total]) => <div key={label} className="grid grid-cols-[1fr_1fr_1fr] border-b border-[var(--sf-divider)] px-2.5 py-2 last:border-0"><span className="text-xs text-[var(--sf-text-secondary)]">{label}</span><span className="text-right font-mono text-xs text-[var(--sf-text-primary)]">{perMeter}</span><span className="text-right font-mono text-xs text-[var(--sf-text-primary)]">{total}</span></div>)}
        </div>
        <div className="mt-2 flex items-start gap-2 text-xs leading-4 text-[var(--sf-text-muted)]"><Info className="mt-0.5 size-3 shrink-0 text-[var(--sf-status-info)]" />Gerekli donatı ayrıca “Donatı” sekmesinde talep olarak gösterilir; bu tabloda uygulanan çap/aralık düzeninin ağırlığı yer alır.</div>
      </Panel>

      <Panel title="Zemin ve yük etkisi" detail="Bu özet, kullanıcının girdiği zemin ve yüklerin basınç hesabına nasıl girdiğini gösterir.">
        <div className="grid grid-cols-2 gap-2"><Metric label="Arka dolgu" value={SoilLabel(scenario.input.backfillSoil.type)} detail={`γ ${fmt(scenario.input.backfillSoil.gamma, 1)} · φ ${fmt(scenario.input.backfillSoil.phi, 1)}° · c ${fmt(scenario.input.backfillSoil.c, 1)} kPa`} /><Metric label="Temel altı zemin" value={SoilLabel(scenario.input.foundationSoil.type)} detail={`γ ${fmt(scenario.input.foundationSoil.gamma, 1)} · φ ${fmt(scenario.input.foundationSoil.phi, 1)}° · c ${fmt(scenario.input.foundationSoil.c, 1)} kPa`} /><Metric label="Sürşarj" value={fmt(scenario.input.surchargeLoad, 1)} unit="kN/m²" detail="Pa ve stabilite taleplerini artırır" /></div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center"><div className="rounded border border-[var(--sf-border-subtle)] p-2"><p className="text-xs text-[var(--sf-text-muted)]">Ka</p><p className="font-mono text-xs text-[var(--sf-text-primary)]">{fmt(scenario.earthPressures?.Ka, 3)}</p></div><div className="rounded border border-[var(--sf-border-subtle)] p-2"><p className="text-xs text-[var(--sf-text-muted)]">Pa</p><p className="font-mono text-xs text-[var(--sf-text-primary)]">{fmt(scenario.earthPressures?.Pa, 2)} kN/m</p></div><div className="rounded border border-[var(--sf-border-subtle)] p-2"><p className="text-xs text-[var(--sf-text-muted)]">q</p><p className="font-mono text-xs text-[var(--sf-text-primary)]">{fmt(scenario.input.surchargeLoad, 1)} kN/m²</p></div></div>
      </Panel>

      <Panel title="Stabilite ve veri durumu">
        <div className="space-y-2">{scenario.stability && [['Kayma', scenario.stability.sliding], ['Devrilme', scenario.stability.overturning], ['Taşıma gücü', scenario.stability.bearingCapacity]].map(([label, check]) => <div key={label as string} className="flex items-center justify-between border-b border-[var(--sf-divider)] pb-2 last:border-0 last:pb-0"><span className="text-xs text-[var(--sf-text-secondary)]">{label as string}</span><span className="font-mono text-xs text-[var(--sf-text-secondary)]">FS {fmt((check as { factorOfSafety: number }).factorOfSafety, 2)} <span className="mx-1 text-[var(--sf-text-muted)]">/</span> {fmt((check as { requiredFS: number }).requiredFS, 2)}</span><Status status={(check as { status: SafetyStatus }).status} /></div>)}</div>
        {warnings.length > 0 ? <div className="mt-3 flex items-start gap-2 rounded-md border border-[var(--sf-status-warning)] bg-[var(--sf-status-warning-bg)] px-2.5 py-2 text-xs leading-4 text-[var(--sf-status-warning)]"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><span className="min-w-0 flex-1"><span className="font-semibold">{warnings.length} veri uyarısı:</span> {warnings.slice(0, 2).join(' · ')}{warnings.length > 2 ? ' …' : ''}</span><button type="button" onClick={() => setActiveInputCategory((geometryErrors ?? []).length > 0 ? 'geometry' : 'concrete')} className="shrink-0 rounded border border-current/35 bg-[var(--sf-bg-input)] px-2 py-1 text-xs font-semibold transition-colors hover:bg-[var(--sf-bg-hover)]">Girdilere git</button></div> : <div className="mt-3 flex items-center gap-2 text-xs text-[var(--sf-status-success)]"><CheckCircle2 className="size-3.5" /> Aktif sonuçlarda veri uyarısı yok.</div>}
      </Panel>
      {zeroWasteImpact && <ZeroWasteSummaryCard impact={zeroWasteImpact} onOpen={() => activateTab('sustainability')} />}
    </div>
  );

  const renderRebar = () => {
    const requiredPerM = q?.reinforcementRequiredKgPerMeter ?? null;
    const appliedPerM = q?.reinforcementWeightKgPerMeter ?? (q?.reinforcementWeightPerMeter == null ? null : q.reinforcementWeightPerMeter * 1000);
    const requestedDose = q?.reinforcementMode === 'custom' ? q.reinforcementRequestedRatioKgM3 : null;
    const sectionWarnings = [...new Set([
      ...(scenario.internalStability?.stem.warnings ?? []),
      ...(scenario.internalStability?.toe.warnings ?? []),
      ...(scenario.internalStability?.heel.warnings ?? []),
    ])];
    const actionableSectionWarnings = sectionWarnings.filter((warning) => (
      !warning.includes('kapsamında ön boyutlandırmadır')
      && !warning.includes('donatı kütlesi ana + dağıtma donatısının')
    ));
    return <div className="space-y-3"><Panel title="Betonarme ön kontrolü · talep / seçilen düzen" detail="ACI CODE-318-25 referanslı bu ekran ön boyutlandırma taramasıdır; tam dayanım, servisabilite, deprem ve detaylandırma uygunluk beyanı değildir. As ve kg/m değerleri kesit çizim düzlemine dik 1,00 m duvar şeridine aittir; proje toplamı kg/m × L ile elde edilir."><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><Metric label="Ön kontrol talebi · 1 m şerit" value={fmt(requiredPerM, 2)} unit="kg/m" detail={`Toplam = ${fmt(requiredPerM, 2)} × ${fmt(q?.wallLength, 2)} = ${fmt(q?.reinforcementRequiredKg, 2)} kg`} /><Metric label="Seçilen düzen · 1 m şerit" value={fmt(appliedPerM, 2)} unit="kg/m" detail={`Toplam = ${fmt(appliedPerM, 2)} × ${fmt(q?.wallLength, 2)} = ${fmt(q?.reinforcementWeightKg, 2)} kg`} />{requestedDose != null && <Metric label="Kullanıcı uygulama hedefi" value={fmt(requestedDose, 1)} unit="kg/m³ beton" detail="Ön kontrol talebi bu hedefin altına düşmez." />}</div><div className="mt-3 overflow-hidden rounded-md border border-[var(--sf-border-subtle)]"><div className="grid grid-cols-[0.85fr_1fr_1fr_1fr] gap-2 bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]"><span>Kesit</span><span>Ön kontrol talebi</span><span>Seçilen düzen</span><span className="text-right">Ön kontrol durumu</span></div>{scenario.internalStability && <div className="px-2.5"><SectionRow name="Gövde" section={scenario.internalStability.stem} /><SectionRow name="Burun" section={scenario.internalStability.toe} /><SectionRow name="Topuk" section={scenario.internalStability.heel} /></div>}</div>{actionableSectionWarnings.length > 0 && <div className="mt-3 rounded-md border border-[var(--sf-status-warning)] bg-[var(--sf-status-warning-bg)] px-2.5 py-2 text-xs text-[var(--sf-status-warning)]"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold">Donatı ön kontrolünde müdahale gereken {actionableSectionWarnings.length} bulgu var.</p><ul className="mt-1 space-y-1">{actionableSectionWarnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></div><button type="button" onClick={() => setActiveInputCategory('rebar')} className="shrink-0 rounded border border-current/35 bg-[var(--sf-bg-input)] px-2 py-1 text-xs font-semibold transition-colors hover:bg-[var(--sf-bg-hover)]">Donatı girdilerine git</button></div></div>}</Panel><Panel title="Betonarme ön kontrol notları"><div className="mb-2 rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs leading-4 text-[var(--sf-text-secondary)]">Buradaki “ön kontrol: uygun” ifadesi tam ACI CODE-318-25 uygunluğu anlamına gelmez. Nihai projede tüm dayanım, servisabilite, deprem, ankraj/bindirme ve detaylandırma koşulları ayrıca doğrulanmalıdır.</div><ul className="space-y-1 text-xs leading-4 text-[var(--sf-text-secondary)]">{(q?.reinforcementWarnings?.length ? q.reinforcementWarnings : ['Çap, aralık, pas payı ve malzeme dayanımları betonarme ön kontrolünde kullanıldı.']).map((warning) => <li key={warning} className="flex gap-2"><span className="text-[var(--sf-text-muted)]">•</span><span>{warning}</span></li>)}</ul></Panel></div>;
  };

  const renderMaterials = () => <div className="space-y-3"><Panel title="Aktif malzeme tüketimi" detail={`Aktif reçete: ${mix.name} · sonuçlar ${fmt(q?.concreteVolume, 2)} m³ toplam beton için.`}><div className="overflow-hidden rounded-md border border-[var(--sf-border-subtle)]"><div className="grid grid-cols-[1.2fr_0.8fr_0.9fr] gap-2 bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]"><span>Malzeme</span><span className="text-right">kg/m³</span><span className="text-right">toplam kg</span></div>{mix.materials.filter((item) => item.enabled).map((item) => <div key={item.id} className="grid grid-cols-[1.2fr_0.8fr_0.9fr] gap-2 border-b border-[var(--sf-divider)] px-2.5 py-2 last:border-0"><span className="truncate text-xs text-[var(--sf-text-secondary)]">{item.name}</span><span className="text-right font-mono text-xs text-[var(--sf-text-primary)]">{fmt(item.canonicalKgPerM3, 2)}</span><span className="text-right font-mono text-xs text-[var(--sf-text-primary)]">{fmt(item.canonicalKgPerM3 == null || q?.concreteVolume == null ? null : item.canonicalKgPerM3 * q.concreteVolume, 1)}</span></div>)}</div></Panel><Panel title="Reçete kontrolü"><div className="grid grid-cols-2 gap-2"><Metric label="Bağlayıcı" value={fmt(scenario.mixMetrics.totalBinderKgM3, 1)} unit="kg/m³" /><Metric label="SCM / ikincil bağlayıcı" value={fmt(scenario.mixMetrics.totalScmKgM3, 1)} unit="kg/m³" /><Metric label="Geri dönüştürülmüş agrega" value={fmt(scenario.mixMetrics.totalRecycledAggregateKgM3, 1)} unit="kg/m³" /><Metric label="Su/bağlayıcı" value={fmt(scenario.mixMetrics.waterBinderRatio, 3)} tone={scenario.mixMetrics.waterBinderRatio != null && scenario.mixMetrics.waterBinderRatio > 0.7 ? 'danger' : 'default'} /><Metric label="Hava hedefi" value={mix.targetAirContentPercent == null ? '—' : fmt(mix.targetAirContentPercent, 1)} unit={mix.targetAirContentPercent == null ? undefined : '%'} detail="Dozajdan ayrı reçete hedefi" /></div></Panel></div>;

  const renderMixComparison = () => {
    if (optimizationId === '__custom__' && customComparison) {
      const referenceCost = customComparison.referenceCost;
      const activeCost = customComparison.activeCost;
      const costDelta = percentChange(activeCost, referenceCost);
      const activeStrength = customComparison.activeMeasurement;
      const activeStrengthText = activeStrength
        ? `${fmt(activeStrength.valueMpa, 1)} MPa${activeStrength.ageDays == null ? '' : ` · ${activeStrength.ageDays} gün`}`
        : 'Deneysel doğrulama yok';

      return (
        <div className="space-y-3">
          <Panel
            title="Referans ↔ aktif özel reçete"
            detail={`Referans, ${scenario.input.concreteClass} sınıfının varsayılan beton içeriğidir ve değiştirilmez. Kullanıcının oluşturduğu özel reçete bununla karşılaştırılır.`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <select
                value={optimizationId}
                onChange={(event) => setOptimizationId(event.target.value)}
                className="h-8 min-w-0 flex-1 rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-input)] px-2 text-xs font-semibold text-[var(--sf-text-primary)] outline-none focus:border-[var(--sf-border-active)]"
              >
                <option value="__custom__" className="bg-[var(--sf-bg-input)] text-[var(--sf-text-primary)]">Custom / Özel reçete · {mix.name}</option>
                {OPTIMIZATION_SCENARIOS.map((item) => (
                  <option key={item.id} value={item.id} className="bg-[var(--sf-bg-input)] text-[var(--sf-text-primary)]">{item.shortTitle} · {item.title}</option>
                ))}
              </select>
              <button
                type="button"
                disabled
                className="h-8 shrink-0 cursor-default rounded-md border border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] px-2.5 text-xs font-semibold text-[var(--sf-text-primary)] opacity-80"
              >
                Aktif reçete
              </button>
            </div>

            <div className="mb-3 flex items-center justify-between rounded-md border border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] px-2.5 py-2 text-xs">
              <div>
                <p className="font-semibold text-[var(--sf-text-secondary)]">Custom / Özel reçete seçili</p>
                <p className="mt-0.5 text-xs text-[var(--sf-text-muted)]">{mix.name}</p>
              </div>
              <span className="rounded border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-2 py-1 font-mono text-xs text-[var(--sf-text-secondary)]">Referans: Varsayılan {scenario.input.concreteClass}</span>
            </div>

            <div className="overflow-hidden rounded-md border border-[var(--sf-border-subtle)]">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]">
                <span>Gösterge</span>
                <span className="text-right">Referans · varsayılan</span>
                <span className="text-right">Aktif · Custom</span>
              </div>
              {[
                ['Çimento', `${fmt(customComparison.referenceCement, 1)} kg/m³`, `${fmt(customComparison.activeCement, 1)} kg/m³`],
                ['SCM / mineral katkı', `${fmt(customComparison.referenceMetrics.totalScmKgM3, 1)} kg/m³`, `${fmt(customComparison.activeMetrics.totalScmKgM3, 1)} kg/m³`],
                ['Geri dönüştürülmüş agrega', `${fmt(customComparison.referenceMetrics.totalRecycledAggregateKgM3, 1)} kg/m³`, `${fmt(customComparison.activeMetrics.totalRecycledAggregateKgM3, 1)} kg/m³`],
                ['CO₂e', `${fmt(customComparison.referenceCarbon.kgCo2eM3, 1)} kg/m³`, `${fmt(customComparison.activeCarbon.kgCo2eM3, 1)} kg/m³`],
                ['Proje birim maliyeti', `${money(referenceCost, 0)} / m³`, `${money(activeCost, 0)} / m³`],
                ['Dayanım', `Hedef ${scenario.input.concreteClass}`, activeStrengthText],
              ].map(([label, ref, active]) => (
                <div key={label} className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 border-b border-[var(--sf-divider)] px-2.5 py-2 last:border-0">
                  <span className="text-xs text-[var(--sf-text-secondary)]">{label}</span>
                  <span className="text-right font-mono text-xs text-[var(--sf-text-secondary)]">{ref}</span>
                  <span className="text-right font-mono text-xs text-[var(--sf-text-primary)]">{active}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric
                label="Çimento değişimi"
                value={fmt(customComparison.cementReductionKgM3, 1)}
                unit="kg/m³"
                tone={customComparison.cementReductionKgM3 >= 0 ? 'success' : 'warning'}
                detail={customComparison.referenceCement > 0 ? pct(customComparison.cementReductionKgM3 / customComparison.referenceCement * 100) : '—'}
              />
              <Metric
                label="CO₂ değişimi"
                value={fmt(customComparison.carbonSavingKgM3, 1)}
                unit="kgCO₂e/m³"
                tone={customComparison.carbonSavingKgM3 != null && customComparison.carbonSavingKgM3 >= 0 ? 'success' : 'warning'}
                detail={pct(customComparison.carbonSavingPercent)}
              />
              <Metric
                label="Maliyet değişimi"
                value={costDelta == null ? '—' : `${costDelta > 0 ? '+' : ''}${fmt(costDelta, 1)}%`}
                tone={costDelta != null && costDelta <= 0 ? 'success' : 'warning'}
                detail="İkame malzemesi için ayrı satın alma maliyeti uygulanmaz"
              />
              <Metric
                label="İkincil malzeme artışı"
                value={fmt(customComparison.scmIncreaseKgM3, 1)}
                unit="kg/m³"
                detail={`Geri dönüştürülmüş agrega ${customComparison.recycledAggregateIncreaseKgM3 != null && customComparison.recycledAggregateIncreaseKgM3 >= 0 ? '+' : ''}${fmt(customComparison.recycledAggregateIncreaseKgM3, 1)} kg/m³`}
              />
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-md border border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] px-2.5 py-2 text-xs leading-4 text-[var(--sf-text-secondary)]">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>Özel reçete aktif tasarımdır. Referans reçetenin malzeme içeriği değiştirilmez; seçili {scenario.input.concreteClass} sınıfının varsayılan beton bileşimi sabit karşılaştırma tabanıdır.</span>
            </div>
          </Panel>

          <Panel title="Optimizasyon seçenekleri" detail="İsterseniz özel reçeteyi bırakmadan önce katalog alternatiflerini görüntüleyebilir; birini seçip uygulayabilirsiniz.">
            <p className="text-xs leading-4 text-[var(--sf-text-secondary)]">Yukarıdaki listeden GGBFS, metakaolin, silis dumanı, hibrit SCM veya RCA alternatifini seçtiğinizde bu ekran ilgili optimizasyon karşılaştırmasına geçer. Custom seçeneği mevcut kullanıcı reçetesini temsil eder.</p>
          </Panel>
        </div>
      );
    }

    const reference = comparison;
    // İkame reçeteleri maliyette ayrı malzeme alımı olarak fiyatlanmaz. Her iki
    // alternatif aynı proje hazır-beton/lojistik maliyet tabanını kullanır.
    const referenceCost = reference ? scenario.cost?.unitCostPerM3 ?? null : null;
    const activeCost = reference ? scenario.cost?.unitCostPerM3 ?? null : null;
    const activeCement = reference?.candidateMix.materials.find((item) => item.id === 'cement')?.canonicalKgPerM3 ?? null;
    const referenceCement = reference?.referenceMix.materials.find((item) => item.id === 'cement')?.canonicalKgPerM3 ?? null;
    const costDelta = percentChange(activeCost, referenceCost);
    const optimization = comparison;
    return <div className="space-y-3"><Panel title="Referans ↔ önerilen alternatif" detail={`Beton sınıfı karşılaştırma boyunca ${scenario.input.concreteClass} hedefinde sabit kalır. İkame malzemelerinde CO₂e miktar × emisyon faktörü ile hesaplanır; ayrı malzeme satın alma maliyeti uygulanmaz.`}><div className="mb-3 flex items-center justify-between gap-2"><select value={optimizationId} onChange={(event) => setOptimizationId(event.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-input)] px-2 text-xs text-[var(--sf-text-primary)]">{isCustomRecipe && <option value="__custom__">Custom / Özel reçete · {mix.name}</option>}{OPTIMIZATION_SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.shortTitle} · {item.title}</option>)}</select><button type="button" onClick={applyOptimization} disabled={!optimization} className="h-8 shrink-0 rounded-md border border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] px-2.5 text-xs font-semibold text-[var(--sf-text-primary)] disabled:cursor-not-allowed disabled:opacity-40">Alternatifi uygula</button></div>{reference ? <><div className="overflow-hidden rounded-md border border-[var(--sf-border-subtle)]"><div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]"><span>Gösterge</span><span className="text-right">Referans</span><span className="text-right">Önerilen alternatif</span></div>{[['Çimento', `${fmt(referenceCement, 1)} kg/m³`, `${fmt(activeCement, 1)} kg/m³`], ['CO₂e', `${fmt(reference.referenceCarbon.kgCo2eM3, 1)} kg/m³`, `${fmt(reference.candidateCarbon.kgCo2eM3, 1)} kg/m³`], ['Proje birim maliyeti', `${money(referenceCost, 0)} / m³`, `${money(activeCost, 0)} / m³`], ['Dayanım', `${fmt(reference.referenceDefinition.measuredStrengthMpa, 1)} MPa`, `${fmt(reference.candidateDefinition.measuredStrengthMpa, 1)} MPa`], ['Geri dönüştürülmüş agrega', `${fmt(reference.referenceMetrics.totalRecycledAggregateKgM3, 1)} kg/m³`, `${fmt(reference.candidateMetrics.totalRecycledAggregateKgM3, 1)} kg/m³`]].map(([label, ref, active]) => <div key={label} className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 border-b border-[var(--sf-divider)] px-2.5 py-2 last:border-0"><span className="text-xs text-[var(--sf-text-secondary)]">{label}</span><span className="text-right font-mono text-xs text-[var(--sf-text-secondary)]">{ref}</span><span className="text-right font-mono text-xs text-[var(--sf-text-primary)]">{active}</span></div>)}</div><div className="mt-3 grid grid-cols-2 gap-2"><Metric label="Çimento değişimi" value={fmt(reference.cementReductionKgM3, 1)} unit="kg/m³" tone={reference.cementReductionKgM3 >= 0 ? 'success' : 'warning'} detail={pct(reference.cementReductionPercent)} /><Metric label="CO₂ değişimi" value={fmt(reference.carbonSavingKgM3, 1)} unit="kgCO₂e/m³" tone={reference.carbonSavingKgM3 != null && reference.carbonSavingKgM3 >= 0 ? 'success' : 'warning'} detail={pct(reference.carbonSavingPercent)} /><Metric label="Maliyet değişimi" value={costDelta == null ? '—' : `${costDelta > 0 ? '+' : ''}${fmt(costDelta, 1)}%`} tone={costDelta != null && costDelta <= 0 ? 'success' : 'warning'} detail="İkame malzemesi için ayrı satın alma maliyeti uygulanmaz" /><Metric label="İkincil malzeme artışı" value={fmt(reference.scmIncreaseKgM3, 1)} unit="kg/m³" detail={`Geri dönüştürülmüş agrega +${fmt(reference.recycledAggregateIncreaseKgM3, 1)} kg/m³`} /></div><div className="mt-3 flex items-start gap-2 rounded-md border border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] px-2.5 py-2 text-xs leading-4 text-[var(--sf-text-secondary)]"><Info className="mt-0.5 size-3.5 shrink-0" /><span>Uçucu kül, GGBFS, silis dumanı ve benzeri ikame malzemeleri kendi emisyon katsayılarıyla CO₂ hesabına girer. Maliyet etkisi reçete fiyatından değil, proje lojistik girdilerinden gelir.</span></div></> : <p className="text-xs text-[var(--sf-text-muted)]">Karşılaştırma verisi hazırlanamadı.</p>}</Panel><Panel title="Optimizasyon kuralı"><div className="space-y-1.5 text-xs leading-4 text-[var(--sf-text-secondary)]"><p>1. {scenario.input.concreteClass} hedefi korunur.</p><p>2. Çimento azaltılır; uçucu kül, cüruf, silis dumanı, metakaolin veya geri dönüştürülmüş agrega aktif reçeteye eklenir.</p><p>3. İkame malzemelerinin CO₂ etkisi miktar × emisyon katsayısı ile hesaplanır; maliyet etkisi yalnız lojistik girdilerinden gelir.</p></div></Panel></div>;
  };

  const renderStability = () => {
    const checks: Array<[string, StabilityCheck]> = scenario.stability ? [
      ['Kayma', scenario.stability.sliding],
      ['Devrilme', scenario.stability.overturning],
      ['Taşıma gücü · Terzaghi', scenario.stability.bearingCapacity],
    ] : [];
    return (
      <div className="space-y-3">
        <Panel title="Dış stabilite" detail="Yanal toprak basıncı Coulomb; taşıma gücü Terzaghi ile değerlendirilir. Motorun ürettiği hesap adımları her kontrolün altında açılabilir.">
          <div className="space-y-3">
            {checks.map(([label, check]) => (
              <div key={label} className="rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[var(--sf-text-primary)]">{label}</p>
                    <p className="mt-1 text-xs text-[var(--sf-text-muted)]">Gerekli FS {fmt(check.requiredFS, 2)}</p>
                  </div>
                  <p className="font-mono text-base font-semibold text-[var(--sf-text-primary)]">{fmt(check.factorOfSafety, 2)}</p>
                  <Status status={check.status} />
                </div>
                <CalculationDetails steps={check.steps} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Zemin basıncı" detail="Final aktif model topuk ucunda düşey sanal düzlem kullanır; δ=0° ve β=0° sabittir. Bu nedenle faydalı Paᵥ düşey bileşeni hesaba katılmaz.">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Ka" value={fmt(scenario.earthPressures?.Ka, 3)} />
            <Metric label="Kp" value={fmt(scenario.earthPressures?.Kp, 3)} />
            <Metric label="Pa yatay" value={fmt(scenario.earthPressures?.Pa_h, 2)} unit="kN/m" />
            <Metric label="Pa düşey · final model" value={fmt(scenario.earthPressures?.Pa_v, 2)} unit="kN/m" detail="δ=0° sanal düzlem konvansiyonunda 0 kabul edilir" />
            <Metric label="Aktif sanal düzlem" value="Topuk ucunda düşey" detail="Final benchmark konvansiyonu" />
            <Metric label="δ / β" value="0° / 0°" detail="Aktif modelde kilitli" />
          </div>
        </Panel>
        {(scenario.stability?.warnings?.length ?? 0) > 0 && (
          <Panel title="Model varsayımları" detail="Bunlar veri hatası değil, dış stabilite hesabında açıkça kullanılan tasarım kabulleridir.">
            <ul className="space-y-1.5 text-xs leading-5 text-[var(--sf-text-secondary)]">
              {scenario.stability?.warnings?.map((warning) => (
                <li key={warning} className="flex gap-2"><span className="text-[var(--sf-text-muted)]">•</span><span>{warning}</span></li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    );
  };

  const renderCost = () => <div className="space-y-3"><Panel title="Maliyet özeti" detail="Beton maliyeti TL/m³, proje maliyeti ise toplam L uzunluğu ve tüm iş kalemleri üzerinden ayrıdır."><div className="grid grid-cols-2 gap-2"><Metric label="Toplam proje maliyeti" value={money(cost?.totalCost)} /><Metric label="Toplam maliyet" value={money(cost?.unitCostPerMeterWall, 0)} unit="/ m" /><Metric label="Aktif beton" value={money(concreteCostPerM3, 0)} unit="/ m³" /><Metric label="Beton toplam" value={money(cost?.concreteCost, 0)} /></div><div className="mt-3 space-y-2">{[['Beton', cost?.concreteCost], ['Donatı', cost?.rebarCost], ['Kazı', cost?.excavationCost], ['Dolgu', cost?.backfillCost], ['Kalıp', cost?.formworkCost], ['Donatı işçilik', cost?.rebarLaborCost], ['Nakliye', cost?.transportCost], ['Yakıt / makine', cost?.fuelCost]].map(([label, value]) => <div key={label as string} className="flex justify-between border-b border-[var(--sf-divider)] pb-1.5 text-xs last:border-0"><span className="text-[var(--sf-text-muted)]">{label as string}</span><span className="font-mono text-[var(--sf-text-primary)]">{money(value as number | null)}</span></div>)}</div></Panel><Panel title="Fiyat veri durumu"><div className="flex items-start gap-2 text-xs leading-4 text-[var(--sf-text-secondary)]"><Info className="mt-0.5 size-3.5 shrink-0 text-[var(--sf-status-info)]" />Malzeme fiyatları Reçete → Fiyat sekmesinden görülebilir ve değiştirilebilir. Kaynak/tarih gibi ikincil alanlar ilgili ⓘ bilgi alanında tutulur.</div></Panel></div>;

  const renderConcreteContents = () => {
    const emissionByMaterial = new Map((emissions?.materials?.byMaterial ?? []).map((item) => [item.id, item]));
    const activeConcreteMaterials = mix.materials.filter((item) => item.enabled && (item.canonicalKgPerM3 ?? 0) > 0);
    return (
      <Panel title="Aktif beton içeriği" detail="Maliyet ve emisyon değerleri aynı aktif reçeteden okunur. İkame malzemelerinin varsayılan satın alma maliyeti 0 TL/kg olabilir; emisyonları miktar × emisyon faktörü ile hesaba girer.">
        <div className="overflow-x-auto rounded-md border border-[var(--sf-border-subtle)]">
          <div className="min-w-[650px]">
            <div className="grid grid-cols-[1.5fr_0.8fr_0.9fr_0.9fr_0.9fr] gap-2 bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]"><span>Malzeme</span><span className="text-right">kg/m³</span><span className="text-right">Fiyat</span><span className="text-right">EF</span><span className="text-right">CO₂e/m³</span></div>
            {activeConcreteMaterials.map((item) => {
              const emissionRow = emissionByMaterial.get(item.id);
              const price = item.price ?? mix.prices?.[item.id] ?? getDefaultMaterialPrice(item.id);
              return <div key={item.id} className="grid grid-cols-[1.5fr_0.8fr_0.9fr_0.9fr_0.9fr] gap-2 border-b border-[var(--sf-divider)] px-2.5 py-2 last:border-0"><span className="truncate text-xs text-[var(--sf-text-secondary)]" title={item.name}>{item.name}</span><span className="text-right font-mono text-xs text-[var(--sf-text-primary)]">{fmt(item.canonicalKgPerM3, 2)}</span><span className="text-right font-mono text-xs text-[var(--sf-text-primary)]">{price?.value == null ? '—' : fmt(price.value, 3) + ' ' + price.unit}</span><span className="text-right font-mono text-xs text-[var(--sf-text-primary)]">{fmt(emissionRow?.factorKgCo2ePerKg, 4)}</span><span className="text-right font-mono text-xs text-[var(--sf-text-primary)]">{fmt(emissionRow?.emissionKgCo2eM3, 2)}</span></div>;
            })}
          </div>
        </div>
        <div className="mt-2 flex items-start gap-2 text-xs leading-4 text-[var(--sf-text-muted)]"><Info className="mt-0.5 size-3 shrink-0 text-[var(--sf-status-info)]" />Uçucu kül, GGBFS, silis dumanı, metakaolin ve geri dönüştürülmüş agrega için 0 TL/kg varsayılanı yalnız satın alma maliyetine aittir; emisyon katsayıları sıfır değildir ve lojistik mesafesi ayrıca maliyete girer.</div>
      </Panel>
    );
  };
  const renderLogistics = () => <div className="space-y-3"><Panel title="Lojistik özeti" detail="Mesafe, taşıma ve şantiye makinesi sonuçları aktif geometri üzerinden hesaplanır."><div className="grid grid-cols-2 gap-2"><Metric label="Nakliye maliyeti" value={money(cost?.transportCost)} /><Metric label="Yakıt / makine" value={money(cost?.fuelCost)} /><Metric label="Lojistik CO₂e" value={fmt(emissions?.logistics?.totalEmission, 1)} unit="kg" /><Metric label="Şantiye yakıtı" value={fmt(emissions?.machinery?.totalFuel, 1)} unit="L" /></div><div className="mt-3 overflow-hidden rounded-md border border-[var(--sf-border-subtle)]"><div className="grid grid-cols-[1fr_90px] gap-2 bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]"><span>Güzergâh</span><span className="text-right">Mesafe</span></div>{[['Beton santrali', logistics.distancePlant], ['Donatı tedarikçisi', logistics.distanceRebar], ['Döküm sahası', logistics.distanceDump]].map(([label, value]) => <div key={label as string} className="grid grid-cols-[1fr_90px] gap-2 border-b border-[var(--sf-divider)] px-2.5 py-2 last:border-0"><span className="text-xs text-[var(--sf-text-secondary)]">{label as string}</span><span className="text-right font-mono text-xs text-[var(--sf-text-primary)]">{fmt(value as number, 1)} km</span></div>)}</div></Panel></div>;

  const renderCarbon = () => (
    <div className="space-y-3">
      <Panel title="Karbon özeti" detail="Kırılım kalemleri birbirini dışlar; aynı emisyon hiçbir satırda iki kez sayılmaz.">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Toplam" value={fmt(emissions?.grandTotal, 1)} unit="kgCO₂e" />
          <Metric label="1 m duvar" value={fmt(totalCo2PerMeter, 1)} unit="kgCO₂e/m" />
          <Metric label="Beton hacmi başına" value={fmt(totalCo2PerM3, 1)} unit="kgCO₂e/m³" />
          <Metric label="Veri durumu" value={emissions?.dataComplete ? 'Tam' : 'Eksik'} tone={emissions?.dataComplete ? 'success' : 'warning'} />
        </div>
        <div className="mt-4 overflow-hidden rounded-md border border-[var(--sf-border-subtle)]">
          {[
            ['Reçete malzemeleri · çelik hariç', recipeMaterialEmissionExcludingSteel, 'Beton reçetesindeki bağlayıcı, agrega, su ve katkılar'],
            ['Donatı çeliği', emissions?.materials?.steel, 'Donatı üretim emisyonu'],
            ['Saha ekipmanı · mikser/pompa hariç', siteEquipmentEmission, 'Kazı, taşıma, sıkıştırma ve diğer saha makinesi'],
            ['Beton teslimi + döküm operasyonu', concreteDeliveryOperationEmission, 'Beton lojistiği ile mikser ve pompa operasyonu'],
          ].map(([label, value, detail]) => (
            <div key={label as string} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--sf-divider)] px-3 py-3 last:border-0">
              <div><p className="text-xs font-medium text-[var(--sf-text-secondary)]">{label as string}</p><p className="mt-1 text-xs text-[var(--sf-text-muted)]">{detail as string}</p></div>
              <span className="self-center font-mono text-xs font-semibold text-[var(--sf-text-primary)]">{fmt(value as number | null | undefined, 1)} kgCO₂e</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Eksik emisyon verisi">
        <div className="text-xs leading-5 text-[var(--sf-text-secondary)]">{emissions?.dataComplete ? <span className="inline-flex items-center gap-2 text-[var(--sf-status-success)]"><CheckCircle2 className="size-3.5" />Emisyon faktörleri ve miktarlar tamam.</span> : <span className="inline-flex items-center gap-2 text-[var(--sf-status-warning)]"><AlertTriangle className="size-3.5" />Eksik faktör/miktar varsa toplam sonuç “—” olarak korunur; eksik veri uydurulmaz.</span>}</div>
      </Panel>
    </div>
  );

  const content: Record<ResultTab, ReactNode> = {
    overview: <div className="space-y-4"><AreaHeading title="Genel Bakış" detail="Aktif tasarımın güvenlik, metraj, maliyet ve çevresel performans karar özeti." />{renderSummary()}</div>,
    engineering: <div className="space-y-4"><AreaHeading title="Mühendislik" detail="Coulomb yanal toprak basıncı, Terzaghi taşıma gücü ve ACI CODE-318-25 referanslı betonarme ön kontrol taraması." />{renderStability()}{renderRebar()}</div>,
    sustainability: <div className="space-y-4"><AreaHeading title="Sürdürülebilirlik" detail="Aktif beton reçetesi, alternatif mineral/ikincil malzemeler, Sıfır Atık metrikleri ve CO₂e kırılımı." />{renderMaterials()}{renderMixComparison()}{zeroWasteImpact && <ZeroWastePanel impact={zeroWasteImpact} />}{renderCarbon()}</div>,
    'cost-logistics': <div className="space-y-4"><AreaHeading title="Maliyet & Lojistik" detail="Proje maliyeti, birim metrajlar, tedarik mesafeleri ve saha lojistiği." />{renderCost()}{renderConcreteContents()}{renderLogistics()}</div>,
  };

  const blockedMessage = hasBlockingGeometry
    ? 'Geometri geçersiz. Önceki senaryo ekranda kullanılmaz ve dışa aktarım kilitlenir; hatalı girdileri düzeltin.'
    : 'Girdiler son hesap senaryosundan farklı. Sonuçlar ve dışa aktarım güncel bir hesap oluşana kadar kilitli.';

  return (
    <div className="sf-engineering-tabular flex h-full min-h-0 flex-col bg-[var(--sf-bg-app)] text-[var(--sf-text-primary)]">
      <div className="shrink-0 border-b border-[var(--sf-border-subtle)] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-text-muted)]">Sonuçlar</p>
            <h1 className="mt-1 text-base font-semibold">Aktif tasarım</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={resultsBlocked} title={resultsBlocked ? 'Geçersiz veya güncel olmayan sonuç dışa aktarılamaz' : 'Excel dışa aktar'} onClick={() => { if (!resultsBlocked) void exportScenarioToExcel(scenario); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] px-2.5 text-xs font-medium text-[var(--sf-text-secondary)] hover:border-[var(--sf-border-active)] hover:text-[var(--sf-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"><Download className="size-3.5" />Excel</button>
            <button type="button" disabled={resultsBlocked} title={resultsBlocked ? 'Geçersiz veya güncel olmayan sonuç dışa aktarılamaz' : 'PDF dışa aktar'} onClick={() => { if (!resultsBlocked) void exportScenarioToPdf(scenario, { projectName }).catch((error) => console.error('PDF dışa aktarımı başarısız:', error)); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] px-2.5 text-xs font-medium text-[var(--sf-text-secondary)] hover:border-[var(--sf-border-active)] hover:text-[var(--sf-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"><FileText className="size-3.5" />PDF</button>
            <button type="button" title={hasBlockingGeometry ? 'Geometri hataları düzeltilmeden hesap yenilenemez' : 'Hesabı yenile'} disabled={hasBlockingGeometry} onClick={calculate} className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] text-[var(--sf-text-secondary)] hover:text-[var(--sf-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw className="size-3.5" /></button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--sf-text-muted)]">
          <span className="font-mono text-[var(--sf-text-primary)]">{scenario.input.concreteClass}</span><span>·</span><span className="max-w-[185px] truncate">{mix.name}</span><span>·</span><span>L {fmt(q?.wallLength, 1)} m</span>
          {warnings.length > 0 && <span className="ml-auto inline-flex items-center gap-1 text-[var(--sf-status-warning)]"><AlertTriangle className="size-3.5" />{warnings.length} uyarı</span>}
        </div>
        {resultsBlocked && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-[var(--sf-status-danger)] bg-[var(--sf-status-danger-bg)] px-3 py-2.5 text-xs leading-5 text-[var(--sf-status-danger)]" role="alert">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span><strong>Sonuçlar kilitli.</strong> {blockedMessage}</span>
          </div>
        )}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-[var(--sf-border-subtle)] p-2 xl:grid-cols-4" role="tablist" aria-label="Sonuç alanları">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} disabled={resultsBlocked} onClick={() => activateTab(tab.id)} className={`min-h-9 rounded-md px-2 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${activeTab === tab.id ? 'bg-[var(--sf-action-primary-subtle)] text-[var(--sf-text-primary)] ring-1 ring-inset ring-[var(--sf-border-active)]' : 'text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-panel-raised)] hover:text-[var(--sf-text-primary)]'}`}>{tab.label}</button>
        ))}
      </div>
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {resultsBlocked ? (
          <div className="flex min-h-56 items-center justify-center rounded-lg border border-dashed border-[var(--sf-status-danger)] bg-[var(--sf-status-danger-bg)] p-6 text-center">
            <div className="max-w-sm"><ShieldAlert className="mx-auto size-7 text-[var(--sf-status-danger)]" /><h2 className="mt-3 text-sm font-semibold text-[var(--sf-text-primary)]">Güncel sonuç bekleniyor</h2><p className="mt-2 text-xs leading-5 text-[var(--sf-text-muted)]">{blockedMessage}</p></div>
          </div>
        ) : content[activeTab]}
      </div>
    </div>
  );
}
