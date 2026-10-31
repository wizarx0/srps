import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type UserRole = "admin" | "student";

type Profile = {
  role: UserRole;
  full_name: string;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  sessionError: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSessionError(null);
        setSession(nextSession);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setSessionError("Unable to restore your sign-in session. Please sign in again.");
        console.error("Unable to restore Supabase session:", error);
      }
      setSession(data.session);
      setSessionLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!session) {
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);
    void supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setProfile(null);
          setProfileError("Could not load your account profile. Contact a school administrator.");
          console.error("Unable to load the signed-in user's profile:", error);
        } else if (data.role === "admin" || data.role === "student") {
          setProfile({ role: data.role, full_name: data.full_name });
        } else {
          setProfile(null);
          setProfileError("Your account has an unsupported role. Contact a school administrator.");
        }
        setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading: sessionLoading || profileLoading || Boolean(session && !profile && !profileError),
        profileError,
        sessionError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
