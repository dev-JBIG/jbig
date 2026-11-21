import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BaseStyles, ThemeProvider } from "@primer/react";

export type AppColorMode = "light" | "dark" | "auto";
export type ResolvedColorMode = "light" | "dark";

const COLOR_MODE_STORAGE_KEY = "jbig-color-mode";

interface ColorModeContextValue {
    colorMode: AppColorMode;
    resolvedColorMode: ResolvedColorMode;
    setColorMode: (mode: AppColorMode) => void;
    toggleColorMode: () => void;
}

const defaultContextValue: ColorModeContextValue = {
    colorMode: "light",
    resolvedColorMode: "light",
    setColorMode: () => {},
    toggleColorMode: () => {},
};

const ColorModeContext = createContext<ColorModeContextValue>(defaultContextValue);

const readStoredColorMode = (): AppColorMode => {
    try {
        const stored = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "auto") {
            return stored;
        }
    } catch {
        // 스토리지 접근 불가 환경에서는 기본값 사용
    }
    return "light";
};

const getSystemColorMode = (): ResolvedColorMode => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
};

export const ColorModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [colorMode, setColorModeState] = useState<AppColorMode>(readStoredColorMode);
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

    const resolvedColorMode: ResolvedColorMode = colorMode === "auto" ? systemMode : colorMode;

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute("data-color-mode", colorMode);
        root.setAttribute("data-light-theme", "light");
        root.setAttribute("data-dark-theme", "dark");
        root.style.colorScheme = resolvedColorMode;
    }, [colorMode, resolvedColorMode]);

    const setColorMode = useCallback((mode: AppColorMode) => {
        setColorModeState(mode);
        try {
            localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
        } catch {
            // 스토리지 저장 실패 무시
        }
    }, []);

    const toggleColorMode = useCallback(() => {
        setColorMode(resolvedColorMode === "dark" ? "light" : "dark");
    }, [resolvedColorMode, setColorMode]);

    const value = useMemo(
        () => ({ colorMode, resolvedColorMode, setColorMode, toggleColorMode }),
        [colorMode, resolvedColorMode, setColorMode, toggleColorMode]
    );

    return (
        <ColorModeContext.Provider value={value}>
            <ThemeProvider colorMode={colorMode} dayScheme="light" nightScheme="dark">
                <BaseStyles>{children}</BaseStyles>
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
};

export const useColorMode = (): ColorModeContextValue => useContext(ColorModeContext);
