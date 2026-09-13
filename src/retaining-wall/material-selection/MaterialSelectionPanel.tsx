'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { calculateGeometryMetrics } from '../engine/geometry';
import { useRetainingWallStore } from '../store/useRetainingWallStore';
import { autoFixConcreteMixIssue, calculateMixMetrics, evaluateMixBalance, makeCustomConcreteMix, normalizeConcreteMix, validateConcreteMix } from './mixModel';
import { materialLabel } from './materialCatalog';
import { getDefaultMaterialPrice } from './defaultPrices';
import type { CompressiveStrengthMeasurement, ConcreteMixDesign, MaterialCategory, MaterialInput, MaterialPrice, MixValidationMessage } from './types';
import type { MixBalance } from './mixModel';
import { formatUnitConversion, type MaterialQuantityUnit } from './units';

const UNIT_OPTIONS: MaterialQuantityUnit[] = ['%', 'kg/m³', 'kg', 'ton', 'm³', 'L', 'L/m³'];
const PRICE_UNIT_OPTIONS: MaterialPrice['unit'][] = ['TL/kg', 'TL/ton', 'TL/m³', 'TL/L'];
const CUBE_STRENGTH_MPA: Record<ConcreteMixDesign['targetConcreteClass'], number> = { C20: 25, C25: 30, C30: 37, C35: 45, C40: 50, C45: 55, C50: 60 };
const DEFAULT_DENSITIES: Record<string, number> = {
  cement: 3150, fly_ash: 2300, slag: 2900, silica_fume: 2200, metakaolin: 2600,
  natural_fine_aggregate: 2650, natural_coarse_aggregate: 2650, recycled_fine_aggregate: 2400, recycled_coarse_aggregate: 2400,
  water: 1000, superplasticizer: 1100, air_entraining: 1000, accelerator: 1200, retarder: 1200,
  steel_fiber: 7850, pp_fiber: 910, glass_fiber: 2600,
};

const CATEGORY_SECTIONS: Array<{ id: MaterialCategory; title: string; description: string }> = [
  { id: 'binder', title: 'Bağlayıcılar', description: 'Çimento, SCM ve kullanıcı tanımlı puzolanlar' },
  { id: 'aggregate', title: 'Agregalar', description: 'Doğal ve geri dönüştürülmüş ince/iri agrega' },
  { id: 'water', title: 'Su', description: 'kg, ton, m³ veya L bazlı su girdisi' },
  { id: 'admixture', title: 'Kimyasal katkılar', description: 'Katkılar ve su azaltıcılar' },
  { id: 'fiber', title: 'Fiber', description: 'Çelik, PP, cam ve diğer fiberler' },
  { id: 'activator', title: 'Alkali aktivatörler', description: 'Geopolimer reçetelerinde kritik alanlar' },
];

function display(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('tr-TR', { maximumFractionDigits: digits });
}

function defaultDensity(materialId: string): number | null {
  return DEFAULT_DENSITIES[materialId] ?? null;
}

function defaultPriceUnit(item?: Pick<MaterialInput, 'id' | 'category'>): MaterialPrice['unit'] {
  if (item?.id === 'water') return 'TL/m³';
  if (item?.category === 'admixture' || item?.category === 'activator' || item?.category === 'fiber') return 'TL/kg';
  return 'TL/ton';
}

function createCustomMaterialId(category: MaterialCategory): string {
  return `${category}-custom-${Date.now()}`;
}

function patchMix(mix: ConcreteMixDesign, nextMaterials: MaterialInput[], projectConcreteVolumeM3?: number | null): ConcreteMixDesign {
  return normalizeConcreteMix({ ...mix, materials: nextMaterials }, { projectConcreteVolumeM3 });
}

function strengthMeasurementsVerified(measurements: CompressiveStrengthMeasurement[]): boolean {
  return measurements.length > 0 && measurements.every((measurement) => (
    Number.isFinite(measurement.valueMpa)
    && measurement.valueMpa > 0
    && measurement.ageDays != null
    && Number.isFinite(measurement.ageDays)
    && measurement.ageDays > 0
    && Boolean(measurement.source?.trim() || measurement.sourceUrl?.trim())
  ));
}

