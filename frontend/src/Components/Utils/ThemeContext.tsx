import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BaseStyles, ThemeProvider } from "@primer/react";
import { DIALOG_ROOT_ID } from "./Dialog";

export type AppColorMode = "light" | "dark" | "auto";
export type DarkThemeVariant = "dark_dimmed" | "dark";
export type ThemePreference = "auto" | "light" | "dark_dimmed" | "dark";
export type ResolvedColorMode = "light" | "dark";
export type ResolvedTheme = "light" | "dark_dimmed" | "dark";

export const COLOR_MODE_STORAGE_KEY = "jbig-color-mode";

const HEADER_THEME_COLORS: Record<ResolvedTheme, string> = {
    light: "#ffffff",
    dark_dimmed: "#212830",
    dark: "#0d1117",
};

interface ColorModeContextValue {
    /** Primer data-color-mode 호환 값 ("light" | "dark" | "auto") */
    colorMode: AppColorMode;
    /** 실제 적용 중인 밝기 모드 ("light" | "dark") */
    resolvedColorMode: ResolvedColorMode;
    /** 사용자가 선택한 4단계 테마 선호 ("auto" | "light" | "dark_dimmed" | "dark") */
    themePreference: ThemePreference;
    /** 실제 적용 중인 최종 테마 ("light" | "dark_dimmed" | "dark") */
    resolvedTheme: ResolvedTheme;
    setColorMode: (mode: AppColorMode) => void;
    setThemePreference: (pref: ThemePreference) => void;
    toggleColorMode: () => void;
}

const defaultContextValue: ColorModeContextValue = {
    colorMode: "auto",
    resolvedColorMode: "light",
    themePreference: "auto",
    resolvedTheme: "light",
    setColorMode: () => {},
    setThemePreference: () => {},
    toggleColorMode: () => {},
};

const ColorModeContext = createContext<ColorModeContextValue>(defaultContextValue);

const readStoredThemePreference = (): ThemePreference => {
    try {
        const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "dark_dimmed" || stored === "auto") {
            return stored;
        }
    } catch {
        // 스토리지 접근 불가 환경에서는 시스템 기본값 사용
    }
    return "auto";
};

const getSystemColorMode = (): ResolvedColorMode => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
};

export const ColorModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [themePreference, setThemePreferenceState] = useState<ThemePreference>(readStoredThemePreference);
    const [systemMode, setSystemMode] = useState<ResolvedColorMode>(getSystemColorMode);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (event: MediaQueryListEvent) => {
            setSystemMode(event.matches ? "dark" : "light");
        };
        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", handleChange);
            return () => mediaQuery.removeEventListener("change", handleChange);
        }
        return undefined;
    }, []);

    const colorMode: AppColorMode = themePreference === "dark_dimmed" ? "dark" : themePreference;
    const darkTheme: DarkThemeVariant = themePreference === "dark" ? "dark" : "dark_dimmed";
    const resolvedColorMode: ResolvedColorMode = colorMode === "auto" ? systemMode : colorMode;
    const resolvedTheme: ResolvedTheme = resolvedColorMode === "dark" ? darkTheme : "light";

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute("data-color-mode", colorMode);
        root.setAttribute("data-light-theme", "light");
        root.setAttribute("data-dark-theme", darkTheme);
        root.style.colorScheme = resolvedColorMode;

        const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        if (themeColorMeta) {
            themeColorMeta.setAttribute("content", HEADER_THEME_COLORS[resolvedTheme]);
        }
    }, [colorMode, darkTheme, resolvedColorMode, resolvedTheme]);

    const setThemePreference = useCallback((pref: ThemePreference) => {
        setThemePreferenceState(pref);
        try {
            localStorage.setItem(COLOR_MODE_STORAGE_KEY, pref);
        } catch {
            // 스토리지 저장 실패 무시
        }
    }, []);

    const setColorMode = useCallback((mode: AppColorMode) => {
        if (mode === "dark") {
            setThemePreference("dark_dimmed");
            return;
        }
        setThemePreference(mode);
    }, [setThemePreference]);

    const toggleColorMode = useCallback(() => {
        setThemePreference(resolvedColorMode === "dark" ? "light" : "dark_dimmed");
    }, [resolvedColorMode, setThemePreference]);

    const value = useMemo(
        () => ({
            colorMode,
            resolvedColorMode,
            themePreference,
            resolvedTheme,
            setColorMode,
            setThemePreference,
            toggleColorMode,
        }),
        [colorMode, resolvedColorMode, themePreference, resolvedTheme, setColorMode, setThemePreference, toggleColorMode]
    );

    return (
        <ColorModeContext.Provider value={value}>
            <ThemeProvider colorMode={colorMode} dayScheme="light" nightScheme={darkTheme}>
                <BaseStyles>
                    {children}
                    {/* Dialog 포털 자리: BaseStyles 안이라 모달도 앱 본문과 같은 글꼴, 색 상속을 받는다 */}
                    <div id={DIALOG_ROOT_ID} />
                </BaseStyles>
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
};

export const useColorMode = (): ColorModeContextValue => useContext(ColorModeContext);
