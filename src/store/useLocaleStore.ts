import { create } from 'zustand';
import { tr } from '../i18n/tr';
import { en } from '../i18n/en';

type Locale = 'tr' | 'en';
type Dictionary = typeof tr;

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof Dictionary) => string;
}

const dictionaries = {
  tr,
  en
};

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: 'tr',
  setLocale: (l: Locale) => set({ locale: l }),
  t: (key: keyof Dictionary) => {
    const locale = get().locale;
    const dictionary = dictionaries[locale] || dictionaries['tr'];
    return dictionary[key] || key;
  }
}));
