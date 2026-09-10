export const employeeLanguages = ['ro', 'en', 'pa', 'hi', 'ne'] as const;
export type EmployeeLanguage = typeof employeeLanguages[number];
const key = 'employee-language';
const legacyKeys = ['team-portal-language', 'clockinandout-language'];

export function isEmployeeLanguage(value: unknown): value is EmployeeLanguage {
  return employeeLanguages.includes(value as EmployeeLanguage);
}

export function readEmployeeLanguage(): EmployeeLanguage {
  try {
    for (const name of [key, ...legacyKeys]) {
      const value = localStorage.getItem(name);
      if (isEmployeeLanguage(value)) return value;
    }
  } catch { /* The UI also works when browser storage is unavailable. */ }
  return 'ro';
}

export function saveEmployeeLanguage(language: EmployeeLanguage): void {
  if (!isEmployeeLanguage(language)) return;
  try {
    for (const name of [key, ...legacyKeys]) localStorage.setItem(name, language);
  } catch { /* Keep the current page usable without persistent storage. */ }
  document.documentElement.lang = language;
}
