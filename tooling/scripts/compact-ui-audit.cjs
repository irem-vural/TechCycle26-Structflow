const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

const src = './artifacts/generated/ui-dataset-audit/ui-audit.json';
const outDir = './artifacts/generated/ui-dataset-audit/compact-transfer';
const data = JSON.parse(fs.readFileSync(src, 'utf8'));

function firstNumber(text, re) {
  const m = (text || '').match(re);
  if (!m) return null;
  const raw = m[1].replace(/\./g, '').replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function firstText(text, re) {
  const m = (text || '').match(re);
  return m ? m[1].trim() : null;
}

function extractCase(c) {
  const o = c.overviewText || '';
  const e = c.engineeringText || '';
  const s = c.sustainabilityText || '';
  const cost = c.costLogisticsText || '';
  const intended = c.intendedInputs || {};
  const read = c.uiReadback || {};
  const measurement = (intended.compressiveStrengthMeasurements || [])[0] || null;

  const missingEmission = /Eksik emisyon verisi/.test(s)
    ? firstText(s, /Eksik emisyon verisi[\s\S]*?(?:•\s*)?([^\n]+(?:emisyon faktörü|faktörü eksik)[^\n]*)/i)
    : null;

  return {
    testId: c.testId,
    order: c.order,
    sourceRow: c.sourceRow,
    mixNo: c.mixNo,
    literatureStudy: c.literatureStudy,
    sourceUrl: c.sourceUrl,
    status: c.status,
    resultWarningCount: c.resultWarningCount,
    incompleteData: Boolean(c.incompleteData),
    calculationClicked: Boolean(c.calculation?.clicked),
    calculationBlocked: Boolean(c.calculation?.blocked),
    calculationMessage: c.calculation?.message || '',
    inputErrors: c.uiInputErrors || [],
    inputMismatches: c.inputMismatches || [],
    inputNormalizations: c.uiNormalizations || [],
    unsupportedSourceFields: c.unsupportedSourceFields || [],
    inputPanelWarnings: c.inputPanelWarnings || [],

    inputs: {
      cement: intended.cementKgM3 ?? null,
      flyAsh: intended.flyAshKgM3 ?? null,
      ggbfs: intended.ggbfsKgM3 ?? null,
      silicaFume: intended.silicaFumeKgM3 ?? null,
      metakaolin: intended.metakaolinKgM3 ?? null,
      naturalFine: intended.naturalFineAggregateKgM3 ?? null,
      naturalCoarse: intended.naturalCoarseAggregateKgM3 ?? null,
      recycledGeneral: intended.recycledAggregateUnspecifiedKgM3 ?? null,
      recycledFine: intended.recycledFineAggregateKgM3 ?? null,
      recycledCoarse: intended.recycledCoarseAggregateKgM3 ?? null,
      lightweight: intended.lightweightAggregateKgM3 ?? null,
      heavyweight: intended.heavyweightAggregateKgM3 ?? null,
      water: intended.waterKgM3 ?? null,
      sodiumHydroxide: intended.sodiumHydroxideKgM3 ?? null,
      sodiumSilicate: intended.sodiumSilicateKgM3 ?? null,
      alkaliActivator: intended.alkaliActivatorKgM3 ?? null,
      superplasticizer: intended.superplasticizerKgM3 ?? null,
      airEntraining: intended.airEntrainingKgM3 ?? null,
      acceleratorRetarder: intended.acceleratorRetarderKgM3 ?? null,
      fiber: intended.fiberKgM3 ?? null,
      airTarget: intended.airTargetContentPercent ?? null,
      strengthMpa: measurement?.valueMpa ?? null,
      strengthAgeDays: measurement?.ageDays ?? null,
    },
    uiReadback: {
      cement: read.cementKgM3 ?? null,
      flyAsh: read.flyAshKgM3 ?? null,
      ggbfs: read.ggbfsKgM3 ?? null,
      silicaFume: read.silicaFumeKgM3 ?? null,
      metakaolin: read.metakaolinKgM3 ?? null,
      naturalFine: read.naturalFineAggregateKgM3 ?? null,
      naturalCoarse: read.naturalCoarseAggregateKgM3 ?? null,
      recycledGeneral: read.recycledAggregateUnspecifiedKgM3 ?? null,
      recycledFine: read.recycledFineAggregateKgM3 ?? null,
      recycledCoarse: read.recycledCoarseAggregateKgM3 ?? null,
      water: read.waterKgM3 ?? null,
      sodiumHydroxide: read.sodiumHydroxideKgM3 ?? null,
      sodiumSilicate: read.sodiumSilicateKgM3 ?? null,
      alkaliActivator: read.alkaliActivatorKgM3 ?? null,
      superplasticizer: read.superplasticizerKgM3 ?? null,
      airEntraining: read.airEntrainingKgM3 ?? null,
      airTarget: read.airTargetContentPercent ?? null,
    },

    outputs: {
      totalProjectCostTl: firstNumber(o, /Toplam proje maliyeti\s+₺([\d\.]+)/),
      costPerWallMtl: firstNumber(o, /₺([\d\.]+) \/ m duvar/),
      concreteCostTlM3: firstNumber(o, /Beton maliyeti\s+₺([\d\.]+)\/ m³/),
      totalCo2Kg: firstNumber(o, /Toplam CO₂e\s+([\d\.,]+)kgCO₂e/),
      co2KgM3: firstNumber(o, /([\d\.,]+) kgCO₂e\/m³/),
      co2KgPerWallM: firstNumber(o, /· ([\d\.,]+) kgCO₂e\/m/),
      concreteVolumeM3: firstNumber(o, /Beton hacmi\s+([\d\.,]+)m³/),
      appliedRebarKgPerM: firstNumber(o, /Donatı · uygulanan\s+([\d\.,]+) kg\/m/),
      appliedRebarTotalKg: firstNumber(o, /Donatı · uygulanan[\s\S]*?([\d\.,]+) kg\s+Maliyet/),
      ka: firstNumber(o, /Ka\s+([\d\.,]+)/),
      paKnM: firstNumber(o, /Pa\s+([\d\.,]+) kN\/m/),
      slidingFs: firstNumber(o, /Kayma\s+FS ([\d\.,]+) \/ [\d\.,]+/),
      slidingStatus: firstText(o, /Kayma\s+FS [\d\.,]+ \/ [\d\.,]+\s+([^\n]+)/),
      overturningFs: firstNumber(o, /Devrilme\s+FS ([\d\.,]+) \/ [\d\.,]+/),
      overturningStatus: firstText(o, /Devrilme\s+FS [\d\.,]+ \/ [\d\.,]+\s+([^\n]+)/),
      bearingFs: firstNumber(o, /Taşıma gücü\s+FS ([\d\.,]+) \/ [\d\.,]+/),
      bearingStatus: firstText(o, /Taşıma gücü\s+FS [\d\.,]+ \/ [\d\.,]+\s+([^\n]+)/),
      kp: firstNumber(e, /Kp\s+([\d\.,]+)/),
      paVerticalKnM: firstNumber(e, /Pa düşey · final model\s+([\d\.,]+)kN\/m/),
      precheckDemandKgM: firstNumber(e, /Ön kontrol talebi\s+([\d\.,]+)kg\/m/),
      selectedRebarKgM: firstNumber(e, /Seçilen donatı düzeni\s+([\d\.,]+)kg\/m/),
      binderKgM3: firstNumber(s, /Bağlayıcı\s+([\d\.,]+)kg\/m³/),
      scmKgM3: firstNumber(s, /SCM \/ ikincil bağlayıcı\s+([\d\.,]+)kg\/m³/),
      recycledAggregateKgM3: firstNumber(s, /Geri dönüştürülmüş agrega\s+([\d\.,]+)kg\/m³/),
      waterBinderRatio: firstNumber(s, /Su\/bağlayıcı\s+([\d\.,]+)/),
      activeRecipeCostTlM3: firstNumber(s, /Reçete malzeme maliyeti[\s\S]*?AKTİF · CUSTOM[\s\S]*?₺([\d\.]+) \/ m³/),
      activeStrengthMpa: firstNumber(s, /Aktif deneysel dayanım\s+([\d\.,]+) MPa/),
      circularAlternativeTon: firstNumber(s, /Döngüsel \/ alternatif malzeme\s+([\d\.,]+) ton/),
      cementTon: firstNumber(s, /ÇİMENTO\s+([\d\.,]+) ton/),
      naturalAggregateTon: firstNumber(s, /DOĞAL AGREGA\s+([\d\.,]+) ton/),
      recipeCo2Ton: firstNumber(s, /REÇETE CO₂E\s+([\d\.,]+) ton/),
      materialCo2Kg: firstNumber(s, /Reçete malzemeleri · çelik hariç[\s\S]*?([\d\.,]+) kgCO₂e/),
      rebarCo2Kg: firstNumber(s, /Donatı çeliği[\s\S]*?([\d\.,]+) kgCO₂e/),
      siteEquipmentCo2Kg: firstNumber(s, /Saha ekipmanı · mikser\/pompa hariç[\s\S]*?([\d\.,]+) kgCO₂e/),
      deliveryOperationCo2Kg: firstNumber(s, /Beton teslimi \+ döküm operasyonu[\s\S]*?([\d\.,]+) kgCO₂e/),
      concreteTotalCostTl: firstNumber(cost, /Beton toplam\s+₺([\d\.]+)/),
      rebarCostTl: firstNumber(cost, /Donatı\s+₺([\d\.]+)/),
      excavationCostTl: firstNumber(cost, /Kazı\s+₺([\d\.]+)/),
      backfillCostTl: firstNumber(cost, /Dolgu\s+₺([\d\.]+)/),
      formworkCostTl: firstNumber(cost, /Kalıp\s+₺([\d\.]+)/),
      rebarLaborCostTl: firstNumber(cost, /Donatı işçilik\s+₺([\d\.]+)/),
      transportCostTl: firstNumber(cost, /Nakliye\s+₺([\d\.]+)/),
      fuelMachineryCostTl: firstNumber(cost, /Yakıt \/ makine\s+₺([\d\.]+)/),
      logisticsCo2Kg: firstNumber(cost, /Lojistik CO₂e\s+([\d\.,]+)kg/),
      siteFuelL: firstNumber(cost, /Şantiye yakıtı\s+([\d\.,]+)L/),
      plantDistanceKm: firstNumber(cost, /Beton santrali\s+([\d\.,]+) km/),
      rebarDistanceKm: firstNumber(cost, /Donatı tedarikçisi\s+([\d\.,]+) km/),
      dumpDistanceKm: firstNumber(cost, /Döküm sahası\s+([\d\.,]+) km/),
      missingEmissionData: missingEmission,
    },
  };
}

const compact = {
  generatedAt: data.generatedAt,
  sourceDataset: data.sourceDataset,
  cases: data.cases.map(extractCase),
};

fs.mkdirSync(outDir, { recursive: true });
const json = JSON.stringify(compact);
fs.writeFileSync(`${outDir}/compact.json`, json);
const br = zlib.brotliCompressSync(Buffer.from(json), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
const b64 = br.toString('base64');
fs.writeFileSync(`${outDir}/compact.br.b64`, b64);
const partSize = 12000;
for (let i = 0; i < b64.length; i += partSize) {
  fs.writeFileSync(`${outDir}/p${String(i / partSize + 1).padStart(2, '0')}.txt`, b64.slice(i, i + partSize));
}
console.log(JSON.stringify({
  cases: compact.cases.length,
  jsonBytes: Buffer.byteLength(json),
  base64Chars: b64.length,
  parts: Math.ceil(b64.length / partSize),
  sha256: crypto.createHash('sha256').update(b64).digest('hex'),
}, null, 2));
