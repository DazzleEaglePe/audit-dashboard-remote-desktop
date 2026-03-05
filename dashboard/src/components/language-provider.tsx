"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language, TranslationKey } from '@/lib/i18n/translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    // Nested key dot notation support (e.g. t('sidebar.dashboard'))
    t: (keyPath: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('ES');

    useEffect(() => {
        const savedLang = localStorage.getItem('eca-language') as Language;
        if (savedLang && (savedLang === 'ES' || savedLang === 'EN')) {
            setLanguageState(savedLang);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('eca-language', lang);
    };

    const t = (keyPath: string): string => {
        const keys = keyPath.split('.');
        let current: any = translations[language];

        for (const k of keys) {
            if (current[k] === undefined) {
                console.warn(`Translation key not found: ${keyPath}`);
                return keyPath;
            }
            current = current[k];
        }

        return current as string;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
