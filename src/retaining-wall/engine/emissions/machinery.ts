import { getCoefficientValue } from '../../coefficients/defaults';
import { LogisticsInput, MachineryEmissionDetail, QuantityResult } from '../../types';

export interface MachineryEmissionInput {
  quantities: QuantityResult;
  logistics: LogisticsInput;
  customCoefficients?: Map<string, number>;
}

/**
 * İş Makineleri Emisyon ve Yakıt Hesaplamaları (Modül 4B)
 */
export function calculateMachineryEmissions(
  input: MachineryEmissionInput
): {
  excavator: MachineryEmissionDetail;
  dumperTruck: MachineryEmissionDetail;
  rebarTruck: MachineryEmissionDetail;
  concreteMixer: MachineryEmissionDetail;
  concretePump: MachineryEmissionDetail;
  compactor: MachineryEmissionDetail;
  totalEmission: number;
  totalFuel: number;
  totalCost: number;
} {
  const { quantities, logistics, customCoefficients } = input;

  const V_kazi = quantities.excavationVolume;
  const V_dolgu = quantities.backfillVolume;
  const V_beton = quantities.concreteVolume;
  const W_donati = quantities.reinforcementWeight;

  const d_pasa = logistics.distanceDump;
  const d_donati = logistics.distanceRebar;
  const d_santral = logistics.distancePlant;
  const P_dizel = logistics.dieselPrice;

  const getCoeff = (key: string) => getCoefficientValue(key, customCoefficients);
  const EF_dizel = getCoeff('EF_dizel');

  // 1. Ekskavatör
  const ER = getCoeff('ER');
  const FE_eksk = getCoeff('FE_eksk');
  const t_eksk = V_kazi / ER;
  const CF_eksk = t_eksk * FE_eksk;
  const E_eksk = CF_eksk * EF_dizel;
  const Cost_eksk = CF_eksk * P_dizel;

  // 2. Damperli Kamyon
  const CAP_damper = getCoeff('CAP_damper');
  const FE_damper = getCoeff('FE_damper');
  const N_sefer_damper = Math.ceil(V_kazi / CAP_damper);
  const D_damper = N_sefer_damper * 2 * d_pasa;
  const CF_damper = D_damper * FE_damper;
  const E_damper = CF_damper * EF_dizel;
  const Cost_damper = CF_damper * P_dizel;

  // 3. Donatı Tırı
  const CAP_tir = getCoeff('CAP_tir');
  const FE_tir_yuklu = getCoeff('FE_tir_yuklu');
  const FE_tir_bos = getCoeff('FE_tir_bos');
  // Donatı 0 ise tır seferi yoktur
  const N_sefer_tir = W_donati > 0 ? Math.ceil(W_donati / CAP_tir) : 0;
  const CF_tir = N_sefer_tir * d_donati * (FE_tir_yuklu + FE_tir_bos);
  const E_tir = CF_tir * EF_dizel;
  const Cost_tir = CF_tir * P_dizel;

  // 4. Beton Mikseri
  const CAP_mixer = getCoeff('CAP_mixer');
  const FE_mixer_yuklu = getCoeff('FE_mixer_yuklu');
  const FE_mixer_bos = getCoeff('FE_mixer_bos');
  const FE_mixer_rol = getCoeff('FE_mixer_rol');
  const DR = getCoeff('DR');
  const t_temiz_mixer_min = getCoeff('t_temiz_mixer');
  
  const N_sefer_mixer = V_beton > 0 ? Math.ceil(V_beton / CAP_mixer) : 0;
  const D_mixer_yuklu = N_sefer_mixer * d_santral;
  const D_mixer_bos = N_sefer_mixer * d_santral;
  const t_bekleme_hr = N_sefer_mixer * (CAP_mixer / DR) / 60;
  const t_temiz_mixer_hr = N_sefer_mixer * (t_temiz_mixer_min / 60);
  
  const CF_mixer = D_mixer_yuklu * FE_mixer_yuklu + D_mixer_bos * FE_mixer_bos + (t_bekleme_hr + t_temiz_mixer_hr) * FE_mixer_rol;
  const E_mixer = CF_mixer * EF_dizel;
  const Cost_mixer = CF_mixer * P_dizel;

  // 5. Beton Pompası
  const FE_pompa_yol = getCoeff('FE_pompa_yol');
  const FE_pompa_cal = getCoeff('FE_pompa_cal');
  const PR = getCoeff('PR');
  const t_vardiya = getCoeff('t_vardiya');
  const t_temiz_pompa_min = getCoeff('t_temiz_pompa');

  let CF_pompa = 0;
  if (V_beton > 0) {
    const t_working_pompa = V_beton / PR;
    const N_days = Math.ceil(t_working_pompa / t_vardiya) || 1; // En az 1 gün
    const D_travel_pompa = N_days * 2 * d_santral;
    const t_temiz_pompa_hr = N_days * (t_temiz_pompa_min / 60);
    CF_pompa = D_travel_pompa * FE_pompa_yol + (t_working_pompa + t_temiz_pompa_hr) * FE_pompa_cal;
  }
  const E_pompa = CF_pompa * EF_dizel;
  const Cost_pompa = CF_pompa * P_dizel;

  // 6. Kompaktör
  const FE_kompak = getCoeff('FE_kompak');
  const KR = getCoeff('KR');
  const h_katman = getCoeff('h_katman');
  const N_gecis = getCoeff('N_gecis');
  
  let CF_kompak = 0;
  if (V_dolgu > 0) {
    const effective_area = (V_dolgu / h_katman) * N_gecis;
    const t_kompak = effective_area / KR;
    CF_kompak = t_kompak * FE_kompak;
  }
  const E_kompak = CF_kompak * EF_dizel;
  const Cost_kompak = CF_kompak * P_dizel;

  // Toplamlar
  const totalFuel = CF_eksk + CF_damper + CF_tir + CF_mixer + CF_pompa + CF_kompak;
  const totalEmission = E_eksk + E_damper + E_tir + E_mixer + E_pompa + E_kompak;
  const totalCost = Cost_eksk + Cost_damper + Cost_tir + Cost_mixer + Cost_pompa + Cost_kompak;

  return {
    excavator: { machineName: 'Ekskavatör', workingTime: t_eksk, fuelConsumption: CF_eksk, emission: E_eksk, cost: Cost_eksk },
    dumperTruck: { machineName: 'Damperli Kamyon', workingTime: N_sefer_damper * 2 * d_pasa / 40, fuelConsumption: CF_damper, emission: E_damper, cost: Cost_damper }, // Zamanı basitçe (km / 40 km/h) aldık
    rebarTruck: { machineName: 'Donatı Tırı', workingTime: N_sefer_tir * 2 * d_donati / 60, fuelConsumption: CF_tir, emission: E_tir, cost: Cost_tir },
    concreteMixer: { machineName: 'Beton Mikseri', workingTime: (D_mixer_yuklu + D_mixer_bos)/50 + t_bekleme_hr + t_temiz_mixer_hr, fuelConsumption: CF_mixer, emission: E_mixer, cost: Cost_mixer },
    concretePump: { machineName: 'Beton Pompası', workingTime: (V_beton > 0 ? (V_beton / PR) : 0), fuelConsumption: CF_pompa, emission: E_pompa, cost: Cost_pompa },
    compactor: { machineName: 'Kompaktör', workingTime: (V_dolgu > 0 ? ((V_dolgu / h_katman) * N_gecis) / KR : 0), fuelConsumption: CF_kompak, emission: E_kompak, cost: Cost_kompak },
    totalEmission,
    totalFuel,
    totalCost
  };
}
