import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("School portal connection is not configured. Contact your administrator.");
}

let persistAuthSession = false;

export function setAuthSessionPersistence(rememberSession: boolean) {
  persistAuthSession = rememberSession;
}

const authStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    const preferredStorage = persistAuthSession ? window.localStorage : window.sessionStorage;
    const alternateStorage = persistAuthSession ? window.sessionStorage : window.localStorage;
    preferredStorage.setItem(key, value);
    alternateStorage.removeItem(key);
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { storage: authStorage, persistSession: true },
});