export default function MaterialSelectionPanel() {
  const mix = useRetainingWallStore((state) => state.concreteMix);
  const activeConcreteVolumeM3 = useRetainingWallStore((state) => state.activeScenario?.quantities?.concreteVolume ?? null);
  const geometry = useRetainingWallStore((state) => state.wallInput.geometry);
  const onChange = useRetainingWallStore((state) => state.setConcreteMix);
  const onConcreteClassChange = useRetainingWallStore((state) => state.setWallInput);
  const projectConcreteVolumeM3 = useMemo(() => {
    if (activeConcreteVolumeM3 != null && Number.isFinite(activeConcreteVolumeM3) && activeConcreteVolumeM3 > 0) {
      return activeConcreteVolumeM3;
    }
    return calculateGeometryMetrics(geometry).totalConcreteVolume;
  }, [activeConcreteVolumeM3, geometry]);
  const [addCategory, setAddCategory] = useState<MaterialCategory | null>(null);
  const [pricesOpen, setPricesOpen] = useState(false);
  const metrics = useMemo(() => calculateMixMetrics(mix, projectConcreteVolumeM3), [mix, projectConcreteVolumeM3]);
  const recipeBalance = useMemo(() => evaluateMixBalance(metrics), [metrics]);
  const validation = useMemo(() => validateConcreteMix(mix, projectConcreteVolumeM3), [mix, projectConcreteVolumeM3]);
  const errors = validation.filter((message) => message.severity === 'error');
  const warnings = validation.filter((message) => message.severity === 'warning');

  const focusIssue = (issue: MixValidationMessage) => {
    const selector = issue.target === 'air_target'
      ? '[data-air-target-input]'
      : issue.target === 'strength'
        ? issue.measurementIndex != null
          ? `[data-strength-value-index="${issue.measurementIndex}"]`
          : '[data-strength-value-index]'
        : issue.materialId
          ? `[data-material-dose="${issue.materialId}"], [data-enable-material-id="${issue.materialId}"]`
          : issue.target === 'water'
            ? '[data-material-dose="water"]'
            : '[data-material-dose]';
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return;
    let parent: HTMLElement | null = element.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.requestAnimationFrame(() => element.focus());
  };

  const autoFixIssue = (issue: MixValidationMessage) => {
    if (!issue.autoFix) return;
    onChange(autoFixConcreteMixIssue(mix, issue, projectConcreteVolumeM3));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => focusIssue(issue)));
  };

  const updateMaterial = (id: string, patch: Partial<MaterialInput>) => {
    const next = patchMix(mix, mix.materials.map((item) => item.id === id ? { ...item, ...patch } : item), projectConcreteVolumeM3);
    onChange(makeCustomConcreteMix(mix, next, { projectConcreteVolumeM3 }));
  };

  const updatePrice = (id: string, patch: Partial<MaterialPrice>) => {
    const item = mix.materials.find((candidate) => candidate.id === id);
    const current = mix.prices?.[id] ?? item?.price ?? getDefaultMaterialPrice(id) ?? {
      value: null,
      unit: defaultPriceUnit(item),
      currency: 'TRY',
    };
    const next = { ...current, ...patch } as MaterialPrice;
    const prices = { ...(mix.prices ?? {}) };
    prices[id] = next;
    onChange(patchMix({ ...mix, prices }, mix.materials.map((candidate) => candidate.id === id ? { ...candidate, price: next } : candidate), projectConcreteVolumeM3));
  };

  const resetPrice = (id: string) => {
    const prices = { ...(mix.prices ?? {}) };
    delete prices[id];
    onChange(patchMix(
      { ...mix, prices },
      mix.materials.map((candidate) => candidate.id === id ? { ...candidate, price: null } : candidate),
      projectConcreteVolumeM3,
    ));
  };

  const updateStrengthMeasurement = (index: number, patch: Partial<CompressiveStrengthMeasurement>) => {
    const measurements = [...(mix.compressiveStrengthMeasurements ?? [])];
    measurements[index] = { ...measurements[index], ...patch };
    onChange({
      ...mix,
      compressiveStrengthMeasurements: measurements,
      compressiveStrengthVerification: strengthMeasurementsVerified(measurements) ? 'verified' : 'unverified',
    });
  };

  const addStrengthMeasurement = () => {
    const measurements: CompressiveStrengthMeasurement[] = [
      ...(mix.compressiveStrengthMeasurements ?? []),
      { ageDays: null, valueMpa: 0, source: null, sourceUrl: null, sourceRow: null },
    ];
    onChange({
      ...mix,
      compressiveStrengthMeasurements: measurements,
      compressiveStrengthVerification: 'unverified',
    });
  };

  const removeStrengthMeasurement = (index: number) => {
    const measurements = (mix.compressiveStrengthMeasurements ?? []).filter((_, measurementIndex) => measurementIndex !== index);
    onChange({
      ...mix,
      compressiveStrengthMeasurements: measurements,
      compressiveStrengthVerification: strengthMeasurementsVerified(measurements) ? 'verified' : 'unverified',
    });
  };

  const addMaterial = (category: MaterialCategory) => {
    const id = createCustomMaterialId(category);
    const name = category === 'binder'
      ? 'Kullanıcı tanımlı bağlayıcı'
      : category === 'aggregate'
        ? 'Kullanıcı tanımlı agrega'
        : category === 'water'
          ? 'Kullanıcı tanımlı sıvı'
          : category === 'admixture'
            ? 'Kullanıcı tanımlı katkı'
            : category === 'fiber'
              ? 'Diğer fiber'
              : category === 'activator'
                ? 'Kullanıcı tanımlı aktivatör'
                : 'Kullanıcı tanımlı malzeme';
    onChange(makeCustomConcreteMix(mix, patchMix(mix, [...mix.materials, {
      id,
      name,
      category,
      enabled: true,
      value: 0,
      unit: 'kg/m³',
      basis: 'amount',
      rawValue: 0,
      rawUnit: 'kg/m³',
      canonicalKgPerM3: 0,
      percentage: null,
      circularityOrigin: 'unknown',
    }], projectConcreteVolumeM3), { projectConcreteVolumeM3 }));
  };

  const enableCatalogMaterial = (category: MaterialCategory, id: string) => {
    if (id === '__custom__') {
      addMaterial(category);
      setAddCategory(null);
      return;
    }
    const item = mix.materials.find((candidate) => candidate.id === id && candidate.category === category);
    if (!item) return;
    updateMaterial(id, {
      enabled: true,
      value: item.value ?? 0,
      rawValue: item.rawValue ?? item.value ?? 0,
      unit: item.unit ?? 'kg/m³',
      rawUnit: item.rawUnit ?? item.unit ?? 'kg/m³',
      basis: item.basis ?? 'amount',
      densityKgM3: item.densityKgM3 ?? defaultDensity(id),
    });
    setAddCategory(null);
  };

  const removeMaterial = (id: string) => {
    // Devre dışı bırakılan malzemenin miktarı, fiyatı ve kaynak bilgisi korunur.
    updateMaterial(id, { enabled: false });
  };


  const priceFor = (item: MaterialInput): MaterialPrice | null => mix.prices?.[item.id] ?? item.price ?? getDefaultMaterialPrice(item.id);
  const usesDefaultPrice = (item: MaterialInput): boolean => !mix.prices?.[item.id] && !item.price && getDefaultMaterialPrice(item.id) != null;
  const activePriceItems = metrics.materials.filter((item) => item.enabled);
  const requiredPriceItems = metrics.materials.filter((item) => item.enabled && (item.canonicalKgPerM3 ?? 0) > 0);
  const pricedMaterialCount = requiredPriceItems.filter((item) => {
    const price = priceFor(item);
    return price?.value != null && Number.isFinite(price.value) && price.value >= 0;
  }).length;

  return (
    <div className="space-y-3 p-3 pb-4 text-[var(--sf-text-secondary)]">
      <section className="overflow-hidden rounded-xl border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--sf-divider)] bg-[var(--sf-bg-panel-raised)] px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-text-muted)]">Seçili beton sınıfı</p>
          <span className="rounded border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-[var(--sf-text-muted)]">
            {mix.recipeMode === 'custom' ? 'Özel reçete' : mix.recipeMode === 'imported' ? 'İçe aktarılan' : 'Varsayılan'}
          </span>
        </div>
        <div className="flex items-center gap-2 p-3">
          <select
            value={mix.targetConcreteClass}
            onChange={(event) => {
              const concreteClass = event.target.value as ConcreteMixDesign['targetConcreteClass'];
              onConcreteClassChange({ concreteClass });
            }}
            className="sf-form-control h-8 min-w-0 flex-1 px-3 text-sm font-semibold outline-none"
          >
            <option>C20</option><option>C25</option><option>C30</option><option>C35</option><option>C40</option><option>C45</option><option>C50</option>
          </select>
          <span className="flex h-8 shrink-0 items-center rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-2 font-mono text-xs text-[var(--sf-text-secondary)]">C{mix.targetConcreteClass.slice(1)}/{CUBE_STRENGTH_MPA[mix.targetConcreteClass]} MPa</span>
          <InfoHint label="Beton sınıfı hakkında">“C”, beton dayanım sınıfını ifade eder. İlk değer silindir, ikinci değer küp karakteristik basınç dayanımıdır. Sınıf değişince yazılımın başlangıç dozaj profili uygulanır; malzeme miktarlarını elle değiştirmek sınıf hedefini kendiliğinden değiştirmez.</InfoHint>
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--sf-divider)] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-text-muted)]">Hava hedefi</span>
              <InfoHint label="Hava hedefi hakkında">Hedef hava içeriğini yüzde olarak girin. Bu alan hava sürükleyici katkının kg/m³ dozajından ayrıdır; program hedef değeri reçete bilgisi olarak korur ve şüpheli kaynak değerlerini otomatik olarak gerçek bir yüzdeye dönüştürmez.</InfoHint>
            </div>
            <p className="mt-1 text-xs text-[var(--sf-text-muted)]">Opsiyonel hedef · kaynak veride varsa içe aktarma ile korunur</p>
          </div>
          <div className="relative w-28 shrink-0">
            <Input
              data-air-target-input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={mix.targetAirContentPercent ?? ''}
              onChange={(event) => onChange({ ...mix, targetAirContentPercent: event.target.value === '' ? null : Number(event.target.value) })}
              className="sf-form-control h-8 pr-7 text-right font-mono text-xs"
              placeholder="—"
              aria-label="Hava hedefi yüzde"
            />
            <span className="pointer-events-none absolute right-2 top-2 text-xs text-[var(--sf-text-muted)]">%</span>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-text-muted)]">1 m³ beton için katılan malzemeler</span>
        <InfoHint label="Miktar ve yoğunluk hakkında">kg/m³ doğrudan 1 m³ beton içindeki dozajdır. m³, L, kg veya ton girdileri yoğunluk kullanılarak kg/m³ değerine çevrilir. Yoğunluk malzeme özelliğidir; miktar değildir.</InfoHint>
      </div>

      <RecipeBalanceCard balance={recipeBalance} />

      <section className="rounded-xl border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={pricesOpen}
            onClick={() => setPricesOpen((open) => !open)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-text-muted)]">Malzeme fiyatları · bilgi</p>
            <span className="shrink-0 rounded border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] px-1.5 py-0.5 font-mono text-xs text-[var(--sf-text-muted)]">{pricedMaterialCount}/{requiredPriceItems.length}</span>
            <ChevronDown className={pricesOpen ? 'size-3.5 shrink-0 rotate-180 text-[var(--sf-text-muted)] transition-transform' : 'size-3.5 shrink-0 text-[var(--sf-text-muted)] transition-transform'} />
          </button>
          <InfoHint label="Fiyatlandırma hakkında">Uçucu kül, GGBFS, silis dumanı, metakaolin ve geri dönüştürülmüş agrega için varsayılan satın alma bedeli 0 TL/kg kabul edilir. Lojistik maliyeti mesafeye göre ayrı hesaplanır.</InfoHint>
        </div>

        {pricesOpen && (
          <div className="mt-3 space-y-2.5 border-t border-[var(--sf-divider)] pt-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-text-muted)]">Beton maliyet modeli</p>
                <InfoHint label="Maliyet modeli hakkında">Aktif proje maliyet modeli hazır beton + lojistiktir. Uçucu kül, GGBFS, silis dumanı ve benzeri ikamelerin dozajı maliyete eklenmez; emisyon hesabında kendi katsayısıyla değerlendirilir.</InfoHint>
              </div>
              <select
                value={mix.priceMode}
                onChange={(event) => onChange({ ...mix, priceMode: event.target.value as ConcreteMixDesign['priceMode'] })}
                className="sf-form-control h-8 w-full shrink-0 px-2 text-xs font-semibold outline-none sm:w-52"
              >
                <option value="readyMix">Hazır beton + lojistik</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Fiyat girilmiş" value={pricedMaterialCount + '/' + requiredPriceItems.length} />
              <Metric label="Aktif malzeme" value={String(activePriceItems.length)} />
              <Metric label="Eksik fiyat" value={String(requiredPriceItems.length - pricedMaterialCount)} />
            </div>

            <div className="space-y-1.5">
              {metrics.materials.map((item) => (
                <PriceRow
                  key={item.id}
                  item={item}
                  price={priceFor(item)}
                  isDefault={usesDefaultPrice(item)}
                  defaultUnit={defaultPriceUnit(item)}
                  onChange={(patch) => updatePrice(item.id, patch)}
                  onReset={() => resetPrice(item.id)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {errors.length > 0 && <IssueBox tone="error" issues={errors} onNavigate={focusIssue} onAutoFix={autoFixIssue} />}
      {warnings.length > 0 && <IssueBox tone="warning" issues={warnings} onNavigate={focusIssue} onAutoFix={autoFixIssue} />}

      <section className="rounded-xl border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-text-muted)]">Deney / dayanım ölçümleri</p>
          <InfoHint label="Dayanım ölçümleri hakkında">Ölçülen MPa değerini deney yaşıyla birlikte girin. Yaş bilinmiyorsa sistem 28 gün varsaymaz.</InfoHint>
          <span className="shrink-0 rounded border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] px-1.5 py-0.5 font-mono text-xs text-[var(--sf-text-muted)]">{(mix.compressiveStrengthMeasurements ?? []).length}</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--sf-text-muted)]">Deney yaşı, numunenin basınç deneyinin yapıldığı gündür. Katalog reçetelerinde kaynak yaşı 28 gün olarak gösterilir; kaynağında yaş yoksa 28 gün varsayılmaz.</p>
        <div className="mt-2 space-y-1.5">
          {(mix.compressiveStrengthMeasurements ?? []).map((measurement, index) => (
            <StrengthMeasurementRow
              key={index}
              index={index}
              measurement={measurement}
              onChange={(patch) => updateStrengthMeasurement(index, patch)}
              onRemove={() => removeStrengthMeasurement(index)}
            />
          ))}
          <button type="button" onClick={addStrengthMeasurement} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-dashed border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] px-2.5 text-xs font-medium text-[var(--sf-text-secondary)] transition-colors hover:border-[var(--sf-border-strong)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"><Plus className="size-3" />Deney sonucu ekle</button>
        </div>
      </section>

      {CATEGORY_SECTIONS.map((section) => {
        const items = metrics.materials.filter((item) => item.category === section.id && item.enabled);
        const inactive = metrics.materials.filter((item) => item.category === section.id && !item.enabled);
        return (
          <details key={section.id} open={items.length > 0 && (section.id === 'binder' || section.id === 'aggregate')} className="group overflow-hidden rounded-xl border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)]">
            <summary className="flex cursor-pointer list-none items-center gap-2 bg-[var(--sf-bg-panel-raised)] px-3 py-2.5 text-[var(--sf-text-primary)] transition-colors hover:bg-[var(--sf-bg-hover)] [&::-webkit-details-marker]:hidden">
              <span className="h-3 w-0.5 shrink-0 rounded-full bg-[var(--sf-mix-binder)]" /><span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-text-secondary)]">{section.title}</span>
              <span className="flex size-6 shrink-0 items-center justify-center rounded border border-[var(--sf-border-default)] text-[var(--sf-text-muted)]" title={section.description} aria-label={section.title + ' hakkında'}><Info className="size-3" /></span>
              <span className="rounded border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] px-1.5 py-0.5 text-xs font-medium tabular-nums text-[var(--sf-text-muted)]">{items.length}</span>
              <ChevronDown className="size-3.5 shrink-0 text-[var(--sf-text-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--sf-divider)] p-3">
              <div className="space-y-2">
                {items.map((item) => <MaterialRow key={item.id} item={item} projectConcreteVolumeM3={projectConcreteVolumeM3} totalFreshMassKgM3={metrics.totalFreshMassKgM3} onUpdate={(patch) => updateMaterial(item.id, patch)} onRemove={() => removeMaterial(item.id)} />)}
              </div>
              {inactive.length > 0 && (
                <details className="mt-2 overflow-hidden rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-xs font-semibold text-[var(--sf-text-muted)] hover:text-[var(--sf-text-primary)] [&::-webkit-details-marker]:hidden">
                    <span>Devre dışı malzemeler</span>
                    <span className="rounded border border-[var(--sf-border-default)] px-1.5 py-0.5 font-mono text-xs">{inactive.length}</span>
                  </summary>
                  <div className="space-y-1 border-t border-[var(--sf-divider)] p-2">
                    {inactive.map((item) => (
                      <div key={item.id} data-inactive-material-id={item.id} className="flex items-center gap-2 rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] px-2 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs text-[var(--sf-text-muted)]">{item.name}</span>
                        <span className="shrink-0 font-mono text-xs text-[var(--sf-text-disabled)]">{display(item.value == null ? null : Number(item.value), 2)} {item.unit}</span>
                        <button type="button" data-enable-material-id={item.id} onClick={() => enableCatalogMaterial(section.id, item.id)} className="rounded border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] px-2 py-1 text-xs font-semibold text-[var(--sf-text-secondary)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]">Etkinleştir</button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <div className="mt-2 flex items-center gap-2">
                {addCategory === section.id ? <select autoFocus defaultValue="" onChange={(event) => enableCatalogMaterial(section.id, event.target.value)} className="sf-form-control h-8 min-w-0 flex-1 px-2 text-xs outline-none"><option value="" disabled>Yeni malzeme seçin…</option>{inactive.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="__custom__">Kullanıcı tanımlı malzeme</option></select> : <button type="button" onClick={() => setAddCategory(section.id)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-dashed border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] px-2.5 text-xs font-medium text-[var(--sf-text-secondary)] transition-colors hover:border-[var(--sf-border-strong)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]"><Plus className="size-3" />Malzeme ekle</button>}
                {addCategory === section.id && <button type="button" onClick={() => setAddCategory(null)} className="h-8 rounded-md border border-[var(--sf-border-default)] px-2 text-xs text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]">İptal</button>}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function RecipeBalanceCard({ balance }: { balance: MixBalance }) {
  const statusClass = balance.tone === 'good'
    ? 'border-[var(--sf-status-success)] bg-[var(--sf-status-success-bg)] text-[var(--sf-status-success)]'
    : balance.tone === 'warning'
      ? 'border-[var(--sf-status-warning)] bg-[var(--sf-status-warning-bg)] text-[var(--sf-status-warning)]'
      : 'border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] text-[var(--sf-text-secondary)]';
  const StatusGlyph = balance.tone === 'good' ? CheckCircle2 : AlertTriangle;
  const clampPercent = (value: number | null) => Math.max(0, Math.min(100, value ?? 0));
  const otherShare = balance.totalMassKgM3 == null
    ? 0
    : Math.max(0, 100 - (balance.binderSharePercent ?? 0) - (balance.waterSharePercent ?? 0) - (balance.aggregateSharePercent ?? 0));

  return (
    <section className="rounded-xl border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--sf-text-muted)]">Reçete dengesi</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--sf-text-muted)]">Miktarların 1 m³ taze beton içindeki toplam kütle ve agrega dağılımı kontrolü.</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${statusClass}`}>
          <StatusGlyph className="size-3" />{balance.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Bağlayıcı" value={`${display(balance.binderSharePercent, 1)}% · ${display(balance.totalMassKgM3 == null ? null : balance.totalMassKgM3 * (balance.binderSharePercent ?? 0) / 100, 0)} kg`} />
        <Metric label="Su / bağlayıcı" value={display(balance.waterBinderRatio, 3)} />
        <Metric label="Agrega payı" value={`${display(balance.aggregateSharePercent, 1)}% · ${display(balance.totalMassKgM3 == null ? null : balance.totalMassKgM3 * (balance.aggregateSharePercent ?? 0) / 100, 0)} kg`} />
        <Metric label="Taze kütle" value={`${display(balance.totalMassKgM3, 0)} kg/m³`} />
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--sf-text-muted)]">
          <span>Toplam kütle dağılımı</span>
          <span className="font-mono">Bağlayıcı · su · agrega</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-[var(--sf-surface-3)]" aria-label="Bağlayıcı, su ve agrega kütle dağılımı">
          <span className="bg-[var(--sf-mix-binder)]" style={{ width: `${clampPercent(balance.binderSharePercent)}%` }} />
          <span className="bg-[var(--sf-mix-water)]" style={{ width: `${clampPercent(balance.waterSharePercent)}%` }} />
          <span className="bg-[var(--sf-mix-aggregate)]" style={{ width: `${clampPercent(balance.aggregateSharePercent)}%` }} />
          {otherShare > 0 && <span className="bg-[var(--sf-mix-other)]" style={{ width: `${clampPercent(otherShare)}%` }} />}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--sf-text-muted)]">
          <span><i className="mr-1 inline-block size-1.5 rounded-full bg-[var(--sf-mix-binder)]" />Bağlayıcı %{display(balance.binderSharePercent, 1)}</span>
          <span><i className="mr-1 inline-block size-1.5 rounded-full bg-[var(--sf-mix-water)]" />Su %{display(balance.waterSharePercent, 1)}</span>
          <span><i className="mr-1 inline-block size-1.5 rounded-full bg-[var(--sf-mix-aggregate)]" />Agrega %{display(balance.aggregateSharePercent, 1)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--sf-divider)] pt-2 text-xs">
        <span className="text-[var(--sf-text-muted)]">İnce / iri agrega: <strong className="font-mono text-[var(--sf-text-secondary)]">%{display(balance.fineAggregateSharePercent, 1)} / %{display(balance.coarseAggregateSharePercent, 1)}</strong></span>
        <span className="text-[var(--sf-text-disabled)]">Tipik ön dozaj kontrolü</span>
      </div>

      {(balance.issues.length > 0 || balance.notes.length > 0) && (
        <div className={`mt-2 rounded-md border px-2.5 py-2 text-xs leading-relaxed ${balance.tone === 'warning' ? 'border-[var(--sf-status-warning)] bg-[var(--sf-status-warning-bg)] text-[var(--sf-status-warning)]' : 'border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] text-[var(--sf-text-secondary)]'}`}>
          {[...balance.issues, ...balance.notes].map((message) => <p key={message}>• {message}</p>)}
        </div>
      )}
      <p className="mt-2 text-xs leading-relaxed text-[var(--sf-text-muted)]">Bu kart ön kontrol içindir; nihai dozaj, işlenebilirlik ve dayanım laboratuvar deneyi ile doğrulanmalıdır.</p>
    </section>
  );
}

function MaterialRow({ item, projectConcreteVolumeM3, totalFreshMassKgM3, onUpdate, onRemove }: { item: MaterialInput; projectConcreteVolumeM3: number | null; totalFreshMassKgM3: number | null; onUpdate: (patch: Partial<MaterialInput>) => void; onRemove: () => void }) {
  const isRatio = item.unit === '%';
  const canonical = item.canonicalKgPerM3;
  const massShare = canonical == null || totalFreshMassKgM3 == null || totalFreshMassKgM3 <= 0 ? null : canonical / totalFreshMassKgM3 * 100;
  const isWater = item.id === 'water';
  const density = item.densityKgM3 ?? defaultDensity(item.id);
  const rawValue = item.rawValue ?? item.value;
  const conversion = isRatio
    ? 'Oran bazlı · grup toplamına göre'
    : formatUnitConversion({
      value: rawValue == null ? null : Number(rawValue),
      unit: item.unit,
      basis: item.basis,
      densityKgM3: density ?? (isWater ? 1000 : null),
    }, projectConcreteVolumeM3);
  const conversionLabel = canonical == null
    ? conversion
    : item.unit === 'kg/m³'
      ? `Normalize: ${display(canonical, 3)} kg/m³`
      : `${conversion} · Normalize: ${display(canonical, 3)} kg/m³`;
  return (
    <div data-material-id={item.id} className="rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-3 py-2.5 transition-colors hover:border-[var(--sf-border-strong)]" title={`${item.basis === 'ratio' ? 'Oran: grup toplamına göre' : 'Miktar: kg/m³ kanonik değer'} · Kaynak: ${item.source ?? 'belirtilmedi'}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={item.enabled}
          aria-label={`${item.name || materialLabel(item.id)} malzemesini ${item.enabled ? 'devre dışı bırak' : 'etkinleştir'}`}
          onClick={() => onUpdate({ enabled: !item.enabled })}
          className={`relative h-5 w-9 shrink-0 rounded-full border outline-none transition-colors ${item.enabled ? 'border-[var(--sf-border-active)] bg-[var(--sf-action-primary)]' : 'border-[var(--sf-border-strong)] bg-[var(--sf-bg-disabled)]'}`}
        >
          <span className={`absolute left-0.5 top-0.5 size-3.5 rounded-full bg-[var(--sf-text-on-accent)] shadow-sm transition-transform duration-200 ease-out ${item.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-secondary)]">{item.name || materialLabel(item.id)}</span>
        <span className="shrink-0 text-right font-mono text-xs tabular-nums text-[var(--sf-text-secondary)]">{canonical == null ? '—' : `${display(canonical, 3)} kg/m³`}<span className="ml-1 text-[var(--sf-text-muted)]">{massShare == null ? '—' : `%${display(massShare, 1)} toplam`}</span></span>
        <button type="button" onClick={onRemove} className="rounded p-1 text-[var(--sf-text-disabled)] hover:bg-[var(--sf-status-danger-bg)] hover:text-[var(--sf-status-danger)]" title="Malzemeyi devre dışı bırak"><Trash2 className="size-3" /></button>
      </div>
      {item.id.includes('-custom-') && <label className="sf-form-field mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]"><span className="sf-form-label-row">Malzeme adı</span><Input value={item.name} onChange={(event) => onUpdate({ name: event.target.value })} className="sf-form-control h-8 text-xs" placeholder="Malzeme adı" /></label>}
      <div className="mt-2 grid grid-cols-2 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_96px_128px]">
        <label className="sf-form-field min-w-0 text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]"><span className="sf-form-label-row sf-form-label-row--double">Miktar / dozaj</span>
          <Input data-material-dose={item.id} type="number" value={rawValue ?? ''} onChange={(event) => onUpdate({ value: event.target.value === '' ? null : Number(event.target.value), rawValue: event.target.value === '' ? null : Number(event.target.value) })} className="sf-form-control h-8 text-right font-mono text-xs" placeholder="Değer" />
        </label>
        <label className="sf-form-field min-w-0 text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]"><span className="sf-form-label-row sf-form-label-row--double">Birim</span>
          <select data-material-unit={item.id} value={item.unit} onChange={(event) => onUpdate({ unit: event.target.value as MaterialQuantityUnit, basis: event.target.value === '%' ? 'ratio' : 'amount', rawUnit: event.target.value, densityKgM3: item.densityKgM3 ?? defaultDensity(item.id) })} className="sf-form-control h-8 w-full px-2 text-xs font-semibold outline-none"><option value="%">%</option>{UNIT_OPTIONS.filter((unit) => unit !== '%').map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>
        </label>
        <label className="sf-form-field col-span-2 min-w-0 text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)] sm:col-span-1"><span className="sf-form-label-row sf-form-label-row--double">Yoğunluk (kg/m³)</span>
          <Input type="number" min="0" value={density ?? ''} onChange={(event) => onUpdate({ densityKgM3: event.target.value === '' ? null : Number(event.target.value) })} className="sf-form-control h-8 text-right font-mono text-xs" placeholder="Yoğunluk" title="Malzeme yoğunluğu; m³ veya litre girdisini kg'a çevirmek için kullanılır. kg/m³ girdisinde miktarı değiştirmez." />
        </label>
      </div>
      <div className="mt-1 flex justify-end">
        <InfoHint label="Dönüşüm ayrıntısı">{conversionLabel}{item.rawUnit && item.rawUnit !== item.unit ? ` · Kaynak: ${rawValue ?? '—'} ${item.rawUnit}` : ''}</InfoHint>
      </div>
      {canonical == null && <p className="mt-1 text-xs text-[var(--sf-status-warning)]">Kanonik değer hesaplanamadı; yoğunluk/proje hacmi veya grup toplamı eksik.</p>}
    </div>
  );
}

function PriceRow({ item, price, isDefault, defaultUnit, onChange, onReset }: { item: MaterialInput; price: MaterialPrice | null; isDefault: boolean; defaultUnit: MaterialPrice['unit']; onChange: (patch: Partial<MaterialPrice>) => void; onReset: () => void }) {
  return (
    <div className={item.enabled ? 'rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-3 py-2' : 'rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] px-3 py-2 opacity-65'}>
      <div className="grid grid-cols-[minmax(0,1fr)_90px_84px_32px_32px] items-center gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-[var(--sf-text-secondary)]" title={item.name}>
          <span className="block truncate">{item.name}</span>
          <span className="mt-0.5 block text-xs text-[var(--sf-text-muted)]">{item.enabled ? 'Aktif reçete malzemesi' : 'Devre dışı · fiyat korunuyor'}</span>
        </span>
        <Input type="number" min="0" step="any" value={price?.value ?? ''} onChange={(event) => onChange({ value: event.target.value === '' ? null : Number(event.target.value) })} className="sf-form-control h-8 text-right font-mono text-xs" placeholder="Fiyat" />
        <select value={price?.unit ?? defaultUnit} onChange={(event) => onChange({ unit: event.target.value as MaterialPrice['unit'] })} className="sf-form-control h-8 px-1 text-xs outline-none">{PRICE_UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>
        <Popover>
          <PopoverTrigger type="button" className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] text-[var(--sf-text-muted)] transition-colors hover:border-[var(--sf-border-strong)] hover:text-[var(--sf-text-primary)]" title="Kaynak ve tarih bilgisi" aria-label="Kaynak ve tarih bilgisi"><Info className="size-3" /></PopoverTrigger>
          <PopoverContent align="end" side="bottom" sideOffset={6} positionerClassName="z-[120]" className="z-[120] w-64 space-y-1.5 gap-0 rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] p-2.5 text-[var(--sf-text-secondary)] shadow-[var(--sf-shadow-overlay)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]">Kaynak bilgisi</p>
            <Input value={price?.source ?? ''} onChange={(event) => onChange({ source: event.target.value || null })} className="sf-form-control h-8 text-xs" placeholder="Kaynak" />
            <div className="grid grid-cols-2 gap-1.5">
              <Input type="date" value={price?.date ?? ''} onChange={(event) => onChange({ date: event.target.value || null })} className="sf-form-control h-8 text-xs" title="Fiyat tarihi" />
              <Input value={price?.region ?? ''} onChange={(event) => onChange({ region: event.target.value || null })} className="sf-form-control h-8 text-xs" placeholder="Bölge" />
            </div>
            <Input value={price?.sourceUrl ?? ''} onChange={(event) => onChange({ sourceUrl: event.target.value || null })} className="sf-form-control h-8 text-xs" placeholder="Kaynak bağlantısı" />
            <Input value={price?.notes ?? ''} onChange={(event) => onChange({ notes: event.target.value || null })} className="sf-form-control h-8 text-xs" placeholder="Not" />
          </PopoverContent>
        </Popover>
        <button type="button" onClick={onReset} disabled={isDefault || price?.value == null} className="flex size-8 items-center justify-center rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] text-[var(--sf-text-muted)] hover:border-[var(--sf-border-strong)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)] disabled:cursor-not-allowed disabled:opacity-30" title="Varsayılan fiyata dön"><RotateCcw className="size-3" /></button>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--sf-text-muted)]">
        <span className="rounded border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] px-1 py-0.5 text-[var(--sf-text-secondary)]">{isDefault ? 'Varsayılan' : 'Kullanıcı fiyatı'}</span>
        {price?.value == null && <span>Fiyat girilmedi</span>}
      </div>
    </div>
  );
}

function StrengthMeasurementRow({ index, measurement, onChange, onRemove }: { index: number; measurement: CompressiveStrengthMeasurement; onChange: (patch: Partial<CompressiveStrengthMeasurement>) => void; onRemove: () => void }) {
  const ageOptions = [7, 28, 56] as const;
  return (
    <div className="rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] p-2.5">
      <div className="grid grid-cols-[80px_minmax(0,1fr)_32px_32px] items-center gap-2">
        <Input type="number" min="1" step="1" value={measurement.ageDays ?? ''} onChange={(event) => onChange({ ageDays: event.target.value === '' ? null : Number(event.target.value) })} className="sf-form-control h-8 text-right font-mono text-xs" placeholder="Gün" title="Deney yaşı (gün)" />
        <div className="relative">
          <Input data-strength-value-index={index} type="number" min="0" step="any" value={measurement.valueMpa ?? ''} onChange={(event) => onChange({ valueMpa: event.target.value === '' ? 0 : Number(event.target.value) })} className="sf-form-control h-8 pr-10 text-right font-mono text-xs" placeholder="MPa" title="Basınç dayanımı" />
          <span className="pointer-events-none absolute right-2 top-2 text-xs text-[var(--sf-text-muted)]">MPa</span>
        </div>
        <Popover>
          <PopoverTrigger type="button" className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] text-[var(--sf-text-muted)] transition-colors hover:border-[var(--sf-border-strong)] hover:text-[var(--sf-text-primary)]" title="Deney kaynağı" aria-label="Deney kaynağı"><Info className="size-3" /></PopoverTrigger>
          <PopoverContent align="end" side="bottom" sideOffset={6} positionerClassName="z-[120]" className="z-[120] w-64 space-y-1.5 gap-0 rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] p-2.5 text-[var(--sf-text-secondary)] shadow-[var(--sf-shadow-overlay)]">
            <Input value={measurement.source ?? ''} onChange={(event) => onChange({ source: event.target.value || null })} className="sf-form-control h-8 text-xs" placeholder="Deney kaynağı" />
            <Input value={measurement.sourceUrl ?? ''} onChange={(event) => onChange({ sourceUrl: event.target.value || null })} className="sf-form-control h-8 text-xs" placeholder="Kaynak bağlantısı" />
            <Input type="number" value={measurement.sourceRow ?? ''} onChange={(event) => onChange({ sourceRow: event.target.value === '' ? null : Number(event.target.value) })} className="sf-form-control h-8 text-xs" placeholder="Kaynak satırı" />
          </PopoverContent>
        </Popover>
        <button type="button" onClick={onRemove} className="flex size-8 items-center justify-center rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] text-[var(--sf-text-muted)] hover:border-[var(--sf-status-danger)] hover:bg-[var(--sf-status-danger-bg)] hover:text-[var(--sf-status-danger)]" title="Deney kaydını kaldır"><Trash2 className="size-3" /></button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-[var(--sf-text-muted)]">
        <span className="mr-0.5">Hızlı seçim:</span>
        {ageOptions.map((age) => <button key={age} type="button" aria-pressed={measurement.ageDays === age} onClick={() => onChange({ ageDays: age })} className={`min-h-7 rounded border px-1.5 font-mono transition-colors ${measurement.ageDays === age ? 'border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] text-[var(--sf-text-link)]' : 'border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'}`}>{age} gün</button>)}
        <button type="button" aria-pressed={measurement.ageDays == null} onClick={() => onChange({ ageDays: null })} className={`min-h-7 rounded border px-1.5 transition-colors ${measurement.ageDays == null ? 'border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] text-[var(--sf-text-link)]' : 'border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]'}`}>Bilinmiyor</button>
      </div>
      {measurement.ageDays == null && <p className="mt-1.5 text-xs text-[var(--sf-status-warning)]">Deney yaşı belirtilmedi; 28 gün varsayılmayacak.</p>}
    </div>
  );
}

function InfoHint({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger type="button" className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-input)] text-[var(--sf-text-muted)] transition-colors hover:border-[var(--sf-border-strong)] hover:bg-[var(--sf-bg-hover)] hover:text-[var(--sf-text-primary)]" title={label} aria-label={label}>
        <Info className="size-3" />
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={6} positionerClassName="z-[120]" className="z-[120] w-64 gap-0 rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] p-2.5 text-xs font-normal normal-case leading-relaxed tracking-normal text-[var(--sf-text-secondary)] shadow-[var(--sf-shadow-overlay)]">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-3 py-2"><span className="block text-xs font-semibold uppercase tracking-wide text-[var(--sf-text-muted)]">{label}</span><span className="mt-1 block font-mono text-xs text-[var(--sf-text-secondary)]">{value}</span></div>;
}

function IssueBox({ tone, issues, onNavigate, onAutoFix }: { tone: 'error' | 'warning'; issues: MixValidationMessage[]; onNavigate: (issue: MixValidationMessage) => void; onAutoFix: (issue: MixValidationMessage) => void }) {
  return (
    <div data-mix-issue-box={tone} className={`rounded-lg border p-2.5 text-xs ${tone === 'error' ? 'border-[var(--sf-status-danger)] bg-[var(--sf-status-danger-bg)] text-[var(--sf-status-danger)]' : 'border-[var(--sf-status-warning)] bg-[var(--sf-status-warning-bg)] text-[var(--sf-status-warning)]'}`}>
      <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide"><AlertTriangle className="size-3" />{tone === 'error' ? 'Hata' : 'Veri uyarısı'}</div>
      <div className="mt-1.5 space-y-1.5">
        {issues.map((issue, index) => (
          <div key={`${issue.code}-${issue.message}-${index}`} className="rounded-md border border-current/20 bg-[var(--sf-bg-panel)]/45 px-2 py-1.5">
            <p data-mix-issue-message className="leading-4">{issue.message}</p>
            {(issue.target || issue.autoFix) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {issue.target && <button type="button" onClick={() => onNavigate(issue)} className="min-h-7 rounded border border-current/30 bg-[var(--sf-bg-input)] px-2 text-xs font-semibold text-current transition-colors hover:bg-[var(--sf-bg-hover)]">İlgili girdiye git</button>}
                {issue.autoFix && <button type="button" onClick={() => onAutoFix(issue)} className="min-h-7 rounded border border-current/40 bg-[var(--sf-action-primary-subtle)] px-2 text-xs font-semibold text-current transition-colors hover:bg-[var(--sf-bg-hover)]">Oto düzelt</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
