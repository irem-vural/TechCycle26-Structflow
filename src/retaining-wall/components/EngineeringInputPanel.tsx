'use client';

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · theme: StructFlow dark · enrichment: none */
/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · slop: pass */

import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { AlertTriangle, CircleDollarSign, Info, MapPin, Mountain, Ruler, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MapModal from './MapModal';
import GeometryWireframePreview from './GeometryWireframePreview';
import MaterialSelectionPanel from '@/retaining-wall/material-selection/MaterialSelectionPanel';
import { useRetainingWallStore } from '@/retaining-wall/store/useRetainingWallStore';
import { GEOMETRY_LIMITS } from '@/retaining-wall/engine/validation';
import type { ConcreteClass, GeometryFieldKey, LogisticsInput, RetainingWallInput, SoilType, WallGeometry } from '@/retaining-wall/types';
import ThemeToggle from './ThemeToggle';
import { geometryFieldColorsForTheme } from './geometryFieldVisuals';
import { STRUCTFLOW_DARK_THEME, themeRuntime } from '@/core/theme/structflowTheme';

const soilTypes: Array<{ value: SoilType; label: string; hint: string }> = [
  { value: 'granular', label: 'Granüler zemin', hint: 'Kum/çakıl; kohezyon düşük' },
  { value: 'clayey', label: 'Killi zemin', hint: 'Kohezyon ve su etkisi ayrıca kontrol edilmeli' },
  { value: 'silty', label: 'Siltli zemin', hint: 'Drenaj ve suya duyarlılık izlenmeli' },
  { value: 'rockfill', label: 'Kaya dolgu', hint: 'Yüksek sürtünme; dane dağılımını doğrula' },
  { value: 'custom', label: 'Özel / tanımsız', hint: 'Parametreleri kullanıcı belirler' },
];

const concreteClasses: ConcreteClass[] = ['C20', 'C25', 'C30', 'C35', 'C40', 'C45', 'C50'];


function fmt(value: number, digits = 2) {
  return value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function InputField({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  error,
  description,
  field,
  onFocus,
  onBlur,
  onClick,
}: {
  label: string;
  unit?: string;
  value: number | string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  description?: string;
  field?: GeometryFieldKey;
  onFocus?: () => void;
  onBlur?: () => void;
  onClick?: () => void;
}) {
  const themeId = useSyncExternalStore(
    themeRuntime.subscribe,
    () => themeRuntime.getSnapshot().id,
    () => STRUCTFLOW_DARK_THEME,
  );
  const dimensionColor = field ? geometryFieldColorsForTheme(themeId)[field] : undefined;
  const selectedGeoField = useRetainingWallStore((state) => state.selectedGeoField);
  const isSelected = Boolean(field && selectedGeoField === field);
  return (
    <label className="sf-form-field">
      <span className="sf-form-label-row sf-form-label-row--double text-xs font-medium text-[var(--sf-text-secondary)]">
        <span>{label}</span>
        {unit && <span className="font-mono text-xs text-[var(--sf-text-muted)]">{unit}</span>}
      </span>
      <Input
        id={field ? `geometry-field-${field}` : undefined}
        data-geometry-field={field}
        data-geometry-selected={!error && isSelected ? 'true' : undefined}
        type="number"
        value={typeof value === 'string' ? value : Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={onClick}
        className={`sf-form-control h-8 text-right font-mono text-xs ${error ? 'border-[var(--sf-status-danger)]' : ''}`}
        style={{
          outline: 'none',
          boxShadow: 'none',
          ...(!error && isSelected && dimensionColor ? { '--sf-geometry-field-color': dimensionColor } as CSSProperties : {}),
        }}
      />
      {(description || error) && (
        <span className={`sf-form-helper block text-xs ${error ? 'text-[var(--sf-status-danger)]' : 'text-[var(--sf-text-muted)]'}`}>
          {error ?? description}
        </span>
      )}
    </label>
  );
}
function SectionTitle({ icon, title, detail }: { icon: React.ReactNode; title: string; detail?: string }) {
  return (
    <div className="mb-3 flex items-start gap-2 border-b border-[var(--sf-divider)] pb-2">
      <span className="mt-0.5 text-[var(--sf-action-primary)]">{icon}</span>
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-[var(--sf-text-primary)]">{title}</h2>
        {detail && <p className="mt-0.5 text-xs leading-4 text-[var(--sf-text-muted)]">{detail}</p>}
      </div>
    </div>
  );
}

export default function EngineeringInputPanel() {
  const store = useRetainingWallStore();
  const themeId = useSyncExternalStore(
    themeRuntime.subscribe,
    () => themeRuntime.getSnapshot().id,
    () => STRUCTFLOW_DARK_THEME,
  );
  const geometryFieldColors = geometryFieldColorsForTheme(themeId);
  const {
    wallInput,
    logistics,
    geometryErrors,
    activeInputCategory,
    setActiveInputCategory,
    setFocusedGeoField,
    selectedGeoField,
    setSelectedGeoField,
    setGeometry,
    setWallInput,
    setLogistics,
  } = store;
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [geometryDrafts, setGeometryDrafts] = useState<Partial<Record<GeometryFieldKey, string>>>({});
  const activeTab = activeInputCategory === 'concrete' ? 'materials' : activeInputCategory;
  const reinforcement = {
    mode: wallInput.reinforcement?.mode ?? 'automatic' as const,
    customRatioKgM3: wallInput.reinforcement?.customRatioKgM3 ?? 70,
    coverMm: wallInput.reinforcement?.coverMm ?? 50,
    preferredDiameterMm: wallInput.reinforcement?.preferredDiameterMm ?? 16,
    preferredSpacingMm: wallInput.reinforcement?.preferredSpacingMm ?? 200,
    minSpacingMm: wallInput.reinforcement?.minSpacingMm ?? 100,
    maxSpacingMm: wallInput.reinforcement?.maxSpacingMm ?? 300,
  };
  const rcDesign = {
    fcMpa: wallInput.rcDesign?.fcMpa ?? 21,
    fyMpa: wallInput.rcDesign?.fyMpa ?? 400,
    shrinkageTemperatureRatio: wallInput.rcDesign?.shrinkageTemperatureRatio ?? 0.002,
  };
  const errorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const error of geometryErrors) if (!map[error.field] || error.severity === 'error') map[error.field] = error.message;
    return map;
  }, [geometryErrors]);
  const errorCount = geometryErrors.filter((error) => error.severity === 'error').length;
  const warningCount = geometryErrors.filter((error) => error.severity === 'warning').length;

  useEffect(() => {
    const handleGeometryFocusRequest = (event: Event) => {
      const field = (event as CustomEvent<{ field?: GeometryFieldKey }>).detail?.field;
      if (!field) return;
      setActiveInputCategory('geometry');
      setSelectedGeoField(field);
      setFocusedGeoField(field);
      window.requestAnimationFrame(() => {
        const target = document.getElementById(`geometry-field-${field}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target?.focus({ preventScroll: true });
      });
    };
    window.addEventListener('retaining-wall:focus-geometry-field', handleGeometryFocusRequest);
    return () => window.removeEventListener('retaining-wall:focus-geometry-field', handleGeometryFocusRequest);
  }, [setActiveInputCategory, setFocusedGeoField, setSelectedGeoField]);

  const updateGeometry = (key: GeometryFieldKey, value: string) => {
    setGeometryDrafts((current) => ({ ...current, [key]: value }));
    if (value.trim() === '') return;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) setGeometry({ [key]: parsed } as Partial<WallGeometry>);
  };
  const commitGeometry = (key: GeometryFieldKey) => {
    const draft = geometryDrafts[key];
    if (draft !== undefined && draft.trim() !== '') {
      const parsed = Number(draft);
      if (Number.isFinite(parsed)) setGeometry({ [key]: parsed } as Partial<WallGeometry>);
    }
    setGeometryDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const updateLogistics = (key: keyof LogisticsInput, value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) setLogistics({ [key]: parsed } as Partial<LogisticsInput>);
  };
  const updateSoil = (key: 'backfillSoil' | 'foundationSoil', patch: Partial<RetainingWallInput['backfillSoil']>) => {
    setWallInput({ [key]: { ...wallInput[key], ...patch } } as Partial<RetainingWallInput>);
  };
  const updateConcretePrice = (concreteClass: ConcreteClass, value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setLogistics({ concretePrice: parsed, concretePricesByClass: { ...(logistics.concretePricesByClass ?? {}), [concreteClass]: parsed } });
  };
  const geometryInputValue = (field: GeometryFieldKey) => geometryDrafts[field] ?? wallInput.geometry[field];
  const bindGeometryFocus = (field: GeometryFieldKey) => ({
    onFocus: () => {
      setGeometryDrafts((current) => ({ ...current, [field]: String(wallInput.geometry[field]) }));
      setFocusedGeoField(field);
    },
    onBlur: () => {
      commitGeometry(field);
      setFocusedGeoField(null);
    },
    onClick: () => setSelectedGeoField(field),
  });

  return (
    <div className="sf-engineering-tabular flex h-full min-h-0 flex-col bg-[var(--sf-bg-sidebar)] text-[var(--sf-text-primary)]">
      <div className="shrink-0 border-b border-[var(--sf-divider)] px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-[-0.01em] text-[var(--sf-text-primary)]">İstinat duvarı</h1>
            <p className="mt-1 truncate text-xs text-[var(--sf-text-muted)]">
          Tasarım girdileri
          <span className="mx-1.5 text-[var(--sf-text-disabled)]" aria-hidden="true">·</span>
          <span className="font-mono text-[var(--sf-text-secondary)]">L {fmt(wallInput.geometry.L, 1)} m</span>
          <span className="mx-1.5 text-[var(--sf-text-disabled)]" aria-hidden="true">·</span>
          <span>{wallInput.concreteClass} hedefi</span>
            </p>
          </div>
          <ThemeToggle />
        </div>
        {(errorCount > 0 || warningCount > 0) && (
          <div className={`mt-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${errorCount > 0 ? 'border-[var(--sf-status-danger)] bg-[var(--sf-status-danger-bg)] text-[var(--sf-status-danger)]' : 'border-[var(--sf-status-warning)] bg-[var(--sf-status-warning-bg)] text-[var(--sf-status-warning)]'}`}>
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>{errorCount > 0 ? `${errorCount} geometri hatası` : `${warningCount} geometri uyarısı`} · sonuçlar veri düzeltilene kadar güncellenmeyebilir.</span>
          </div>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setFocusedGeoField(null);
          setSelectedGeoField(null);
          setActiveInputCategory(value === 'materials' ? 'concrete' : value as typeof activeInputCategory);
        }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="grid h-auto w-full shrink-0 grid-cols-5 gap-1 border-b border-[var(--sf-border-subtle)] px-2 py-1.5" role="tablist" aria-label={'Girdi alan\u0131lar\u0131'}>
          <button type="button" role="tab" aria-selected={activeTab === 'geometry'} onClick={() => { setFocusedGeoField(null); setSelectedGeoField(null); setActiveInputCategory('geometry'); }} className={`h-8 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${activeTab === 'geometry' ? 'border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] text-[var(--sf-text-primary)]' : 'border-transparent text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-panel-raised)] hover:text-[var(--sf-text-primary)]'}`}>Geometri</button>
          <button type="button" role="tab" aria-selected={activeTab === 'params'} onClick={() => { setFocusedGeoField(null); setSelectedGeoField(null); setActiveInputCategory('params'); }} className={`h-8 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${activeTab === 'params' ? 'border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] text-[var(--sf-text-primary)]' : 'border-transparent text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-panel-raised)] hover:text-[var(--sf-text-primary)]'}`}>Zemin</button>
          <button type="button" role="tab" aria-selected={activeTab === 'materials'} onClick={() => { setFocusedGeoField(null); setSelectedGeoField(null); setActiveInputCategory('concrete'); }} className={`h-8 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${activeTab === 'materials' ? 'border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] text-[var(--sf-text-primary)]' : 'border-transparent text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-panel-raised)] hover:text-[var(--sf-text-primary)]'}`}>Beton</button>
          <button type="button" role="tab" aria-selected={activeTab === 'rebar'} onClick={() => { setFocusedGeoField(null); setSelectedGeoField(null); setActiveInputCategory('rebar'); }} className={`h-8 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${activeTab === 'rebar' ? 'border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] text-[var(--sf-text-primary)]' : 'border-transparent text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-panel-raised)] hover:text-[var(--sf-text-primary)]'}`}>Donatı</button>
          <button type="button" role="tab" aria-selected={activeTab === 'logistics'} onClick={() => { setFocusedGeoField(null); setSelectedGeoField(null); setActiveInputCategory('logistics'); }} className={`h-8 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${activeTab === 'logistics' ? 'border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] text-[var(--sf-text-primary)]' : 'border-transparent text-[var(--sf-text-muted)] hover:bg-[var(--sf-bg-panel-raised)] hover:text-[var(--sf-text-primary)]'}`}>Lojistik ve Fiyat</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <TabsContent value="geometry" className="m-0 space-y-3 p-3">
            <GeometryWireframePreview />
            <section className="space-y-2.5">
              <div className="sf-form-grid-2">
                <InputField {...bindGeometryFocus('H')} field="H" label="Duvar yüksekliği" unit="H · m" value={geometryInputValue('H')} min={GEOMETRY_LIMITS.H.min} max={GEOMETRY_LIMITS.H.max} onChange={(value) => updateGeometry('H', value)} error={errorMap.H} description="Taban plağı üstünden gövde tepesine serbest yükseklik." />
                <InputField {...bindGeometryFocus('L')} field="L" label="Toplam duvar uzunluğu" unit="L · m" value={geometryInputValue('L')} min={GEOMETRY_LIMITS.L.min} max={GEOMETRY_LIMITS.L.max} onChange={(value) => updateGeometry('L', value)} error={errorMap.L} description="Toplam sonuçlar L ile çarpılır." />
                <InputField {...bindGeometryFocus('x1')} field="x1" label="Temel toplam genişliği" unit="x1 · m" value={geometryInputValue('x1')} min={GEOMETRY_LIMITS.x1.min} max={GEOMETRY_LIMITS.x1.max} onChange={(value) => updateGeometry('x1', value)} error={errorMap.x1} />
                <InputField {...bindGeometryFocus('Df')} field="Df" label="Temel gömme derinliği" unit="Df · m" value={geometryInputValue('Df')} min={GEOMETRY_LIMITS.Df.min} max={GEOMETRY_LIMITS.Df.max} onChange={(value) => updateGeometry('Df', value)} error={errorMap.Df} />
                <InputField {...bindGeometryFocus('x2')} field="x2" label="Burun uzunluğu" unit="x2 · m" value={geometryInputValue('x2')} min={GEOMETRY_LIMITS.x2.min} max={GEOMETRY_LIMITS.x2.max} onChange={(value) => updateGeometry('x2', value)} error={errorMap.x2} />
                <InputField {...bindGeometryFocus('x3')} field="x3" label="Gövde alt kalınlığı" unit="x3 · m" value={geometryInputValue('x3')} min={GEOMETRY_LIMITS.x3.min} max={GEOMETRY_LIMITS.x3.max} onChange={(value) => updateGeometry('x3', value)} error={errorMap.x3} />
                <InputField {...bindGeometryFocus('x4')} field="x4" label="Gövde üst kalınlığı" unit="x4 · m" value={geometryInputValue('x4')} min={GEOMETRY_LIMITS.x4.min} max={GEOMETRY_LIMITS.x4.max} onChange={(value) => updateGeometry('x4', value)} error={errorMap.x4} />
                <InputField {...bindGeometryFocus('x5')} field="x5" label="Temel plağı kalınlığı" unit="x5 · m" value={geometryInputValue('x5')} min={GEOMETRY_LIMITS.x5.min} max={GEOMETRY_LIMITS.x5.max} onChange={(value) => updateGeometry('x5', value)} error={errorMap.x5} />
              </div>
              <div
                id="geometry-field-x6"
                tabIndex={-1}
                onFocus={() => setFocusedGeoField('x6')}
                onBlur={() => setFocusedGeoField(null)}
                onClick={() => setSelectedGeoField('x6')}
                className="flex items-center justify-between rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs text-[var(--sf-text-secondary)] focus:outline-none"
                style={selectedGeoField === 'x6' ? { borderColor: geometryFieldColors.x6, borderWidth: '1.5px' } : undefined}
              >
                <span>Topuk uzunluğu otomatik türetilir</span>
                <span className="font-mono">x6 = {fmt(wallInput.geometry.x6)} m</span>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="params" className="m-0 space-y-4 p-3">
            <section>
              <SectionTitle icon={<Mountain className="size-4" />} title="Zemin ve yükler" detail="Zemin türü, sayısal parametrelerin anlamını ve stabiliteye etkisini görünür kılar." />
              <div className="space-y-3">
                {(['backfillSoil', 'foundationSoil'] as const).map((soilKey) => {
                  const soil = wallInput[soilKey];
                  const title = soilKey === 'backfillSoil' ? 'Arka dolgu zemini' : 'Temel altı zemini';
                  const selected = soilTypes.find((option) => option.value === (soil.type ?? 'custom')) ?? soilTypes[soilTypes.length - 1];
                  return (
                    <div key={soilKey} className="sf-form-card">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--sf-text-primary)]">{title}</span>
                        <Select value={soil.type ?? 'custom'} onValueChange={(value: string | null) => value && updateSoil(soilKey, { type: value as SoilType })}>
                          <SelectTrigger className="sf-form-control h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] text-[var(--sf-text-secondary)]">
                            {soilTypes.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="mb-2 text-xs leading-4 text-[var(--sf-text-muted)]">{selected.hint}</p>
                      <div className="sf-form-grid-2">
                        <InputField label="Birim hacim ağırlığı" unit="γ · kN/m³" value={soil.gamma} min={0} max={40} onChange={(value) => updateSoil(soilKey, { gamma: Number(value) })} />
                        <InputField label="İçsel sürtünme açısı" unit="φ · °" value={soil.phi} min={0} max={50} onChange={(value) => updateSoil(soilKey, { phi: Number(value) })} />
                        <InputField label="Kohezyon" unit="c · kPa" value={soil.c} min={0} max={200} onChange={(value) => updateSoil(soilKey, { c: Number(value) })} />
                      </div>
                    </div>
                  );
                })}
                <InputField label="Sürşarj yükü" unit="q · kN/m²" value={wallInput.surchargeLoad} min={0} max={200} onChange={(value) => setWallInput({ surchargeLoad: Number(value) })} description="Arka dolgu üzerindeki yayılı yük; aktif toprak basıncını artırır." />
              </div>
            </section>

            <section>
              <SectionTitle icon={<ShieldCheck className="size-4" />} title="Hesap yöntemi" detail="Final analiz akışı sabittir: yanal toprak basıncı Coulomb, taşıma gücü Terzaghi ile hesaplanır." />
              <div className="sf-form-grid-2">
                <div className="rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] p-2.5"><p className="text-xs font-medium text-[var(--sf-text-secondary)]">Yanal toprak basıncı</p><p className="mt-1 font-mono text-sm font-semibold text-[var(--sf-text-primary)]">Coulomb</p></div>
                <div className="rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] p-2.5"><p className="text-xs font-medium text-[var(--sf-text-secondary)]">Taşıma gücü</p><p className="mt-1 font-mono text-sm font-semibold text-[var(--sf-text-primary)]">Terzaghi</p></div>
                <label className="sf-form-field text-xs text-[var(--sf-text-secondary)]"><span className="sf-form-label-row">Beton sınıfı · sabit hedef</span><Select value={wallInput.concreteClass} onValueChange={(value: string | null) => value && setWallInput({ concreteClass: value as ConcreteClass })}><SelectTrigger className="sf-form-control h-8 w-full text-xs"><SelectValue /></SelectTrigger><SelectContent className="border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] text-[var(--sf-text-secondary)]">{concreteClasses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></label>
                <div className="rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] p-2.5 text-xs text-[var(--sf-text-secondary)]">
                  <p className="font-medium text-[var(--sf-text-primary)]">Aktif basınç konvansiyonu · kilitli</p>
                  <p className="mt-1 leading-5 text-[var(--sf-text-muted)]">Topuk ucunda düşey sanal düzlem; δ = 0° ve β = 0°. Faydalı düşey aktif itki bileşeni kullanılmaz (Paᵥ = 0).</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs leading-4 text-[var(--sf-text-secondary)]"><Info className="mt-0.5 size-3.5 shrink-0 text-[var(--sf-action-primary)]" /><span>Optimizasyon sırasında bu beton sınıfı değişmez. Sistem yalnızca bağlayıcı/SCM ve atık malzeme dağılımını değiştirir.</span></div>
            </section>
          </TabsContent>

          <TabsContent value="materials" className="m-0 p-0"><MaterialSelectionPanel /></TabsContent>

          <TabsContent value="rebar" className="m-0 space-y-4 p-3">
            <section>
              <SectionTitle icon={<Ruler className="size-4" />} title="Donatı talebi ve uygulama" detail="Motorun gerekli As talebi ile seçilen çap/aralık kapasitesi ayrı izlenir." />
              <label className="sf-form-field text-xs text-[var(--sf-text-secondary)]"><span className="sf-form-label-row">Uygulama seçimi</span><Select value={reinforcement.mode} onValueChange={(value: string | null) => value && setWallInput({ reinforcement: { ...reinforcement, mode: value as 'automatic' | 'custom' } })}><SelectTrigger className="sf-form-control h-8 w-full text-xs"><SelectValue /></SelectTrigger><SelectContent className="border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] text-[var(--sf-text-secondary)]"><SelectItem value="automatic">Otomatik · yapısal talebe göre</SelectItem><SelectItem value="custom">Kullanıcı hedefi · kg/m³</SelectItem></SelectContent></Select></label>
              {reinforcement.mode === 'custom' && <div className="mt-3"><InputField label="Uygulanan donatı hedefi" unit="kg/m³ beton" value={reinforcement.customRatioKgM3} min={40} max={180} step={1} onChange={(value) => setWallInput({ reinforcement: { ...reinforcement, customRatioKgM3: Number(value) } })} description="Bu bir kullanıcı uygulama hedefidir; motor gerekli yapısal talebin altına düşmez." /></div>}
              <div className="sf-form-grid-2 mt-3">
                <InputField label="Betonarme tasarım dayanımı f'c" unit="MPa" value={rcDesign.fcMpa} min={10} max={100} step={1} onChange={(value) => setWallInput({ rcDesign: { ...rcDesign, fcMpa: Number(value) } })} description="Betonarme ön hesabında kullanılan tasarım girdisidir. Reçetedeki deneysel basınç dayanımıyla otomatik eşitlenmez." />
                <InputField label="Donatı akma dayanımı fy" unit="MPa" value={rcDesign.fyMpa} min={200} max={700} step={10} onChange={(value) => setWallInput({ rcDesign: { ...rcDesign, fyMpa: Number(value) } })} />
                <InputField label="Büzülme / sıcaklık oranı" unit="ρ" value={rcDesign.shrinkageTemperatureRatio} min={0.0001} max={0.01} step={0.0001} onChange={(value) => setWallInput({ rcDesign: { ...rcDesign, shrinkageTemperatureRatio: Number(value) } })} description="ACI CODE-318-25 betonarme ön kontrolünde kullanılan brüt alan oranı." />
                <InputField label="Pas payı" unit="mm" value={reinforcement.coverMm} min={35} max={100} step={1} onChange={(value) => setWallInput({ reinforcement: { ...reinforcement, coverMm: Number(value) } })} />
                <InputField label="Tercih edilen çap" unit="Ø mm" value={reinforcement.preferredDiameterMm} min={8} max={32} step={1} onChange={(value) => setWallInput({ reinforcement: { ...reinforcement, preferredDiameterMm: Number(value) } })} />
                <InputField label="Tercih edilen aralık" unit="mm" value={reinforcement.preferredSpacingMm} min={100} max={300} step={10} onChange={(value) => setWallInput({ reinforcement: { ...reinforcement, preferredSpacingMm: Number(value) } })} />
              </div>
              <div className="sf-form-grid-2 mt-3">
                <InputField label="Minimum aralık" unit="mm" value={reinforcement.minSpacingMm} min={100} max={300} step={10} onChange={(value) => setWallInput({ reinforcement: { ...reinforcement, minSpacingMm: Number(value) } })} />
                <InputField label="Maksimum aralık" unit="mm" value={reinforcement.maxSpacingMm} min={100} max={300} step={10} onChange={(value) => setWallInput({ reinforcement: { ...reinforcement, maxSpacingMm: Number(value) } })} />
              </div>
            </section>
            <div className="rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] p-2.5 text-xs leading-4 text-[var(--sf-text-secondary)]"><span className="font-semibold text-[var(--sf-text-primary)]">Okuma kuralı:</span> “Gerekli / talep” ve “uygulanan / kapasite” değerleri kesit çizim düzlemine dik 1,00 m duvar şeridi için hesaplanır. kg/m değeri proje toplamında yalnız bir kez toplam duvar uzunluğu L ile çarpılır. Kesin uygulama projesi yerine geçmez.</div>
          </TabsContent>

          <TabsContent value="logistics" className="m-0 flex flex-col gap-4 p-3">
            <button type="button" onClick={() => setIsMapModalOpen(true)} className="flex h-8 w-full items-center justify-center gap-2 rounded-md border border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] text-xs font-semibold text-[var(--sf-text-link)] transition-colors hover:border-[var(--sf-border-focus)] hover:bg-[var(--sf-bg-selected)]"><MapPin className="size-3.5" /> Haritadan lojistik mesafesi seç</button>
            <section className="order-2">
              <SectionTitle icon={<CircleDollarSign className="size-4" />} title="Fiyat girdi tablosu" detail="Kaynak ve tarih bilgileri yalnızca ⓘ içinde; ana tabloda karar için gerekli fiyat görünür." />
              <div className="overflow-hidden rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel)]">
                <div className="grid grid-cols-[1fr_100px] border-b border-[var(--sf-divider)] bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs font-semibold text-[var(--sf-text-muted)]"><span>Hazır beton sınıfı</span><span className="text-right">TL/m³</span></div>
                {concreteClasses.map((concreteClass) => <div key={concreteClass} className="grid grid-cols-[1fr_100px] items-center border-b border-[var(--sf-divider)] px-2.5 py-1.5 last:border-0"><span className="text-xs text-[var(--sf-text-secondary)]">{concreteClass}{concreteClass === wallInput.concreteClass && <span className="ml-1.5 rounded border border-[var(--sf-border-active)] bg-[var(--sf-action-primary-subtle)] px-1.5 py-0.5 text-xs text-[var(--sf-text-link)]">aktif</span>}</span><Input type="number" min="0" step="1" value={logistics.concretePricesByClass?.[concreteClass] ?? ''} onChange={(event) => updateConcretePrice(concreteClass, event.target.value)} className="sf-form-control h-8 text-right font-mono text-xs" /></div>)}
              </div>
              <div className="sf-form-grid-2 mt-3">
                <InputField label="Donatı fiyatı" unit="TL/ton" value={logistics.rebarPrice} min={0} step={100} onChange={(value) => updateLogistics('rebarPrice', value)} />
                <InputField label="Dizel fiyatı" unit="TL/L" value={logistics.dieselPrice} min={0} step={0.1} onChange={(value) => updateLogistics('dieselPrice', value)} />
                <InputField label="Genel gider + kâr" unit="%" value={logistics.overheadPercent} min={0} max={100} step={1} onChange={(value) => updateLogistics('overheadPercent', value)} />
                <InputField label="KDV" unit="%" value={logistics.vatPercent} min={0} max={100} step={1} onChange={(value) => updateLogistics('vatPercent', value)} />
              </div>
            </section>
            <section className="order-1">
              <SectionTitle icon={<MapPin className="size-4" />} title="Mesafe ve ek iş kalemleri" />
              <div className="sf-form-grid-2">
                <InputField label="Beton santrali" unit="km" value={logistics.distancePlant} min={0} max={500} onChange={(value) => updateLogistics('distancePlant', value)} />
                <InputField label="Döküm / depolama" unit="km" value={logistics.distanceDump} min={0} max={500} onChange={(value) => updateLogistics('distanceDump', value)} />
                <InputField label="Donatı tedarikçisi" unit="km" value={logistics.distanceRebar} min={0} max={500} onChange={(value) => updateLogistics('distanceRebar', value)} />
                <InputField label="Kazı birim maliyeti" unit="TL/m³" value={logistics.excavationUnitCost} min={0} step={10} onChange={(value) => updateLogistics('excavationUnitCost', value)} />
                <InputField label="Dolgu birim maliyeti" unit="TL/m³" value={logistics.backfillUnitCost} min={0} step={10} onChange={(value) => updateLogistics('backfillUnitCost', value)} />
                <InputField label="Kalıp birim maliyeti" unit="TL/m²" value={logistics.formworkUnitCost} min={0} step={10} onChange={(value) => updateLogistics('formworkUnitCost', value)} />
                <InputField label="Donatı işçilik" unit="TL/ton" value={logistics.rebarLaborUnitCost} min={0} step={100} onChange={(value) => updateLogistics('rebarLaborUnitCost', value)} />
              </div>
            </section>
          </TabsContent>
        </div>
      </Tabs>
      <MapModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} />
    </div>
  );
}
