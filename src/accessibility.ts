export type TextSize = "default" | "large" | "largest";

export interface AccessibilityPreferences {
  textSize: TextSize;
  highContrast: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  enhancedFocus: boolean;
}

export const defaultAccessibilityPreferences: AccessibilityPreferences = {
  textSize: "default",
  highContrast: false,
  reduceMotion: false,
  underlineLinks: false,
  enhancedFocus: false,
};

const STORAGE_KEY = "sahayata-atlas-accessibility";

export function loadAccessibilityPreferences(): AccessibilityPreferences {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultAccessibilityPreferences;
    const parsed = JSON.parse(stored) as Partial<AccessibilityPreferences>;
    const textSize = ["default", "large", "largest"].includes(parsed.textSize ?? "")
      ? parsed.textSize as TextSize
      : "default";
    return {
      textSize,
      highContrast: parsed.highContrast === true,
      reduceMotion: parsed.reduceMotion === true,
      underlineLinks: parsed.underlineLinks === true,
      enhancedFocus: parsed.enhancedFocus === true,
    };
  } catch {
    return defaultAccessibilityPreferences;
  }
}

export function applyAccessibilityPreferences(preferences: AccessibilityPreferences): void {
  const root = document.documentElement;
  root.dataset.textSize = preferences.textSize;
  root.dataset.highContrast = String(preferences.highContrast);
  root.dataset.reduceMotion = String(preferences.reduceMotion);
  root.dataset.underlineLinks = String(preferences.underlineLinks);
  root.dataset.enhancedFocus = String(preferences.enhancedFocus);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // The controls still work for this page when storage is unavailable.
  }
}
