import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider, useLocation, useNavigate, useParams } from "react-router";
import { AcademicSetupContent } from "./AcademicSetup";
import { AdminDataPage, AdminStudentOverview } from "./AdminLivePages";
import { ExaminationManagementContent, SubjectManagementContent } from "./AdminAcademicPages";
import { ResultEntryContent } from "./ResultEntry";
import { useAuth } from "./lib/auth";
import { setAuthSessionPersistence, supabase } from "./lib/supabase";

type Mode = "admin" | "student";

const iconMap: Record<string, string> = {
  Dashboard: "▦", Students: "♙", Subjects: "▤", Examinations: "▣", Results: "⌁", Grades: "☆", Reports: "▧", Users: "♧", Settings: "⚙", "Academic Setup": "▦",
  "My Results": "⌁", Notifications: "♧", "Add Students": "♙", "Add Subjects": "▤", "Create Examination": "▣", "Process Results": "✓", "Generate Reports": "▧",
  "My Results link": "⌁", "Examinations link": "▣", "Subjects link": "▤", "Reports link": "▧",
  school: "⌂", menu: "☰", notifications: "♧", expand_more: "⌄", query_stats: "⌁", assignment_add: "▣", arrow_forward: "→", groups: "♙", menu_book: "▤", assignment: "▣", task_alt: "✓", star: "★", workspace_premium: "✿", visibility: "◉", calendar_month: "▣", campaign: "♧"
};

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={`icon ${className}`}>{iconMap[name] || "•"}</span>;
}

function LoopingTypewriter({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState("");
  useEffect(() => {
    let index = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!deleting) {
        index += 1;
        setVisibleText(text.slice(0, index));
        if (index === text.length) {
          deleting = true;
          timer = setTimeout(tick, 4200);
        } else timer = setTimeout(tick, 220);
      } else {
        index -= 1;
        setVisibleText(text.slice(0, index));
        if (index === 0) {
          deleting = false;
          timer = setTimeout(tick, 1500);
        } else timer = setTimeout(tick, 140);
      }
    };
    timer = setTimeout(tick, 1200);
    return () => clearTimeout(timer);
  }, [text]);
  return <em className="account-typewriter">{visibleText}<i className="account-caret" /></em>;
}

function SplashScreen() {
  return <div className="splash-screen" role="status" aria-label="Loading SRPS"><div className="splash-word">{"SRPS".split("").map((letter, index) => <span key={`${letter}-${index}`} style={{ animationDelay: `${index * 70}ms` }}>{letter}</span>)}</div></div>;
}

function useRememberRoute() {
  const location = useLocation();
  const { session } = useAuth();
  useEffect(() => { if (session) localStorage.setItem("srps-last-route", location.pathname); }, [location.pathname, session]);
}

function RequireRole({ role, children }: { role: Mode; children: ReactNode }) {
  const { session, profile, loading, profileError } = useAuth();
  if (loading) return <SplashScreen />;
  if (!session) return <Navigate to="/" replace />;
  if (profileError) return <main className="sign-in"><p className="login-error">{profileError}</p></main>;
  if (!profile || profile.role !== role) return <Navigate to={profile?.role === "admin" ? "/admin" : profile?.role === "student" ? "/student" : "/"} replace />;
  return <>{children}</>;
}

function Brand() {
  return <div className="brand brand-text-only"><div><b>SRPS</b><p>Smart Result<br />Processing System</p></div></div>;
}

function closeMobileNavigation(event?: Event) {
  const target = event?.target as HTMLElement | null;
  if (target?.closest(".sidebar") || target?.closest(".hamburger")) return;
  document.body.classList.remove("mobile-nav-open");
  document.removeEventListener("pointerdown", closeMobileNavigation, true);
}

function toggleMobileNavigation() {
  if (!window.matchMedia("(max-width: 800px)").matches) {
    document.body.classList.toggle("desktop-nav-collapsed");
    return;
  }
  const opening = !document.body.classList.contains("mobile-nav-open");
  document.body.classList.toggle("mobile-nav-open", opening);
  document.removeEventListener("pointerdown", closeMobileNavigation, true);
  if (opening) window.setTimeout(() => document.addEventListener("pointerdown", closeMobileNavigation, true), 0);
}

function Sidebar({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const admin = ["Dashboard", "Students", "Student Overview", "Academic Setup", "Subjects", "Examinations", "Results", "Grades", "Reports", "Users", "Settings"];
  const student = ["Dashboard", "My Results", "Examinations", "Subjects", "Grades", "Reports", "Notifications"];
  const items = mode === "admin" ? admin : student;
  const studentRoutes: Record<string, string> = { Dashboard: "/student", "My Results": "/student/results", Examinations: "/student/examinations", Subjects: "/student/subjects", Grades: "/student/grades", Reports: "/student/reports", Notifications: "/student/notifications" };
  const adminRoutes: Record<string, string> = { Dashboard: "/admin", Students: "/admin/students", "Student Overview": "/admin/students/overview", "Academic Setup": "/admin/academic-setup", Subjects: "/admin/subjects", Examinations: "/admin/examinations", Results: "/admin/results", Grades: "/admin/grades", Reports: "/admin/reports", Users: "/admin/users", Settings: "/admin/settings" };
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Unable to sign out:", error);
      return;
    }
    localStorage.removeItem("srps-last-route");
    document.body.classList.remove("desktop-nav-collapsed");
    navigate("/");
  };
  const name = profile?.full_name ?? (mode === "admin" ? "Admin" : "Student");
  return <aside className="sidebar"><div className="sidebar-brand-row"><Brand /><button className="sidebar-toggle" aria-label="Collapse navigation" onClick={toggleMobileNavigation}><Icon name="menu" /></button></div><div className="role-chip"><span>{mode === "admin" ? "ADMIN PORTAL" : "STUDENT PORTAL"}</span></div><nav><span className="nav-kicker">MAIN MENU</span>{items.map((item, i) => { const route = mode === "student" ? studentRoutes[item] : adminRoutes[item]; const active = route ? location.pathname === route : i === 0; return <button key={item} className={active ? "active" : ""} onClick={() => route && navigate(route)}><Icon name={item} />{item}</button>; })}</nav><div className="profile"><div className="avatar">{name.charAt(0).toUpperCase()}</div><div><span>Welcome,</span><strong>{name}</strong><small><i /> {mode === "admin" ? "Online" : "Online"}</small></div></div><button className="logout" onClick={() => void signOut()}><span>⇥</span> Logout</button></aside>;
}

function Topbar({ mode }: { mode: Mode }) {
  const { profile, session } = useAuth();
  const name = profile?.full_name.split(" ")[0] ?? (mode === "admin" ? "Admin" : "Student");
  const text = mode === "admin" ? "Here's what's happening with your school results today." : "Here's an overview of your academic performance.";
  const [schoolDetails, setSchoolDetails] = useState({ schoolName: "Loading…", sessionName: "Loading…", notificationCount: 0 });
  useEffect(() => {
    if (!session) return;
    let active = true;
    const refreshSchoolName = async () => {
      const [settingsResult, sessionResult] = await Promise.all([
        supabase.from("school_settings").select("school_name").maybeSingle(),
        supabase.from("academic_sessions").select("name").eq("is_active", true).maybeSingle(),
      ]);
      const queryError = settingsResult.error ?? sessionResult.error;
      if (queryError) {
        console.error("Unable to refresh school details:", queryError);
        return;
      }
      if (active) setSchoolDetails((current) => ({
        ...current,
        schoolName: settingsResult.data?.school_name ?? "School not configured",
        sessionName: mode === "admin" ? sessionResult.data?.name ?? "No active session" : current.sessionName,
      }));
    };
    window.addEventListener("srps-school-settings-updated", refreshSchoolName);
    void (async () => {
      try {
        const [settingsResult, sessionResult, notificationResult] = await Promise.all([
          supabase.from("school_settings").select("school_name").maybeSingle(),
          supabase.from("academic_sessions").select("name").eq("is_active", true).maybeSingle(),
          supabase.from("notifications").select("id", { count: "exact", head: true })
            .or(`recipient_user_id.is.null,recipient_user_id.eq.${session.user.id}`)
            .not("published_at", "is", null),
        ]);
        const queryError = settingsResult.error ?? sessionResult.error ?? notificationResult.error;
        if (queryError) throw queryError;
        if (active) {
          setSchoolDetails({
            schoolName: settingsResult.data?.school_name ?? "School not configured",
            sessionName: sessionResult.data?.name ?? "No active session",
            notificationCount: notificationResult.count ?? 0,
          });
        }
      } catch (loadError) {
        console.error("Unable to load admin dashboard header details:", loadError);
        if (active) setSchoolDetails({ schoolName: "Unavailable", sessionName: "Unavailable", notificationCount: 0 });
      }
    })();
    return () => {
      active = false;
      window.removeEventListener("srps-school-settings-updated", refreshSchoolName);
    };
  }, [mode, session]);
  return <header className="topbar"><button className="hamburger mobile-menu-toggle" aria-label="Open navigation" onClick={toggleMobileNavigation}><Icon name="menu" /></button><div className="greeting"><h1>Welcome, {name}! <span>👋</span></h1><p>{text}</p></div><div className="school"><button className="bell"><Icon name="notifications" />{schoolDetails.notificationCount > 0 && <em>{schoolDetails.notificationCount}</em>}</button><div className="school-shield"><Icon name="school" /></div><div><strong>{schoolDetails.schoolName}</strong><small>{schoolDetails.sessionName}</small></div><Icon name="expand_more" className="chev" /></div></header>;
}

function AcademicArt({ student }: { student?: boolean }) {
  return <div className="academic-art" aria-hidden="true"><div className="halo h1" /><div className="halo h2" />{student && <div className="plant"><i /><i /><i /><b /></div>}<div className="book blue" /><div className="book green" /><div className="book gold" /><div className="cap"><div /><i /></div>{!student && <div className="result-sheet"><b>RESULT SHEET</b><span /><span /><span /><em>A</em><em>B+</em><em>A</em></div>}</div>;
}

type StudentAcademicTerm = { id: string; academic_session_id: string; name: string; term_number: number };
type StudentAcademicExam = { id: string; title: string; academic_term_id: string; class_id: string | null; starts_on: string | null; ends_on: string | null; status: string };
type RelatedRecord<T> = T | T[] | null;
type PublishedStudentResult = {
  id: string;
  score: number;
  grade: string | null;
  examinations: RelatedRecord<{
    id: string;
    title: string;
    starts_on: string | null;
    ends_on: string | null;
    status: string;
    academic_terms: RelatedRecord<StudentAcademicTerm>;
  }>;
  subjects: RelatedRecord<{ id: string; name: string; category: string | null }>;
};

function firstRelated<T>(record: RelatedRecord<T>): T | null {
  return Array.isArray(record) ? record[0] ?? null : record;
}

function resultExamination(result: PublishedStudentResult) {
  return firstRelated(result.examinations);
}

function resultTerm(result: PublishedStudentResult) {
  return firstRelated(resultExamination(result)?.academic_terms ?? null);
}

function resultSubject(result: PublishedStudentResult) {
  return firstRelated(result.subjects);
}
type StudentAcademicData = {
  studentNumber: string;
  classId: string;
  className: string;
  sessionId: string;
  sessionName: string;
  results: PublishedStudentResult[];
  subjects: Array<{ id: string; name: string; category: string | null }>;
  terms: StudentAcademicTerm[];
  sessions: Array<{ id: string; name: string }>;
  examinations: StudentAcademicExam[];
  loading: boolean;
  error: string;
};

const emptyStudentAcademicData: StudentAcademicData = {
  studentNumber: "—",
  classId: "",
  className: "—",
  sessionId: "",
  sessionName: "—",
  results: [],
  subjects: [],
  terms: [],
  sessions: [],
  examinations: [],
  loading: true,
  error: "",
};

function useStudentAcademicData(enabled = true): StudentAcademicData {
  const { session } = useAuth();
  const [data, setData] = useState(emptyStudentAcademicData);

  useEffect(() => {
    let active = true;
    if (!enabled || !session) {
      setData({ ...emptyStudentAcademicData, loading: false });
      return;
    }

    setData((current) => ({ ...current, loading: true, error: "" }));
    void (async () => {
      try {
        const [studentResult, sessionResult, sessionsResult, termsResult, resultsResult] = await Promise.all([
          supabase.from("student_profiles").select("student_number").eq("user_id", session.user.id).single(),
          supabase.from("academic_sessions").select("id, name").eq("is_active", true).maybeSingle(),
          supabase.from("academic_sessions").select("id, name").order("name"),
          supabase.from("academic_terms").select("id, academic_session_id, name, term_number").order("term_number"),
          supabase.from("results")
            .select("id, score, grade, examinations(id, title, starts_on, ends_on, status, academic_terms(id, academic_session_id, name, term_number)), subjects(id, name, category)")
            .eq("student_user_id", session.user.id)
            .eq("is_published", true)
            .order("created_at", { ascending: false }),
        ]);
        const initialError = studentResult.error ?? sessionResult.error ?? sessionsResult.error ?? termsResult.error ?? resultsResult.error;
        if (initialError) throw initialError;
        if (!studentResult.data) throw new Error("Student profile is unavailable.");

        const activeSession = sessionResult.data;
        const terms = termsResult.data ?? [];
        const termIds = terms.map((term) => term.id);
        const { data: enrollment, error: enrollmentError } = activeSession
          ? await supabase.from("student_enrollments")
            .select("class_id")
            .eq("student_user_id", session.user.id)
            .eq("academic_session_id", activeSession.id)
            .maybeSingle()
          : { data: null, error: null };
        if (enrollmentError) throw enrollmentError;
        const { data: enrolledClass, error: classError } = enrollment
          ? await supabase.from("classes").select("name").eq("id", enrollment.class_id).maybeSingle()
          : { data: null, error: null };
        if (classError) throw classError;

        let subjects: StudentAcademicData["subjects"] = [];
        let examinations: StudentAcademicExam[] = [];
        if (activeSession && enrollment) {
          const { data: allocations, error: allocationError } = await supabase.from("class_subjects")
            .select("subject_id")
            .eq("class_id", enrollment.class_id)
            .eq("academic_session_id", activeSession.id);
          if (allocationError) throw allocationError;
          const subjectIds = [...new Set((allocations ?? []).map((allocation) => allocation.subject_id))];
          if (subjectIds.length > 0) {
            const { data: subjectRows, error: subjectsError } = await supabase.from("subjects")
              .select("id, name, category")
              .in("id", subjectIds)
              .eq("is_active", true)
              .order("name");
            if (subjectsError) throw subjectsError;
            subjects = subjectRows ?? [];
          }
        }
        if (termIds.length > 0) {
          const { data: examRows, error: examinationsError } = await supabase.from("examinations")
            .select("id, title, academic_term_id, class_id, starts_on, ends_on, status")
            .in("academic_term_id", termIds)
            .order("starts_on", { ascending: true, nullsFirst: false });
          if (examinationsError) throw examinationsError;
          examinations = examRows ?? [];
        }

        if (active) {
          setData({
            studentNumber: studentResult.data.student_number,
            classId: enrollment?.class_id ?? "",
            className: enrollment ? enrolledClass?.name ?? "Class unavailable" : "Not enrolled",
            sessionId: activeSession?.id ?? "",
            sessionName: activeSession?.name ?? "No active session",
            results: (resultsResult.data ?? []) as PublishedStudentResult[],
            subjects,
            terms,
            sessions: sessionsResult.data ?? [],
            examinations,
            loading: false,
            error: "",
          });
        }
      } catch (loadError) {
        console.error("Unable to load student academic records:", loadError);
        if (active) setData({ ...emptyStudentAcademicData, loading: false, error: "Could not load your academic records. Please refresh the page." });
      }
    })();

    return () => { active = false; };
  }, [enabled, session]);

  return data;
}

function Hero({ mode, studentData }: { mode: Mode; studentData?: StudentAcademicData }) {
  const student = mode === "student";
  const navigate = useNavigate();
  return <section className={`hero ${student ? "student-hero" : ""}`}><div className="hero-copy"><span className="eyebrow">{student ? "STUDENT OVERVIEW" : "RESULTS CONTROL CENTER"}</span><h2>{student ? <>Stay Focused.<br />Keep Achieving!</> : <>Manage. Process.<br />Publish Results with Ease.</>}</h2><p>{student ? "Your hard work today builds your success tomorrow." : "A complete solution for accurate result processing, grading, and academic reporting across all classes."}</p><button className="primary" onClick={() => navigate(student ? "/student/results" : "/admin/results/entry")}><Icon name={student ? "query_stats" : "assignment_add"} /> {student ? "View My Results" : "Process New Results"}<Icon name="arrow_forward" /></button></div><AcademicArt student={student} />{student && <div className="info-card">{studentData?.error && <p className="login-error" role="alert">{studentData.error}</p>}<div><span>Academic Session</span><b>{studentData?.sessionName ?? "—"}</b></div><div><span>Class</span><b>{studentData?.className ?? "—"}</b></div><div><span>Student ID</span><b>{studentData?.studentNumber ?? "—"}</b></div></div>}</section>;
}

type DashboardStat = [string, string, string, string, string];
type AdminDashboardExam = { id: string; title: string; className: string; candidates: number; status: string; badgeType: string };
type AdminDashboardData = {
  stats: DashboardStat[];
  examinations: AdminDashboardExam[];
  loading: boolean;
  error: string;
};

function useAdminDashboardData(enabled: boolean): AdminDashboardData {
  const [stats, setStats] = useState<DashboardStat[]>([
    ["groups", "—", "Total Students", "Loading…", "blue"],
    ["menu_book", "—", "Subjects", "Loading…", "green"],
    ["assignment", "—", "Examinations", "Loading…", "orange"],
    ["query_stats", "—", "Active Session Pass Rate", "Loading…", "purple"],
  ]);
  const [examinations, setExaminations] = useState<AdminDashboardExam[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const [activeSessionResult, studentsResult, subjectsResult, settingsResult] = await Promise.all([
          supabase.from("academic_sessions").select("id").eq("is_active", true).maybeSingle(),
          supabase.from("student_profiles").select("user_id", { count: "exact", head: true }),
          supabase.from("subjects").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("school_settings").select("passing_score").eq("id", true).maybeSingle(),
        ]);
        const initialError = activeSessionResult.error ?? studentsResult.error ?? subjectsResult.error ?? settingsResult.error;
        if (initialError) throw initialError;
        const passingScore = Number(settingsResult.data?.passing_score ?? 50);

        let examinationRows: Array<{ id: string; title: string; academic_term_id: string; class_id: string | null; status: string }> = [];
        let examinationCount = 0;
        let passRate = "—";
        let passRateNote = "No published results";
        if (activeSessionResult.data) {
          const { data: terms, error: termsError } = await supabase
            .from("academic_terms").select("id").eq("academic_session_id", activeSessionResult.data.id);
          if (termsError) throw termsError;
          const termIds = (terms ?? []).map((term) => term.id);
          if (termIds.length > 0) {
            const { data: loadedExaminations, error: examinationsError, count } = await supabase
              .from("examinations")
              .select("id, title, academic_term_id, class_id, status", { count: "exact" })
              .in("academic_term_id", termIds)
              .order("created_at", { ascending: false })
              .limit(4);
            if (examinationsError) throw examinationsError;
            examinationRows = loadedExaminations ?? [];
            examinationCount = count ?? 0;

            const examinationIds: string[] = [];
            let examinationOffset = 0;
            while (true) {
              const { data: examinationPage, error: examinationPageError } = await supabase
                .from("examinations").select("id").in("academic_term_id", termIds)
                .range(examinationOffset, examinationOffset + 999);
              if (examinationPageError) throw examinationPageError;
              const page = examinationPage ?? [];
              examinationIds.push(...page.map((examination) => examination.id));
              if (page.length < 1000) break;
              examinationOffset += page.length;
            }
            if (examinationIds.length > 0) {
              let offset = 0;
              let passed = 0;
              let published = 0;
              while (true) {
                const { data: resultPage, error: resultsError } = await supabase
                  .from("results").select("score").in("examination_id", examinationIds)
                  .eq("is_published", true).range(offset, offset + 999);
                if (resultsError) throw resultsError;
                const page = resultPage ?? [];
                published += page.length;
                passed += page.filter((result) => Number(result.score) >= passingScore).length;
                if (page.length < 1000) break;
                offset += page.length;
              }
              if (published > 0) {
                passRate = `${((passed / published) * 100).toFixed(1)}%`;
                passRateNote = `Passing score ≥ ${passingScore}%`;
              }
            }
          }
        }

        const classIds = [...new Set(examinationRows.map((examination) => examination.class_id).filter((classId): classId is string => classId !== null))];
        const [classResult, ...candidateResults] = await Promise.all([
          classIds.length
            ? supabase.from("classes").select("id, name").in("id", classIds)
            : Promise.resolve({ data: [], error: null }),
          ...examinationRows.map((examination) => {
            const enrollmentQuery = supabase.from("student_enrollments")
              .select("student_user_id", { count: "exact", head: true })
              .eq("academic_session_id", activeSessionResult.data?.id ?? "");
            return examination.class_id
              ? enrollmentQuery.eq("class_id", examination.class_id)
              : enrollmentQuery;
          }),
        ]);
        if (classResult.error) throw classResult.error;
        const candidateError = candidateResults.find((result) => result.error)?.error;
        if (candidateError) throw candidateError;
        const classNameById = new Map((classResult.data ?? []).map((schoolClass) => [schoolClass.id, schoolClass.name]));
        const dashboardExaminations = examinationRows.map((examination, index) => ({
          id: examination.id,
          title: examination.title,
          className: examination.class_id ? classNameById.get(examination.class_id) ?? "Class unavailable" : "All classes",
          candidates: candidateResults[index]?.count ?? 0,
          status: examination.status.replace(/_/g, " "),
          badgeType: examination.status === "published" || examination.status === "completed"
            ? "success"
            : examination.status === "in_progress"
              ? "warning"
              : examination.status === "scheduled"
                ? "info"
                : "muted",
        }));
        if (!active) return;
        setStats([
          ["groups", String(studentsResult.count ?? 0), "Total Students", "Registered accounts", "blue"],
          ["menu_book", String(subjectsResult.count ?? 0), "Subjects", "Active", "green"],
          ["assignment", String(examinationCount), "Examinations", "This Session", "orange"],
          ["query_stats", passRate, "Active Session Pass Rate", passRateNote, "purple"],
        ]);
        setExaminations(dashboardExaminations);
      } catch (loadError) {
        console.error("Unable to load admin dashboard data:", loadError);
        if (active) {
          setStats([
            ["groups", "—", "Total Students", "Unavailable", "blue"],
            ["menu_book", "—", "Subjects", "Unavailable", "green"],
            ["assignment", "—", "Examinations", "Unavailable", "orange"],
            ["query_stats", "—", "Active Session Pass Rate", "Unavailable", "purple"],
          ]);
          setError("Could not load dashboard records. Refresh the page or check the connection.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [enabled]);

  return { stats, examinations, loading, error };
}

function StatCards({ mode, adminData, studentData }: { mode: Mode; adminData?: AdminDashboardData; studentData?: StudentAcademicData }) {
  const sessionResults = studentData?.results.filter((result) =>
    resultTerm(result)?.academic_session_id === studentData.sessionId,
  ) ?? [];
  const average = sessionResults.length
    ? sessionResults.reduce((total, result) => total + Number(result.score), 0) / sessionResults.length
    : null;
  const examinationsTaken = new Set(sessionResults.map((result) => resultExamination(result)?.id).filter(Boolean)).size;
  const studentCards: DashboardStat[] = [
    ["task_alt", studentData?.loading ? "—" : String(examinationsTaken), "Examinations Taken", studentData?.sessionName ?? "Current session", "blue"],
    ["assignment", studentData?.loading ? "—" : average === null ? "—" : `${average.toFixed(1)}%`, "Overall Average", sessionResults.length ? "Published results this session" : "No published results this session", "green"],
    ["star", studentData?.loading ? "—" : String(studentData?.subjects.length ?? 0), "Subjects Registered", studentData?.className ?? "Current class", "orange"],
    ["workspace_premium", studentData?.loading ? "—" : String(sessionResults.length), "Published Results", "This session", "purple"],
  ];
  const cards: DashboardStat[] = mode === "admin" ? adminData?.stats ?? [] : studentCards;
  return <section className="stats">{cards.map(([ico, num, label, note, color]) => <article className="stat-card" key={label}><div className={`stat-icon ${color}`}><Icon name={ico} /></div><div><b>{num}</b><span>{label}</span><small className={note.includes("+") ? "positive" : ""}>{note}</small></div></article>)}</section>;
}
function Badge({ children, type = "success" }: { children: ReactNode; type?: string }) { return <span className={`badge ${type}`}>{children}</span>; }

function usePublishedStudentResults(enabled = true) {
  const { session } = useAuth();
  const [results, setResults] = useState<PublishedStudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!enabled || !session) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    void (async () => {
      try {
        const { data, error: queryError } = await supabase
        .from("results")
        .select("id, score, grade, examinations(id, title, starts_on, ends_on, status, academic_terms(id, academic_session_id, name, term_number)), subjects(id, name, category)")
        .eq("student_user_id", session.user.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false });
        if (!active) return;
        if (queryError) {
          console.error("Unable to load published student results:", queryError);
          setResults([]);
          setError("Could not load your results. Please try again later.");
        } else {
          setResults((data ?? []) as PublishedStudentResult[]);
        }
        setLoading(false);
      } catch (queryError) {
        if (!active) return;
        console.error("Unable to load published student results:", queryError);
        setResults([]);
        setError("Could not load your results. Please try again later.");
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [enabled, session]);

  return { results, loading, error };
}

function ResultsTable({ mode, adminData, studentData }: { mode: Mode; adminData?: AdminDashboardData; studentData?: StudentAcademicData }) {
  const navigate = useNavigate();
  const student = mode === "student";
  const { results: loadedResults, loading: resultsLoading, error: resultsError } = usePublishedStudentResults(student && !studentData);

  const dashboard = adminData;
  const results = studentData?.results ?? loadedResults;
  const loading = studentData ? studentData.loading : resultsLoading;
  const error = studentData?.error ?? resultsError;

  return <section className="card results-card"><div className="card-head"><h3>{student ? "Recent Results" : "Recent Examinations"}</h3><button onClick={() => navigate(student ? "/student/results/all" : "/admin/examinations")}>View All {student ? "Results" : "Examinations"} →</button></div>{student ? error ? <p className="login-error" role="alert">{error}</p> : loading ? <p className="directory-empty">Loading published results…</p> : results.length === 0 ? <p className="directory-empty">Published results will appear here when your school releases them.</p> : <div className="table-wrap"><table><thead><tr>{["Examination", "Term", "Subject", "Score", "Grade"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{results.slice(0, 5).map((result) => <tr key={result.id}><td>{resultExamination(result)?.title ?? "Examination"}</td><td>{resultTerm(result)?.name ?? "—"}</td><td>{resultSubject(result)?.name ?? "—"}</td><td>{Number(result.score).toFixed(1)}%</td><td>{result.grade ? <Badge type="success">{result.grade}</Badge> : "—"}</td></tr>)}</tbody></table></div> : dashboard?.loading ? <p className="directory-empty">Loading examinations…</p> : dashboard?.error ? null : !dashboard?.examinations.length ? <p className="directory-empty">No examinations have been created for the active session.</p> : <div className="table-wrap"><table><thead><tr>{["Examination", "Class", "Students", "Status", "Action"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{dashboard.examinations.map((exam) => <tr key={exam.id}><td>{exam.title}</td><td>{exam.className}</td><td>{exam.candidates}</td><td><Badge type={exam.badgeType}>{exam.status}</Badge></td><td><button className="eye" aria-label={`View ${exam.title}`} onClick={() => navigate("/admin/examinations")}><Icon name="visibility" /></button></td></tr>)}</tbody></table></div>}</section>;
}
function QuickActions() { const navigate = useNavigate(); const actions = [["Add Students", "blue", "/admin/students"], ["Add Subjects", "green", "/admin/subjects"], ["Create Examination", "orange", "/admin/examinations"], ["Process Results", "purple", "/admin/results/entry"], ["Generate Reports", "aqua", "/admin/reports"]]; return <section className="card quick"><div className="card-head"><h3>Quick Actions</h3></div><div className="action-grid">{actions.map(([label, color, route]) => <button key={label} onClick={() => navigate(route)}><span className={`action-icon ${color}`}><Icon name={label} /></span>{label}</button>)}</div></section>; }
function Upcoming({ showAll = false, data }: { showAll?: boolean; data: StudentAcademicData }) {
  const navigate = useNavigate();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const exams = data.examinations.filter((exam) => {
    const term = data.terms.find((item) => item.id === exam.academic_term_id);
    if (term?.academic_session_id !== data.sessionId || exam.status === "completed") return false;
    if (exam.ends_on) return exam.ends_on >= today;
    if (exam.starts_on) return exam.starts_on >= today;
    return exam.status === "scheduled" || exam.status === "in_progress";
  });
  const visibleExams = showAll ? exams : exams.slice(0, 3);
  const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
  return <section className="card upcoming">
    <div className="card-head"><h3>Upcoming Examinations</h3><div className="result-entry-actions">{!showAll && <button type="button" onClick={() => navigate("/student/examinations")}>View All</button>}<button type="button" onClick={() => navigate("/student/examinations/history")}>Past Exams</button></div></div>
    {data.error && <p className="login-error" role="alert">{data.error}</p>}
    {data.loading ? <p className="directory-empty">Loading examinations…</p> : visibleExams.length === 0
      ? <p className="directory-empty">No upcoming examinations are scheduled for your class.</p>
      : visibleExams.map((exam) => {
        const dateText = exam.starts_on
          ? exam.ends_on && exam.ends_on !== exam.starts_on
            ? `${formatDate(exam.starts_on)} – ${formatDate(exam.ends_on)}`
            : formatDate(exam.starts_on)
          : "Date to be announced";
        const badgeType = exam.status === "in_progress" ? "warning" : exam.status === "published" ? "success" : "info";
        return <button className="exam" key={exam.id} type="button" onClick={() => navigate("/student/results")}>
          <span className="calendar"><Icon name="calendar_month" /></span>
          <div><b>{exam.title}</b><small>{data.className}</small></div>
          <div className="exam-date"><small>{dateText}</small><Badge type={badgeType}>{exam.status.replace(/_/g, " ")}</Badge></div>
        </button>;
      })}
  </section>;
}

function PastExaminationsPage() {
  useRememberRoute();
  const navigate = useNavigate();
  const data = useStudentAcademicData();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const termById = new Map(data.terms.map((term) => [term.id, term]));
  const sessionById = new Map(data.sessions.map((session) => [session.id, session.name]));
  const groups = new Map<string, { heading: string; examinations: StudentAcademicExam[] }>();
  const history = data.examinations.filter((exam) => {
    const term = termById.get(exam.academic_term_id);
    const ended = exam.ends_on ? exam.ends_on < today : Boolean(exam.starts_on && exam.starts_on < today);
    return Boolean(term) && (term?.academic_session_id !== data.sessionId || ended || exam.status === "completed");
  }).sort((left, right) => left.academic_term_id.localeCompare(right.academic_term_id)
    || (left.starts_on ?? "").localeCompare(right.starts_on ?? "")
    || left.title.localeCompare(right.title));
  for (const exam of history) {
    const term = termById.get(exam.academic_term_id);
    if (!term) continue;
    const sessionName = sessionById.get(term.academic_session_id) ?? "Session unavailable";
    const key = `${term.academic_session_id}:${term.id}`;
    const group = groups.get(key) ?? { heading: `${sessionName} · ${term.name}`, examinations: [] };
    group.examinations.push(exam);
    groups.set(key, group);
  }
  return <div className="app-shell"><Sidebar mode="student" /><main className="main"><Topbar mode="student" /><div className="content"><section className="page-intro"><span className="page-intro-icon"><Icon name="Examinations" /></span><div><span className="eyebrow">ACADEMIC RECORD</span><h2>Past Examinations</h2><p>Review completed or past examinations grouped by session and term.</p></div><button className="back-button" onClick={() => navigate("/student/examinations")}>← Upcoming Exams</button></section>{data.error && <p className="login-error" role="alert">{data.error}</p>}{data.loading ? <section className="card"><p className="directory-empty">Loading past examinations…</p></section> : history.length === 0 ? <section className="card"><p className="directory-empty">Past examinations will appear here when available.</p></section> : [...groups.entries()].map(([key, group]) => <section className="card student-result-group" key={key}><h3>{group.heading}</h3>{group.examinations.map((exam) => <div className="exam" key={exam.id}><span className="calendar"><Icon name="calendar_month" /></span><div><b>{exam.title}</b><small>{exam.starts_on ?? "Date to be announced"}{exam.ends_on && exam.ends_on !== exam.starts_on ? ` – ${exam.ends_on}` : ""}</small></div><Badge type={exam.status === "completed" ? "success" : "muted"}>{exam.status.replace(/_/g, " ")}</Badge></div>)}</section>)}</div></main></div>;
}
function StudentBottom() { const navigate = useNavigate(); const links = [["My Results", "My Results link", "blue", "/student/results"], ["Examinations", "Examinations link", "green", "/student/examinations"], ["Subjects", "Subjects link", "purple", "/student/subjects"], ["Reports", "Reports link", "orange", "/student/reports"]]; return <><LatestNotificationPreview /><section className="card links"><h3>Quick Links</h3><div>{links.map(([label, ico, color, route]) => <button key={label} onClick={() => navigate(route)}><span className={`action-icon ${color}`}><Icon name={ico} /></span>{label}</button>)}</div></section></>; }

type SchoolNotification = { id: string; title: string; message: string; recipient_user_id: string | null; published_at: string | null; created_at: string };

function LatestNotificationPreview() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [notification, setNotification] = useState<SchoolNotification | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!session) return;
    void (async () => {
      try {
        const { data, error: loadError } = await supabase.from("notifications")
          .select("id, title, message, recipient_user_id, published_at, created_at")
          .not("published_at", "is", null)
          .or(`recipient_user_id.is.null,recipient_user_id.eq.${session.user.id}`)
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (loadError) throw loadError;
        if (active) setNotification(data);
      } catch (loadError) {
        if (!active) return;
        console.error("Unable to load the latest school notification:", loadError);
        setError("Could not load the latest school notification.");
      }
    })();
    return () => { active = false; };
  }, [session]);

  if (error) return <p className="login-error" role="alert">{error}</p>;
  if (!notification) return null;
  return <section className="card announcement"><div className="announcement-icon"><Icon name="campaign" /></div><div><div className="card-head"><h3>{notification.title}</h3><button type="button" onClick={() => navigate("/student/notifications")}>View All</button></div><p>{notification.message}</p><small>Posted {new Date(notification.published_at ?? notification.created_at).toLocaleString()}.</small></div></section>;
}

function AdminNotificationPanel() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<SchoolNotification[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadNotifications = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: loadError } = await supabase.from("notifications")
        .select("id, title, message, recipient_user_id, published_at, created_at")
        .is("recipient_user_id", null)
        .order("created_at", { ascending: false });
      if (loadError) throw loadError;
      setNotifications(data ?? []);
    } catch (loadError) {
      console.error("Unable to load school notifications:", loadError);
      setError("Could not load school notifications.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadNotifications(); }, []);

  const resetForm = () => {
    setEditingId("");
    setTitle("");
    setMessage("");
    setPublishNow(true);
  };

  const saveNotification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setError("");
    setNotice("");
    const values = {
      title: title.trim(),
      message: message.trim(),
      recipient_user_id: null,
      published_at: publishNow ? new Date().toISOString() : null,
    };
    try {
      const result = editingId
        ? await supabase.from("notifications").update(values).eq("id", editingId)
        : await supabase.from("notifications").insert({ ...values, created_by: session.user.id });
      if (result.error) throw result.error;
      setNotice(editingId ? "Notification updated." : publishNow ? "Notification published to all users." : "Notification saved as a draft.");
      resetForm();
      await loadNotifications();
    } catch (saveError) {
      console.error("Unable to save school notification:", saveError);
      setError("Could not save this notification.");
    } finally {
      setSaving(false);
    }
  };

  const editNotification = (notification: SchoolNotification) => {
    setEditingId(notification.id);
    setTitle(notification.title);
    setMessage(notification.message);
    setPublishNow(Boolean(notification.published_at));
    setError("");
    setNotice("");
  };

  const togglePublished = async (notification: SchoolNotification) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const published = !notification.published_at;
      const { error: updateError } = await supabase.from("notifications")
        .update({ published_at: published ? new Date().toISOString() : null })
        .eq("id", notification.id);
      if (updateError) throw updateError;
      setNotice(published ? "Notification published to all users." : "Notification unpublished.");
      await loadNotifications();
    } catch (updateError) {
      console.error("Unable to update notification visibility:", updateError);
      setError("Could not update notification visibility.");
    } finally {
      setSaving(false);
    }
  };

  const deleteNotification = async (notification: SchoolNotification) => {
    if (!window.confirm(`Delete "${notification.title}"? This cannot be undone.`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: deleteError } = await supabase.from("notifications").delete().eq("id", notification.id);
      if (deleteError) throw deleteError;
      if (editingId === notification.id) resetForm();
      setNotice("Notification deleted.");
      await loadNotifications();
    } catch (deleteError) {
      console.error("Unable to delete school notification:", deleteError);
      setError("Could not delete this notification.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="card admin-notification-panel">
    <div className="card-head"><div><h3>School notifications</h3><p>Publish announcements for all signed-in users.</p></div><button type="button" onClick={() => void loadNotifications()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button></div>
    {error && <p className="login-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    <form className="admin-notification-form" onSubmit={(event) => void saveNotification(event)}>
      <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} required placeholder="e.g. Examination timetable available" /></label>
      <label>Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} required rows={3} placeholder="Write the announcement for students and other users." /></label>
      <label className="notification-publish-choice"><input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} /> Publish to all users now</label>
      <div className="notification-form-actions"><button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Update notification" : publishNow ? "Publish notification" : "Save draft"}</button>{editingId && <button type="button" onClick={resetForm} disabled={saving}>Cancel edit</button>}</div>
    </form>
    {loading ? <p className="directory-empty">Loading notifications…</p> : notifications.length === 0 ? <p className="directory-empty">No general notifications yet.</p> : <div className="admin-notification-list">{notifications.map((item) => <article className="admin-notification-item" key={item.id}><div><div className="notification-item-heading"><h4>{item.title}</h4><Badge type={item.published_at ? "success" : "muted"}>{item.published_at ? "Published" : "Draft"}</Badge></div><p>{item.message}</p><small>{item.published_at ? `Published ${new Date(item.published_at).toLocaleString()}` : `Created ${new Date(item.created_at).toLocaleString()}`}</small></div><div className="record-actions"><button type="button" disabled={saving} onClick={() => editNotification(item)}>Edit</button><button type="button" disabled={saving} onClick={() => void togglePublished(item)}>{item.published_at ? "Unpublish" : "Publish"}</button><button type="button" className="delete-record" disabled={saving} onClick={() => void deleteNotification(item)}>Delete</button></div></article>)}</div>}
  </section>;
}

function StudentNotifications() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<SchoolNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      if (!session) {
        setNotifications([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const { data, error: loadError } = await supabase.from("notifications")
          .select("id, title, message, recipient_user_id, published_at, created_at")
          .not("published_at", "is", null)
          .or(`recipient_user_id.is.null,recipient_user_id.eq.${session.user.id}`)
          .order("published_at", { ascending: false });
        if (loadError) throw loadError;
        if (active) setNotifications(data ?? []);
      } catch (loadError) {
        if (!active) return;
        console.error("Unable to load user notifications:", loadError);
        setError("Could not load notifications. Please try again later.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadNotifications();
    return () => { active = false; };
  }, [session]);

  return <section className="card list-page">
    <div className="card-head"><h3>School notifications</h3></div>
    {error && <p className="login-error" role="alert">{error}</p>}
    {loading ? <p className="directory-empty">Loading notifications…</p> : notifications.length === 0
      ? <p className="directory-empty">There are no current notifications.</p>
      : notifications.map((item) => <article className="notice-row" key={item.id}><span className="notice-icon"><Icon name="Notifications" /></span><div><b>{item.title}</b><p>{item.message}</p><small>Posted {new Date(item.published_at ?? item.created_at).toLocaleString()}</small></div></article>)}
  </section>;
}

function Dashboard({ mode }: { mode: Mode }) {
  useRememberRoute();
  const student = mode === "student";
  const studentData = useStudentAcademicData(student);
  const adminData = useAdminDashboardData(!student);
  return <div className="app-shell"><Sidebar mode={mode} /><main className="main"><Topbar mode={mode} /><div className="content"><Hero mode={mode} studentData={studentData} />{!student && adminData.error && <p className="login-error" role="alert">{adminData.error}</p>}{student && studentData.error && <p className="login-error" role="alert">{studentData.error}</p>}<StatCards mode={mode} adminData={adminData} studentData={studentData} /><div className={`dashboard-grid ${student ? "student-grid" : ""}`}><div className="left-stack"><ResultsTable mode={mode} adminData={adminData} studentData={studentData} />{student && <StudentBottom />}</div><div className="right-stack">{student ? <><Upcoming data={studentData} /><section className="card mobile-links"><StudentBottom /></section></> : <QuickActions />}</div></div>{!student && <AdminNotificationPanel />}</div></main></div>;
}

const studentPageInfo: Record<string, { title: string; subtitle: string; icon: string }> = {
  results: { title: "My Results", subtitle: "Review your performance across every examination.", icon: "⌁" },
  examinations: { title: "Examinations", subtitle: "Keep track of scheduled tests and examinations.", icon: "▣" },
  subjects: { title: "My Subjects", subtitle: "Your registered subjects for the current session.", icon: "▤" },
  grades: { title: "Grades & Performance", subtitle: "Review your current-session average and published grade distribution.", icon: "☆" },
  reports: { title: "Academic Reports", subtitle: "Access and download your academic report documents.", icon: "▧" },
  notifications: { title: "Notifications", subtitle: "Stay up to date with important school updates.", icon: "♧" },
};

type StudentReportDocument = { id: string; academic_term_id: string; title: string; storage_path: string | null; created_at: string };
type ReportTerm = { id: string; academic_session_id: string; name: string };
type ReportSession = { id: string; name: string };
const REPORT_BUCKET = "student-reports";

function StudentReports() {
  const { session } = useAuth();
  const [reports, setReports] = useState<StudentReportDocument[]>([]);
  const [terms, setTerms] = useState<ReportTerm[]>([]);
  const [sessions, setSessions] = useState<ReportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingReportId, setDownloadingReportId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!session) {
        setReports([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const [reportResult, termResult, sessionResult] = await Promise.all([
          supabase.from("student_reports")
            .select("id, academic_term_id, title, storage_path, created_at")
            .eq("student_user_id", session.user.id)
            .eq("status", "published")
            .not("storage_path", "is", null)
            .order("created_at", { ascending: false }),
          supabase.from("academic_terms").select("id, academic_session_id, name"),
          supabase.from("academic_sessions").select("id, name"),
        ]);
        const queryError = reportResult.error ?? termResult.error ?? sessionResult.error;
        if (queryError) throw queryError;
        if (!active) return;
        setReports(reportResult.data ?? []);
        setTerms(termResult.data ?? []);
        setSessions(sessionResult.data ?? []);
      } catch (loadError) {
        if (!active) return;
        console.error("Unable to load student report documents:", loadError);
        setError("Could not load your reports. Please try again later.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [session]);

  const downloadReport = async (report: StudentReportDocument) => {
    if (!report.storage_path) return;
    setDownloadingReportId(report.id);
    setError("");
    try {
      const { data, error: downloadError } = await supabase.storage
        .from(REPORT_BUCKET)
        .createSignedUrl(report.storage_path, 60, { download: true });
      if (downloadError) throw downloadError;
      window.location.assign(data.signedUrl);
    } catch (downloadError) {
      console.error("Unable to download student report:", downloadError);
      setError("Could not download this report. Please try again later.");
    } finally {
      setDownloadingReportId("");
    }
  };

  const termById = new Map(terms.map((term) => [term.id, term]));
  const sessionById = new Map(sessions.map((academicSession) => [academicSession.id, academicSession.name]));
  return <section className="card list-page">
    <div className="card-head"><h3>Available Reports</h3></div>
    {error && <p className="login-error" role="alert">{error}</p>}
    {loading ? <p className="directory-empty">Loading reports…</p> : reports.length === 0
      ? <p className="directory-empty">Published report documents will appear here when they are available.</p>
      : reports.map((report) => {
        const term = termById.get(report.academic_term_id);
        return <div className="report-row" key={report.id}>
          <span className="report-icon"><Icon name="Reports" /></span>
          <div><b>{report.title}</b><small>{term ? `${sessionById.get(term.academic_session_id) ?? "Session"} · ${term.name}` : "Term unavailable"}</small></div>
          <Badge type="success">Ready</Badge>
          <button type="button" disabled={downloadingReportId === report.id} onClick={() => void downloadReport(report)}>
            {downloadingReportId === report.id ? "Preparing…" : "Download PDF"}
          </button>
        </div>;
      })}
  </section>;
}

function StudentPage({ page }: { page: keyof typeof studentPageInfo }) {
  useRememberRoute();
  const info = studentPageInfo[page];
  const navigate = useNavigate();
  const academicData = useStudentAcademicData(page !== "reports" && page !== "notifications");
  const sessionResults = academicData.results.filter((result) =>
    resultTerm(result)?.academic_session_id === academicData.sessionId,
  );
  const sessionAverage = sessionResults.length
    ? sessionResults.reduce((total, result) => total + Number(result.score), 0) / sessionResults.length
    : null;
  const gradeCounts = new Map<string, number>();
  for (const result of sessionResults) {
    if (result.grade) gradeCounts.set(result.grade, (gradeCounts.get(result.grade) ?? 0) + 1);
  }
  const content = page === "results"
    ? <ResultsTable mode="student" studentData={academicData} />
    : page === "examinations"
      ? <Upcoming showAll data={academicData} />
      : page === "subjects"
        ? <section className="card list-page"><div className="card-head"><div><h3>Registered Subjects</h3><p>{academicData.className} · {academicData.sessionName}</p></div><Badge type="info">{academicData.loading ? "…" : academicData.subjects.length} Subjects</Badge></div>{academicData.error ? <p className="login-error" role="alert">{academicData.error}</p> : academicData.loading ? <p className="directory-empty">Loading subjects…</p> : academicData.subjects.length === 0 ? <p className="directory-empty">No subjects are allocated to your class for this session.</p> : academicData.subjects.map((subject) => <div className="subject-row" key={subject.id}><span className="subject-icon"><Icon name="Subjects" /></span><div><b>{subject.name}</b><small>{subject.category ?? "Registered subject"} · {academicData.sessionName}</small></div></div>)}</section>
        : page === "grades"
          ? <div className="grade-layout"><section className="card grade-score"><span>Current Session Average</span><b>{academicData.loading ? "—" : sessionAverage === null ? "—" : `${sessionAverage.toFixed(1)}%`}</b><small>{academicData.sessionName} · {sessionResults.length} published results</small><div className="gpa-meter"><i style={{ width: `${Math.min(sessionAverage ?? 0, 100)}%` }} /></div>{academicData.error && <p className="login-error" role="alert">{academicData.error}</p>}</section><section className="card list-page"><div className="card-head"><h3>Grade distribution</h3></div>{academicData.loading ? <p className="directory-empty">Loading grades…</p> : gradeCounts.size === 0 ? <p className="directory-empty">Published grades will appear here when available.</p> : [...gradeCounts.entries()].sort((left, right) => left[0].localeCompare(right[0])).map(([grade, count]) => <div className="grade-row" key={grade}><span>Grade {grade}</span><b>{count} {count === 1 ? "result" : "results"}</b></div>)}</section></div>
          : page === "reports"
            ? <StudentReports />
            : <StudentNotifications />;
  return <div className="app-shell"><Sidebar mode="student" /><main className="main"><Topbar mode="student" /><div className="content"><section className="page-intro"><span className="page-intro-icon">{info.icon}</span><div><span className="eyebrow">STUDENT PORTAL</span><h2>{info.title}</h2><p>{info.subtitle}</p></div><button className="back-button" onClick={() => navigate("/student")}>← Dashboard</button></section><div className="student-page-content">{content}</div></div></main></div>;
}

function AllResultsPage() {
  useRememberRoute();
  const navigate = useNavigate();
  const academicData = useStudentAcademicData();
  const { results, loading, error } = academicData;
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const termsById = new Map<string, StudentAcademicTerm>();
  const resultSessionIds = new Set<string>();
  for (const result of results) {
    const term = resultTerm(result);
    if (term) {
      termsById.set(term.id, term);
      resultSessionIds.add(term.academic_session_id);
    }
  }
  const sessionNames = new Map(academicData.sessions.map((session) => [session.id, session.name]));
  const availableSessions = academicData.sessions.filter((session) => resultSessionIds.has(session.id));
  const availableTerms = [...termsById.values()]
    .filter((term) => !selectedSession || term.academic_session_id === selectedSession)
    .sort((left, right) => left.term_number - right.term_number);
  const filteredResults = results.filter((result) => {
    const term = resultTerm(result);
    return (!selectedSession || term?.academic_session_id === selectedSession)
      && (!selectedTerm || term?.id === selectedTerm);
  });
  const average = filteredResults.length
    ? filteredResults.reduce((total, result) => total + Number(result.score), 0) / filteredResults.length
    : null;
  const highestResult = filteredResults.reduce<PublishedStudentResult | null>(
    (highest, result) => !highest || Number(result.score) > Number(highest.score) ? result : highest,
    null,
  );

  return <div className="app-shell"><Sidebar mode="student" /><main className="main"><Topbar mode="student" /><div className="content"><section className="page-intro"><span className="page-intro-icon"><Icon name="My Results" /></span><div><span className="eyebrow">ACADEMIC RECORD</span><h2>All Results</h2><p>Your complete examination performance history.</p></div><button className="back-button" onClick={() => navigate("/student/results")}>← My Results</button></section><section className="result-summary"><article><span>Published Results</span><b>{loading ? "—" : filteredResults.length}</b><small>{selectedTerm ? termsById.get(selectedTerm)?.name : selectedSession ? sessionNames.get(selectedSession) : "All sessions"}</small></article><article><span>Average Score</span><b>{average === null ? "—" : `${average.toFixed(1)}%`}</b><small>{selectedTerm ? termsById.get(selectedTerm)?.name : "Selected period"}</small></article><article><span>Highest Score</span><b>{highestResult ? `${Number(highestResult.score).toFixed(1)}%` : "—"}</b><small>{resultSubject(highestResult ?? { ...results[0] })?.name ?? "No published results"}</small></article></section><section className="card all-results-card"><div className="result-filters"><label htmlFor="result-session-filter">Session</label><select id="result-session-filter" value={selectedSession} onChange={(event) => { setSelectedSession(event.target.value); setSelectedTerm(""); }}><option value="">All sessions</option>{availableSessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><label htmlFor="result-term-filter">Term</label><select id="result-term-filter" value={selectedTerm} onChange={(event) => setSelectedTerm(event.target.value)}><option value="">All terms</option>{availableTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select><span>{filteredResults.length} results</span></div>{error ? <p className="login-error" role="alert">{error}</p> : loading ? <p className="directory-empty">Loading published results…</p> : filteredResults.length === 0 ? <p className="directory-empty">No results have been published for this selection yet.</p> : <div className="table-wrap"><table><thead><tr>{["Session", "Term", "Examination", "Subject", "Score", "Grade", "Status"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{filteredResults.map((result) => { const term = resultTerm(result); return <tr key={result.id}><td>{sessionNames.get(term?.academic_session_id ?? "") ?? "—"}</td><td>{term?.name ?? "—"}</td><td>{resultExamination(result)?.title ?? "Examination"}</td><td>{resultSubject(result)?.name ?? "—"}</td><td>{Number(result.score).toFixed(1)}%</td><td>{result.grade ?? "—"}</td><td><Badge type="success">Published</Badge></td></tr>; })}</tbody></table></div>}</section></div></main></div>;
}

function AcademicDirectory({ kind }: { kind: "terms" | "subjects" }) {
  useRememberRoute();
  const navigate = useNavigate();
  const data = useStudentAcademicData();
  const subjectAverages = new Map<string, number>();
  for (const subject of data.subjects) {
    const subjectResults = data.results.filter((result) =>
      resultSubject(result)?.id === subject.id
      && resultTerm(result)?.academic_session_id === data.sessionId,
    );
    if (subjectResults.length) {
      subjectAverages.set(subject.id, subjectResults.reduce((total, result) => total + Number(result.score), 0) / subjectResults.length);
    }
  }
  const termsWithResults = data.terms.filter((term) =>
    term.academic_session_id === data.sessionId
    || data.results.some((result) => resultTerm(result)?.id === term.id),
  );
  const sessionById = new Map(data.sessions.map((session) => [session.id, session.name]));
  const title = kind === "terms" ? "All Terms" : "All Subjects";
  const count = kind === "terms" ? termsWithResults.length : data.subjects.length;
  return <div className="app-shell"><Sidebar mode="student" /><main className="main"><Topbar mode="student" /><div className="content"><section className="page-intro"><span className="page-intro-icon"><Icon name={kind === "terms" ? "Examinations" : "Subjects"} /></span><div><span className="eyebrow">ACADEMIC RECORD</span><h2>{title}</h2><p>{kind === "terms" ? "Browse terms with published academic results." : "Browse the subjects allocated to your class."}</p></div><button className="back-button" onClick={() => navigate("/student/results/all")}>← All Results</button></section><section className="card directory-card"><div className="card-head"><div><h3>{kind === "terms" ? "Academic terms" : "Registered Subjects"}</h3><p>{data.className} · {data.sessionName}</p></div><Badge type="info">{data.loading ? "…" : count} {kind === "terms" ? "Terms" : "Subjects"}</Badge></div>{data.error ? <p className="login-error" role="alert">{data.error}</p> : data.loading ? <p className="directory-empty">Loading academic records…</p> : kind === "terms" && termsWithResults.length === 0 ? <p className="directory-empty">Terms with published results will appear here.</p> : kind === "subjects" && data.subjects.length === 0 ? <p className="directory-empty">No subjects are allocated to your class for this session.</p> : kind === "terms" ? termsWithResults.map((term) => { const results = data.results.filter((result) => resultTerm(result)?.id === term.id); const average = results.length ? results.reduce((total, result) => total + Number(result.score), 0) / results.length : null; return <button className="directory-row" key={term.id} onClick={() => navigate("/student/results/all")}><span className="directory-icon"><Icon name="Examinations" /></span><div><b>{sessionById.get(term.academic_session_id) ?? "Academic session"} · {term.name}</b><small>{results.length} published results</small></div><div className="directory-score"><strong>{average === null ? "—" : `${average.toFixed(1)}%`}</strong></div><span className="directory-arrow">→</span></button>; }) : data.subjects.map((subject) => <button className="directory-row" key={subject.id} onClick={() => navigate("/student/results/all")}><span className="directory-icon"><Icon name="Subjects" /></span><div><b>{subject.name}</b><small>{subject.category ?? "Registered subject"}</small></div><div className="directory-score"><strong>{subjectAverages.has(subject.id) ? `${subjectAverages.get(subject.id)?.toFixed(1)}%` : "—"}</strong></div><span className="directory-arrow">→</span></button>)}</section></div></main></div>;
}

function AdminStudents() {
  useRememberRoute();
  const navigate = useNavigate();
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [students, setStudents] = useState<Array<{ userId: string; name: string; studentNumber: string; className: string; sessionName: string }>>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState("");
  const refreshStudents = async () => {
    setStudentsLoading(true);
    setStudentsError("");
    try {
      const { data: studentProfiles, error: studentProfilesError } = await supabase
        .from("student_profiles")
        .select("user_id, student_number")
        .order("student_number");
      if (studentProfilesError) throw studentProfilesError;

      const userIds = studentProfiles.map((student) => student.user_id);
      if (userIds.length === 0) {
        setStudents([]);
        return;
      }

      const [profilesResult, enrollmentsResult] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", userIds),
        supabase
          .from("student_enrollments")
          .select("student_user_id, class_id, academic_session_id")
          .in("student_user_id", userIds),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;

      const classIds = [...new Set(enrollmentsResult.data.map((enrollment) => enrollment.class_id))];
      const sessionIds = [...new Set(enrollmentsResult.data.map((enrollment) => enrollment.academic_session_id))];
      const [classesResult, sessionsResult] = await Promise.all([
        classIds.length ? supabase.from("classes").select("id, name").in("id", classIds) : Promise.resolve({ data: [], error: null }),
        sessionIds.length
          ? supabase.from("academic_sessions").select("id, name").in("id", sessionIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (classesResult.error) throw classesResult.error;
      if (sessionsResult.error) throw sessionsResult.error;

      const namesByUser = new Map(profilesResult.data.map((profile) => [profile.id, profile.full_name]));
      const enrollmentByUser = new Map(enrollmentsResult.data.map((enrollment) => [enrollment.student_user_id, enrollment]));
      const classesById = new Map(classesResult.data.map((classRecord) => [classRecord.id, classRecord.name]));
      const sessionsById = new Map(sessionsResult.data.map((sessionRecord) => [sessionRecord.id, sessionRecord.name]));
      setStudents(studentProfiles.map((student) => {
        const enrollment = enrollmentByUser.get(student.user_id);
        return {
          userId: student.user_id,
          name: namesByUser.get(student.user_id) ?? "Name unavailable",
          studentNumber: student.student_number,
          className: enrollment ? classesById.get(enrollment.class_id) ?? "Class unavailable" : "Not enrolled",
          sessionName: enrollment ? sessionsById.get(enrollment.academic_session_id) ?? "Session unavailable" : "—",
        };
      }));
    } catch (loadError) {
      console.error("Unable to load the student directory:", loadError);
      setStudentsError("Could not load student accounts. Refresh the page or check the database connection.");
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    void refreshStudents();
  }, []);

  const handleCreateStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreated(false);
    setError("");
    setCreating(true);
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const { error: requestError } = await supabase.functions.invoke("create-student", {
        body: {
          fullName: values.get("fullName"),
          email: values.get("email"),
          studentNumber: values.get("studentNumber"),
          className: values.get("className"),
          password: values.get("password"),
        },
      });
      if (requestError) {
        const response = requestError.context;
        if (response instanceof Response) {
          const responseBody: unknown = await response.json();
          if (responseBody && typeof responseBody === "object" && "error" in responseBody && typeof responseBody.error === "string") {
            throw new Error(responseBody.error);
          }
        }
        throw new Error(requestError.message);
      }
      form.reset();
      setCreated(true);
      await refreshStudents();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Student account creation failed.");
    } finally {
      setCreating(false);
    }
  };
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content"><section className="page-intro"><span className="page-intro-icon"><Icon name="Students" /></span><div><span className="eyebrow">ADMIN PORTAL</span><h2>Student Accounts</h2><p>Create secure student credentials and add them to the school register.</p></div><button className="back-button" onClick={() => navigate("/admin")}>← Dashboard</button></section><div className="admin-student-grid"><section className="card admin-form-card"><div className="card-head"><h3>Create student account</h3><Badge type="info">Admin only</Badge></div><form className="student-form" onSubmit={(event) => void handleCreateStudent(event)}><label>Full name<input name="fullName" required placeholder="e.g. John Doe" /></label><label>Email address<input name="email" required type="email" placeholder="john@greenfield.edu" /></label><div><label>Student ID<input name="studentNumber" required pattern="[A-Za-z0-9][A-Za-z0-9/._-]{0,63}" title="Use up to 64 letters, numbers, slashes, periods, underscores, or hyphens." placeholder="GS/2025/0456" /></label><label>Class<input name="className" required placeholder="SS2A" /></label></div><label>Temporary password<input name="password" required minLength={8} type="password" placeholder="At least 8 characters" /></label><button className="login-submit" type="submit" disabled={creating}>{creating ? "Creating account…" : "Create student account"} {!creating && <Icon name="arrow_forward" />}</button>{error && <p className="login-error" role="alert">{error}</p>}{created && <p className="form-success">Student account created. Share the student ID/email and temporary password securely with the student.</p>}</form></section><section className="card student-account-note"><span className="action-icon blue"><Icon name="✓" /></span><h3>How access works</h3><p>Only administrators can create student accounts. Students can sign in with their email or student ID and the password supplied by the school.</p><div><b>1</b><span>Create the student account</span></div><div><b>2</b><span>Enter examination results</span></div><div><b>3</b><span>Student signs in securely</span></div></section></div><section className="card student-directory"><div className="card-head"><div><h3>Student register</h3><p>{students.length} student accounts</p></div><button type="button" onClick={() => void refreshStudents()} disabled={studentsLoading}>{studentsLoading ? "Loading…" : "Refresh"}</button></div>{studentsError && <p className="login-error" role="alert">{studentsError}</p>}{studentsLoading ? <p className="directory-empty">Loading student accounts…</p> : studentsError ? null : students.length === 0 ? <p className="directory-empty">No student accounts yet. Create the first account using the form above.</p> : <div className="table-wrap"><table><thead><tr><th>Student</th><th>Student ID</th><th>Class</th><th>Academic session</th></tr></thead><tbody>{students.map((student) => <tr key={student.userId}><td>{student.name}</td><td>{student.studentNumber}</td><td>{student.className}</td><td>{student.sessionName}</td></tr>)}</tbody></table></div>}</section></div></main></div>;
}

function StudentOverview() {
  useRememberRoute();
  const navigate = useNavigate();
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content student-profile-page"><section className="page-intro"><span className="page-intro-icon"><Icon name="Students" /></span><div><span className="eyebrow">STUDENT OVERVIEW</span><h2>Student records</h2><p>Review student profiles, published results, and report records.</p></div><button className="back-button" onClick={() => navigate("/admin")}>← Dashboard</button></section><AdminStudentOverview /></div></main></div>;
}

function LegacyStudentOverview() {
  useRememberRoute();
  const navigate = useNavigate();
  const { studentId = "STU001" } = useParams();
  const [tab, setTab] = useState("Profile & Biodata");
  const tabs = ["Profile & Biodata", "Subjects & Classes", "Terminal Results", "Reports & History"];
  if (studentId === "overview") return <StudentSearch />;
  if (studentId === "overview") return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content student-profile-page"><section className="page-intro"><span className="page-intro-icon"><Icon name="Students" /></span><div><span className="eyebrow">STUDENT OVERVIEW</span><h2>Select a student</h2><p>Choose a student profile to view and update their academic record.</p></div><button className="back-button" onClick={() => navigate("/admin")}>← Dashboard</button></section><section className="card student-selector"><div className="card-head"><h3>Student directory</h3><Badge type="info">1,250 Students</Badge></div>{[["STU001", "John Doe", "SS2A · Active"], ["STU002", "Amara Okeke", "SS2A · Active"], ["STU003", "David Mensah", "SS2B · Active"], ["STU004", "Grace Bello", "SS1A · Active"]].map(student => <button className="student-select-row" key={student[0]} onClick={() => navigate(`/admin/students/${student[0]}`)}><span className="student-select-avatar">{student[1].split(" ").map(word => word[0]).join("")}</span><span><b>{student[1]}</b><small>{student[0]} · {student[2]}</small></span><span className="directory-arrow">Edit profile →</span></button>)}</section></div></main></div>;
  const panel = tab === tabs[0] ? <div className="profile-fields"><label>Full name<input defaultValue="John Doe" /></label><label>Student ID<input defaultValue={studentId} /></label><label>Guardian contact<input defaultValue="Mrs. Jane Doe · +234 800 400 1313" /></label><label>Current class<input defaultValue="SS2A" /></label></div> : tab === tabs[1] ? <div className="subject-pills">{["Mathematics", "English Language", "Physics", "Chemistry", "Biology", "Civic Education"].map(subject => <span key={subject}>{subject}<button>×</button></span>)}<button className="add-subject">+ Allocate subject</button></div> : tab === tabs[2] ? <div className="table-wrap"><table><thead><tr><th>Subject</th><th>Test (30)</th><th>Project (10)</th><th>Exam (60)</th><th>Total</th><th>Grade</th></tr></thead><tbody>{[["Mathematics", "24", "8", "46", "78", "B+"], ["English Language", "25", "9", "48", "82", "A−"], ["Physics", "22", "7", "46", "75", "B"]].map(row => <tr key={row[0]}>{row.map((cell, index) => <td key={cell}>{index > 0 && index < 4 ? <input className="mark-input" defaultValue={cell} /> : cell}</td>)}</tr>)}</tbody></table><button className="primary profile-save">Save term results</button></div> : <div className="history-list">{[["Second Term Report Card", "2025/2026 · Published May 10, 2026"], ["First Term Report Card", "2025/2026 · Published Dec 18, 2025"]].map(report => <div key={report[0]}><span className="report-icon"><Icon name="Reports" /></span><p><b>{report[0]}</b><small>{report[1]}</small></p><button>View / Download</button></div>)}</div>;
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content student-profile-page"><button className="back-link" onClick={() => navigate("/admin/students")}>← Student accounts</button><section className="student-profile-head"><div className="student-photo">JD</div><div><span className="eyebrow">STUDENT OVERVIEW</span><h2>John Doe <Badge type="success">Active</Badge></h2><p>{studentId} · SS2A · Science Department</p></div><button className="primary">Edit student</button></section><div className="profile-tabs">{tabs.map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div><section className="card student-profile-panel"><div className="card-head"><h3>{tab}</h3><button>Update</button></div>{panel}</section></div></main></div>;
}

function StudentSearch() {
  useRememberRoute();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const students = [["STU001", "John Doe", "SS2A · Active"], ["STU002", "Amara Okeke", "SS2A · Active"], ["STU003", "David Mensah", "SS2B · Active"], ["STU004", "Grace Bello", "SS1A · Active"]];
  const matches = students.filter(student => `${student[0]} ${student[1]}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content student-profile-page"><section className="page-intro"><span className="page-intro-icon"><Icon name="Students" /></span><div><span className="eyebrow">STUDENT OVERVIEW</span><h2>Find a student</h2><p>Search by full name or student ID to open an editable profile.</p></div><button className="back-button" onClick={() => navigate("/admin")}>← Dashboard</button></section><section className="card student-selector"><label className="student-search"><Icon name="query_stats" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search John Doe or STU001" autoFocus /></label><div className="search-result-head"><span>{query ? `${matches.length} matching student${matches.length === 1 ? "" : "s"}` : "Recent students"}</span><Badge type="info">1,250 Students</Badge></div>{matches.map(student => <button className="student-select-row" key={student[0]} onClick={() => navigate(`/admin/students/${student[0]}`)}><span className="student-select-avatar">{student[1].split(" ").map(word => word[0]).join("")}</span><span><b>{student[1]}</b><small>{student[0]} · {student[2]}</small></span><span className="directory-arrow">Open profile →</span></button>)}{matches.length === 0 && <p className="no-student">No student found. Try a name or student ID.</p>}</section></div></main></div>;
}

function BulkResultEntry() {
  useRememberRoute();
  const navigate = useNavigate();
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content"><section className="page-intro"><span className="page-intro-icon"><Icon name="Results" /></span><div><span className="eyebrow">BULK RESULT ENTRY</span><h2>Class Broad-Sheet</h2><p>Enter scores for enrolled students, save drafts, then publish when ready.</p></div><button className="back-button" onClick={() => navigate("/admin/results")}>← Results</button></section><ResultEntryContent /></div></main></div>;
}

function AcademicSetupPage() {
  useRememberRoute();
  const navigate = useNavigate();
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content"><section className="page-intro"><span className="page-intro-icon"><Icon name="Academic Setup" /></span><div><span className="eyebrow">ACADEMIC CONFIGURATION</span><h2>Academic Setup</h2><p>Manage sessions, classes, terms, subjects, and examinations used by the school.</p></div><button className="back-button" onClick={() => navigate("/admin")}>← Dashboard</button></section><AcademicSetupContent /></div></main></div>;
}

function SubjectManagementPage() {
  useRememberRoute();
  const navigate = useNavigate();
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content"><section className="page-intro"><span className="page-intro-icon"><Icon name="Subjects" /></span><div><span className="eyebrow">ACADEMIC CATALOGUE</span><h2>Subjects</h2><p>Manage subject details, class allocations, and enrolled student counts.</p></div><button className="back-button" onClick={() => navigate("/admin")}>← Dashboard</button></section><SubjectManagementContent /></div></main></div>;
}

function ExaminationManagementPage() {
  useRememberRoute();
  const navigate = useNavigate();
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content"><section className="page-intro"><span className="page-intro-icon"><Icon name="Examinations" /></span><div><span className="eyebrow">ASSESSMENT MANAGEMENT</span><h2>Examinations</h2><p>Review candidate numbers, exam schedules, classes, and publication status.</p></div><button className="back-button" onClick={() => navigate("/admin/academic-setup")}>Academic Setup</button></section><ExaminationManagementContent /></div></main></div>;
}

type AdminPage = "subjects" | "examinations" | "results" | "grades" | "reports" | "users" | "settings";
type LiveAdminPage = "results" | "grades" | "reports" | "users";

function LiveAdminPageShell({ title, eyebrow, description, icon, page }: { title: string; eyebrow: string; description: string; icon: string; page: LiveAdminPage }) {
  useRememberRoute();
  const navigate = useNavigate();
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content"><section className="page-intro"><span className="page-intro-icon"><Icon name={icon} /></span><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div><button className="back-button" onClick={() => navigate("/admin")}>← Dashboard</button></section><AdminDataPage page={page} /></div></main></div>;
}

const adminPageData: Record<AdminPage, { title: string; eyebrow: string; icon: string; description: string; columns: string[]; rows: string[][]; action: string }> = {
  subjects: { title: "Subjects", eyebrow: "ACADEMIC CATALOGUE", icon: "Subjects", description: "Organize subjects, assigned teachers, and enrolled students.", columns: ["Subject", "Teacher", "Students", "Status"], rows: [["Mathematics", "Mr. Daniel Okafor", "184", "Active"], ["English Language", "Mrs. Chioma Nwosu", "190", "Active"], ["Physics", "Mr. David Eze", "96", "Active"]], action: "Add subject" },
  examinations: { title: "Examinations", eyebrow: "ASSESSMENT MANAGEMENT", icon: "Examinations", description: "Create assessment schedules and maintain student examination records.", columns: ["Examination", "Term", "Class", "Candidates", "Status"], rows: [["Second Term Examination", "Second Term", "SS2A", "45", "In Progress"], ["Mid Term Assessment", "Second Term", "SS1 – SS3", "1,250", "Published"], ["Third Term Examination", "Third Term", "SS2A", "45", "Scheduled"]], action: "Create examination" },
  results: { title: "Results", eyebrow: "RESULT PROCESSING", icon: "Results", description: "Add, correct, publish, or remove individual student result records.", columns: ["Student", "Subject", "Score", "Grade", "Status"], rows: [["John Doe", "Mathematics", "78%", "B+", "Published"], ["Amara Okeke", "English Language", "82%", "A−", "Published"], ["David Mensah", "Physics", "68%", "C+", "Draft"]], action: "Add result" },
  grades: { title: "Grades", eyebrow: "GRADING SYSTEM", icon: "Grades", description: "Maintain grade bands and update each student’s recorded grade.", columns: ["Student", "Average", "Grade", "Position", "Term"], rows: [["John Doe", "76.0%", "B+", "8 / 45", "Second Term"], ["Amara Okeke", "82.0%", "A−", "5 / 45", "Second Term"], ["David Mensah", "68.0%", "C+", "15 / 45", "Second Term"]], action: "Add grade record" },
  reports: { title: "Reports", eyebrow: "ACADEMIC REPORTING", icon: "Reports", description: "Generate, revise, publish, or remove student academic reports.", columns: ["Student", "Report", "Term", "Published", "Status"], rows: [["John Doe", "Second Term Report Card", "Second Term", "May 10, 2026", "Ready"], ["Amara Okeke", "Second Term Report Card", "Second Term", "May 10, 2026", "Ready"], ["David Mensah", "Progress Report", "Second Term", "May 9, 2026", "Draft"]], action: "Generate report" },
  users: { title: "Users", eyebrow: "ACCESS MANAGEMENT", icon: "Users", description: "Manage student access and roles across the school portal.", columns: ["Name", "Email", "Role", "Last active", "Status"], rows: [["John Doe", "john@greenfield.edu", "Student", "Today", "Active"], ["Amara Okeke", "amara@greenfield.edu", "Student", "Today", "Active"], ["David Mensah", "david@greenfield.edu", "Student", "Yesterday", "Active"]], action: "Add user" },
  settings: { title: "Settings", eyebrow: "SCHOOL CONFIGURATION", icon: "Settings", description: "Control session defaults, result publication, and student record rules.", columns: ["Setting", "Current value", "Applies to", "Updated", "Status"], rows: [["Current Academic Session", "2025/2026", "All students", "Today", "Active"], ["Result Publication", "Admin approval", "All results", "May 10", "Active"], ["Class Position", "Enabled", "All classes", "May 9", "Active"]], action: "Add setting" },
};

function AdminManagement({ page }: { page: AdminPage }) {
  if (page === "settings") return <AdminSettingsSimple />;
  if (page === "results" || page === "grades" || page === "reports" || page === "users") {
    const pageTitles = {
      results: ["Results", "RESULT PROCESSING", "Review and publish real class result records.", "Results"],
      grades: ["Grades", "GRADING SYSTEM", "Configure grade bands and inspect real published grade counts.", "Grades"],
      reports: ["Reports", "ACADEMIC REPORTING", "Manage student report records and publication.", "Reports"],
      users: ["Users", "ACCESS MANAGEMENT", "Review real school accounts and student enrolments.", "Users"],
    } as const;
    const [title, eyebrow, description, icon] = pageTitles[page];
    return <LiveAdminPageShell title={title} eyebrow={eyebrow} description={description} icon={icon} page={page} />;
  }
  useRememberRoute();
  const navigate = useNavigate();
  const data = adminPageData[page];
  const [rows, setRows] = useState(data.rows);
  const [editing, setEditing] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const addRecord = () => { setRows([...rows, ["New student record", "Pending", "—", "—", "Draft"]]); setNotice("A new record has been added. Select Edit to complete it."); };
  const deleteRecord = (index: number) => { setRows(rows.filter((_, rowIndex) => rowIndex !== index)); setNotice("Record removed successfully."); };
  const updateRecord = (index: number) => { setRows(rows.map((row, rowIndex) => rowIndex === index ? [row[0], ...row.slice(1, -1), "Updated"] : row)); setEditing(null); setNotice("Student record updated successfully."); };
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content"><section className="page-intro"><span className="page-intro-icon"><Icon name={data.icon} /></span><div><span className="eyebrow">{data.eyebrow}</span><h2>{data.title}</h2><p>{data.description}</p></div><button className="back-button" onClick={() => navigate("/admin")}>← Dashboard</button></section><section className="card admin-records"><div className="record-toolbar"><div><h3>{data.title} records</h3><p>{rows.length} records · Changes apply to student academic data.</p></div><button className="primary" onClick={addRecord}>+ {data.action}</button></div>{notice && <p className="form-success">{notice}</p>}<div className="table-wrap"><table><thead><tr>{data.columns.map(column => <th key={column}>{column}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((value, cellIndex) => <td key={`${value}-${cellIndex}`}>{editing === index && cellIndex === 0 ? <input className="table-input" defaultValue={value} /> : cellIndex === row.length - 1 ? <Badge type={value === "Draft" || value === "In Progress" ? "warning" : "success"}>{value}</Badge> : value}</td>)}<td><div className="record-actions">{editing === index ? <button className="save-record" onClick={() => updateRecord(index)}>Save</button> : <button onClick={() => setEditing(index)}>Edit</button>}<button className="delete-record" onClick={() => deleteRecord(index)}>Delete</button></div></td></tr>)}</tbody></table></div></section></div></main></div>;
}

function AdminSettings() {
  useRememberRoute();
  const navigate = useNavigate();
  const [reportDownloads, setReportDownloads] = useState(true);
  const [resultsPublished, setResultsPublished] = useState(false);
  const [lateSubmissions, setLateSubmissions] = useState(false);
  const [backups, setBackups] = useState(true);
  const [saved, setSaved] = useState(false);
  const Switch = ({ on, setOn, label, note }: { on: boolean; setOn: (value: boolean) => void; label: string; note: string }) => <div className="setting-switch"><div><b>{label}</b><small>{note}</small></div><button aria-label={label} className={on ? "switch on" : "switch"} onClick={() => setOn(!on)}><i /></button></div>;
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content settings-content"><section className="page-intro"><span className="page-intro-icon"><Icon name="Settings" /></span><div><span className="eyebrow">SYSTEM CONTROL CENTER</span><h2>Settings</h2><p>Control academic rules, result computation, access, and school identity.</p></div><button className="back-button" onClick={() => navigate("/admin")}>← Dashboard</button></section><div className="settings-grid"><section className="settings-stack"><article className="card settings-card"><div className="settings-heading"><span className="action-icon blue"><Icon name="school" /></span><div><h3>School Data</h3><p>Core institutional details shown throughout SRPS.</p></div></div><div className="settings-form two-col"><label>School name<input defaultValue="Greenfield Secondary School" /></label><label>School code<input defaultValue="GSS-2025" /></label><label>Principal / Head of School<input defaultValue="Dr. Adaeze Okafor" /></label><label>Total students<input defaultValue="1,250" type="number" /></label></div></article><article className="card settings-card"><div className="settings-heading"><span className="action-icon purple"><Icon name="Examinations" /></span><div><h3>Academic & Session Configuration</h3><p>Define where records are stored and how scores are interpreted.</p></div></div><div className="settings-form two-col"><label>Active academic session<select defaultValue="2025/2026"><option>2025/2026</option><option>2026/2027</option></select></label><label>Active term<select defaultValue="Second Term"><option>First Term</option><option>Second Term</option><option>Third Term</option></select></label><label>Pass threshold<input defaultValue="50" type="number" /></label><label>Credit-unit range<input defaultValue="15 – 24 units" /></label></div><div className="grade-scale"><b>Grading system setup</b><span>70–100 <strong>A</strong> · 60–69 <strong>B</strong> · 50–59 <strong>C</strong> · Below 50 <strong>F</strong></span><button>Edit scale</button></div></article><article className="card settings-card"><div className="settings-heading"><span className="action-icon orange"><Icon name="Results" /></span><div><h3>Result Computation & Publishing</h3><p>Decide when records can be entered and visible to students.</p></div></div><Switch on={resultsPublished} setOn={setResultsPublished} label="Result visibility" note={resultsPublished ? "Published — students can view their results." : "Unpublished — results remain hidden from students."} /><Switch on={reportDownloads} setOn={setReportDownloads} label="Report download" note={reportDownloads ? "Enabled — students can download available reports." : "Disabled — downloads are blocked."} /><Switch on={lateSubmissions} setOn={setLateSubmissions} label="Late submission lock" note={lateSubmissions ? "Enabled — uploads are locked after deadlines." : "Disabled — staff can upload after deadlines."} /></article></section><aside className="settings-stack"><article className="card settings-card"><div className="settings-heading"><span className="action-icon green"><Icon name="Reports" /></span><div><h3>Institutional Identity</h3><p>Print settings for reports and transcripts.</p></div></div><button className="upload-control">Upload school logo</button><button className="upload-control">Upload registrar signature</button><label className="watermark-label">Watermark text<input defaultValue="Greenfield Secondary School" /></label></article><article className="card settings-card"><div className="settings-heading"><span className="action-icon aqua"><Icon name="Users" /></span><div><h3>Security & Access</h3><p>Protect records and manage staff authority.</p></div></div><div className="setting-link"><span>Role permissions</span><button>Manage →</button></div><div className="setting-link"><span>Audit log retention</span><b>7 years</b></div><Switch on={backups} setOn={setBackups} label="Automated backups" note="Daily encrypted database backup at 2:00 AM." /></article><article className="card settings-card"><div className="settings-heading"><span className="action-icon blue"><Icon name="notifications" /></span><div><h3>Notifications & Integrations</h3><p>Alert students when important records change.</p></div></div><div className="setting-link"><span>Email / SMTP settings</span><button>Configure →</button></div><div className="setting-link"><span>SMS gateway API</span><button>Configure →</button></div></article></aside></div>{saved && <p className="settings-saved">✓ Settings saved successfully.</p>}<button className="settings-save" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2400); }}>Save changes</button></div></main></div>;
}

function AdminSettingsV2() {
  useRememberRoute();
  const navigate = useNavigate();
  const [published, setPublished] = useState(false);
  const [downloads, setDownloads] = useState(true);
  const [saved, setSaved] = useState(false);
  const Toggle = ({ label, on, toggle, detail }: { label: string; on: boolean; toggle: () => void; detail: string }) => <div className="setting-switch"><div><b>{label}</b><small>{detail}</small></div><button className={on ? "switch on" : "switch"} onClick={toggle}><i /></button></div>;
  const Card = ({ title, icon, children }: { title: string; icon: string; children: ReactNode }) => <article className="card settings-card"><div className="settings-heading"><span className="action-icon blue"><Icon name={icon} /></span><div><h3>{title}</h3></div></div>{children}</article>;
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content settings-content"><section className="page-intro"><span className="page-intro-icon"><Icon name="Settings" /></span><div><span className="eyebrow">SYSTEM CONTROL CENTER</span><h2>Settings</h2><p>Configure every rule governing academic records and student access.</p></div><button className="back-button" onClick={() => navigate("/admin")}>← Dashboard</button></section><div className="settings-grid"><section className="settings-stack"><Card title="1. Academic Configuration" icon="Examinations"><div className="settings-form two-col"><label>Active session<select defaultValue="2025/2026"><option>2025/2026</option><option>2026/2027</option></select></label><label>Active term<select defaultValue="First Term"><option>First Term</option><option>Second Term</option><option>Third Term</option></select></label></div><div className="setting-link"><span>Class & department setup</span><button>Manage classes →</button></div><div className="setting-link"><span>Subject allocation</span><button>Map subjects →</button></div></Card><Card title="2. Grading & Result Rules" icon="Grades"><div className="settings-form two-col"><label>Pass mark<input defaultValue="50" type="number" /></label><label>Assessment weightage<input defaultValue="30% CA + 70% Exam" /></label></div><div className="grade-scale"><b>Grading scale</b><span>70–100 <strong>A</strong> · 60–69 <strong>B</strong> · 50–59 <strong>C</strong> · Below 50 <strong>F</strong></span><button>Edit rubric</button></div></Card><Card title="5. Result Publishing & Access" icon="Results"><Toggle label="Publish results" on={published} toggle={() => setPublished(!published)} detail={published ? "Students can currently view published results." : "Results are hidden from every student dashboard."} /><Toggle label="Report downloads" on={downloads} toggle={() => setDownloads(!downloads)} detail={downloads ? "Students can download approved result sheets." : "Student report downloads are disabled."} /><div className="setting-link"><span>Result sheet layout</span><button>Position · Average · Attendance →</button></div></Card><Card title="6. System & Data Operations" icon="Reports"><button className="upload-control">Upload CSV or Excel file</button><div className="setting-link"><span>Bulk import students, subjects, or marks</span><button>Import →</button></div><div className="setting-link"><span>Database backup & restore</span><button>Export backup →</button></div></Card></section><aside className="settings-stack"><Card title="3. Account & Credentials" icon="Users"><label className="watermark-label">Master admin email<input defaultValue="admin@edu.edu" type="email" /></label><label className="watermark-label">Contact phone<input defaultValue="+234 800 123 4567" /></label><button className="upload-control">Change account password</button><div className="setting-link"><span>Active login sessions</span><button>Force logout all →</button></div></Card><Card title="4. Institution Profile & Branding" icon="school"><label className="watermark-label">Institution name<input defaultValue="Greenfield Secondary School" /></label><label className="watermark-label">Address<input defaultValue="12 Learning Avenue, Lagos" /></label><label className="watermark-label">Support email<input defaultValue="support@greenfield.edu" /></label><button className="upload-control">Upload logo, watermark & signature</button></Card><Card title="School Overview" icon="groups"><div className="overview-count"><span>Total enrolled students</span><b>1,250</b></div><div className="overview-count"><span>Configured subjects</span><b>24</b></div><div className="overview-count"><span>Active classes</span><b>12</b></div></Card></aside></div>{saved && <p className="settings-saved">✓ Settings saved successfully.</p>}<button className="settings-save" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2400); }}>Save changes</button></div></main></div>;
}

function AdminSettingsSimple() {
  useRememberRoute();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [schoolName, setSchoolName] = useState("");
  const [studentCount, setStudentCount] = useState(0);
  const [sessions, setSessions] = useState<Array<{ id: string; name: string; is_active: boolean }>>([]);
  const [terms, setTerms] = useState<Array<{ id: string; academic_session_id: string; name: string }>>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [activeTermId, setActiveTermId] = useState("");
  const [adminEmail, setAdminEmail] = useState(session?.user.email ?? "");
  const [contactPhone, setContactPhone] = useState("");
  const [published, setPublished] = useState(true);
  const [downloads, setDownloads] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const activeTerms = terms.filter((term) => term.academic_session_id === activeSessionId);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [settingsResult, sessionResult, termResult, studentsResult] = await Promise.all([
          supabase.from("school_settings").select("school_name, contact_phone, active_term_id, results_published, report_downloads_enabled").maybeSingle(),
          supabase.from("academic_sessions").select("id, name, is_active").order("name"),
          supabase.from("academic_terms").select("id, academic_session_id, name").order("term_number"),
          supabase.from("student_profiles").select("user_id", { count: "exact", head: true }),
        ]);
        const queryError = settingsResult.error ?? sessionResult.error ?? termResult.error ?? studentsResult.error;
        if (queryError) throw queryError;
        if (!active) return;
        const loadedSessions = sessionResult.data ?? [];
        const loadedTerms = termResult.data ?? [];
        const currentSessionId = loadedSessions.find((item) => item.is_active)?.id ?? "";
        const configuredTerm = loadedTerms.find((item) => item.id === settingsResult.data?.active_term_id);
        setSchoolName(settingsResult.data?.school_name ?? "");
        setContactPhone(settingsResult.data?.contact_phone ?? "");
        setSessions(loadedSessions);
        setTerms(loadedTerms);
        setActiveSessionId(configuredTerm?.academic_session_id ?? currentSessionId);
        setActiveTermId(configuredTerm?.id ?? loadedTerms.find((item) => item.academic_session_id === currentSessionId)?.id ?? "");
        setStudentCount(studentsResult.count ?? 0);
        setPublished(settingsResult.data?.results_published ?? true);
        setDownloads(settingsResult.data?.report_downloads_enabled ?? true);
        setAdminEmail(session?.user.email ?? "");
      } catch (loadError) {
        console.error("Unable to load school settings:", loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load school settings.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [session]);

  const saveSettings = async () => {
    if (!session) {
      setError("Your sign-in session has expired. Sign in again to save settings.");
      return;
    }
    if (!schoolName.trim()) {
      setError("Enter a school name.");
      return;
    }
    if (!activeSessionId || !activeTermId) {
      setError("Choose an active academic session and term.");
      return;
    }
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const { error: saveError } = await supabase.rpc("save_school_settings", {
        p_school_name: schoolName.trim(),
        p_contact_phone: contactPhone.trim() || null,
        p_active_session_id: activeSessionId,
        p_active_term_id: activeTermId,
        p_results_published: published,
        p_report_downloads_enabled: downloads,
      });
      if (saveError) throw saveError;
      if (adminEmail.trim().toLowerCase() !== (session.user.email ?? "").toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: adminEmail.trim() });
        if (emailError) throw new Error(`School settings were saved, but the email change failed: ${emailError.message}`);
        setSaved("Settings saved. Check the new email address to confirm the account email change.");
      } else {
        setSaved("Settings saved successfully.");
      }
      window.dispatchEvent(new Event("srps-school-settings-updated"));
    } catch (saveError) {
      console.error("Unable to save school settings:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save school settings.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    const password = window.prompt("Enter a new password (at least 8 characters):");
    if (password === null) return;
    if (password.length < 8) {
      window.alert("Use a password with at least 8 characters.");
      return;
    }
    setError("");
    setSaved("");
    setSaving(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      setSaved("Password updated successfully.");
    } catch (passwordError) {
      console.error("Unable to change the administrator password:", passwordError);
      window.alert(passwordError instanceof Error ? passwordError.message : "Could not change the password.");
    } finally {
      setSaving(false);
    }
  };

  const downloadBackup = async () => {
    const tables = [
      "academic_sessions", "academic_terms", "classes", "class_subjects", "session_subjects",
      "student_profiles", "student_enrollments", "profiles", "subjects", "examinations",
      "examination_components", "results", "result_components", "grade_bands",
      "student_reports", "notifications", "school_settings",
    ] as const;
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const backup: Record<string, unknown[]> = {};
      for (const table of tables) {
        const rows: unknown[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error: queryError } = await supabase.from(table).select("*").range(offset, offset + 999);
          if (queryError) throw new Error(`Could not include ${table} in the backup: ${queryError.message}`);
          rows.push(...(data ?? []));
          if ((data ?? []).length < 1000) break;
        }
        backup[table] = rows;
      }
      const blob = new Blob([JSON.stringify({ createdAt: new Date().toISOString(), format: "srps-school-data-export", tables: backup }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `srps-school-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaved("School data export downloaded. Authentication accounts and stored files are not included.");
    } catch (backupError) {
      console.error("Unable to download school data backup:", backupError);
      setError(backupError instanceof Error ? backupError.message : "Could not download the school data backup.");
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ on, setOn, label, note }: { on: boolean; setOn: (value: boolean) => void; label: string; note: string }) => <div className="setting-switch"><div><b>{label}</b><small>{note}</small></div><button type="button" aria-label={label} className={on ? "switch on" : "switch"} disabled={loading || saving} onClick={() => { setOn(!on); setSaved(""); }}><i /></button></div>;
  return <div className="app-shell"><Sidebar mode="admin" /><main className="main"><Topbar mode="admin" /><div className="content settings-content"><section className="page-intro"><span className="page-intro-icon"><Icon name="Settings" /></span><div><span className="eyebrow">SYSTEM SETTINGS</span><h2>Settings</h2><p>Manage the essential controls for your school portal.</p></div><button className="back-button" onClick={() => navigate("/admin")}>← Dashboard</button></section><div className="settings-grid"><section className="settings-stack"><article className="card settings-card"><div className="settings-heading"><span className="action-icon blue"><Icon name="school" /></span><div><h3>School Information</h3><p>Core details used across SRPS.</p></div></div><div className="settings-form two-col"><label>School name<input value={schoolName} onChange={(event) => { setSchoolName(event.target.value); setSaved(""); }} disabled={loading || saving} /></label><label>Total students<input value={studentCount} type="number" readOnly /></label><label>Active session<select value={activeSessionId} onChange={(event) => { const nextSessionId = event.target.value; setActiveSessionId(nextSessionId); setActiveTermId(terms.find((term) => term.academic_session_id === nextSessionId)?.id ?? ""); setSaved(""); }} disabled={loading || saving}><option value="">Select active session</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Active term<select value={activeTermId} onChange={(event) => { setActiveTermId(event.target.value); setSaved(""); }} disabled={loading || saving || !activeSessionId}><option value="">Select active term</option>{activeTerms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div></article><article className="card settings-card"><div className="settings-heading"><span className="action-icon orange"><Icon name="Results" /></span><div><h3>Result Access</h3><p>Control what students can view and download.</p></div></div><Toggle label="Publish results" on={published} setOn={setPublished} note={published ? "Students can view their results." : "Results are hidden from students."} /><Toggle label="Enable report downloads" on={downloads} setOn={setDownloads} note={downloads ? "Students can download their available reports." : "Student report downloads are disabled."} /></article></section><aside className="settings-stack"><article className="card settings-card"><div className="settings-heading"><span className="action-icon purple"><Icon name="Users" /></span><div><h3>Admin Account</h3><p>Manage the account that controls SRPS.</p></div></div><label className="watermark-label">Admin email<input value={adminEmail} onChange={(event) => { setAdminEmail(event.target.value); setSaved(""); }} type="email" disabled={loading || saving} /></label><label className="watermark-label">Contact phone<input value={contactPhone} onChange={(event) => { setContactPhone(event.target.value); setSaved(""); }} disabled={loading || saving} /></label><button className="upload-control" type="button" onClick={() => void changePassword()} disabled={loading || saving}>Change password</button></article><article className="card settings-card"><div className="settings-heading"><span className="action-icon green"><Icon name="Reports" /></span><div><h3>Data Backup</h3><p>Keep a copy of your school records.</p></div></div><button className="upload-control" type="button" onClick={() => void downloadBackup()} disabled={saving}>{saving ? "Preparing download…" : "Download database backup"}</button></article></aside></div>{error && <p className="login-error" role="alert">{error}</p>}{saved && <p className="settings-saved" role="status">✓ {saved}</p>}<button className="settings-save" onClick={() => void saveSettings()} disabled={loading || saving}>{saving ? "Saving…" : "Save changes"}</button></div></main></div>;
}

function ResetPassword() {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) {
      setError("This password reset link is invalid or has expired. Request a new link.");
      return;
    }
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setNotice("Administrator password updated successfully.");
    } catch (updateError) {
      console.error("Unable to update the administrator password:", updateError);
      setError("Could not update the password. Request a new reset link and try again.");
    } finally {
      setSaving(false);
    }
  };

  return <main className="sign-in"><section className="login-pane"><form className="login-card" onSubmit={(event) => void updatePassword(event)}><h2>Set a new password</h2><p>Choose a new password for your administrator account.</p>{!loading && !session ? <p className="login-error" role="alert">This password reset link is invalid or has expired. Request a new link.</p> : <><label>New password<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label><label>Confirm new password<input name="confirmation" type="password" minLength={8} autoComplete="new-password" required /></label>{error && <p className="login-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}<button className="login-submit" type="submit" disabled={saving || loading || !session}>{saving ? "Updating…" : "Update password"}</button></>}{notice && profile && <button className="back-button" type="button" onClick={() => navigate(profile.role === "admin" ? "/admin" : "/student")}>Continue to portal</button>}</form></section></main>;
}

function SignIn() {
  const [role, setRole] = useState<Mode>("student");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetNotice, setResetNotice] = useState("");
  const navigate = useNavigate();
  const { session, profile, loading, profileError, sessionError } = useAuth();

  useEffect(() => {
    if (!loading && session && profile) {
      navigate(profile.role === "admin" ? "/admin" : "/student", { replace: true });
    }
  }, [loading, navigate, profile, session]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResetNotice("");
    setSigningIn(true);
    const values = new FormData(event.currentTarget);
    const identifier = String(values.get("identifier") ?? "").trim();
    const password = String(values.get("password") ?? "");

    try {
      setAuthSessionPersistence(rememberSession);
      if (identifier.includes("@")) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: identifier.toLowerCase(),
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { data, error: functionError } = await supabase.functions.invoke("student-id-sign-in", {
          body: { studentNumber: identifier, password },
        });
        if (functionError) {
          const response = functionError.context;
          if (response instanceof Response) {
            const responseBody: unknown = await response.json().catch(() => null);
            if (responseBody && typeof responseBody === "object" && "error" in responseBody && typeof responseBody.error === "string") {
              throw new Error(responseBody.error);
            }
          }
          throw new Error(functionError.message || "Invalid ID or password.");
        }
        if (!data?.session) throw new Error("Student ID sign-in is not configured yet.");
        const { error: sessionError } = await supabase.auth.setSession(data.session);
        if (sessionError) throw sessionError;
      }

      const { data: signedInUser, error: userError } = await supabase.auth.getUser();
      if (userError || !signedInUser.user) throw new Error("Unable to confirm the signed-in account.");
      const { data: account, error: accountError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", signedInUser.user.id)
        .single();
      if (accountError) {
        await supabase.auth.signOut();
        throw new Error("Your account profile is not ready. Contact a school administrator.");
      }
      if (account.role !== role) {
        await supabase.auth.signOut();
        throw new Error(`This account is not registered as ${role === "admin" ? "an administrator" : "a student"}.`);
      }
      navigate(account.role === "admin" ? "/admin" : "/student");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Sign-in failed. Please try again.");
    } finally {
      setSigningIn(false);
    }
  };

  const sendAdminPasswordReset = async () => {
    const email = identifier.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter the administrator email address first.");
      setResetNotice("");
      return;
    }

    setResettingPassword(true);
    setError("");
    setResetNotice("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setResetNotice("If this administrator account exists, a password reset link has been sent to its email address.");
    } catch (resetError) {
      console.error("Unable to request an administrator password reset:", resetError);
      setError("Could not send the password reset link. Check the email and try again.");
    } finally {
      setResettingPassword(false);
    }
  };

  if (loading && session) return <SplashScreen />;
  return <main className="sign-in"><section className="sign-in-brand"><Brand /><div className="sign-in-message"><h1>Smart Results.<br /><em className="typewriter">Brighter Futures.</em></h1><p>Securely manage, process and access academic results with ease.</p><div className="sign-in-points"><div><Icon name="✓" /><b>Secure</b><small>Your data is protected</small></div><div><Icon name="⌁" /><b>Accurate</b><small>Trusted academic records</small></div></div></div></section><section className="login-pane"><form className="login-card" onSubmit={(event) => void handleLogin(event)}><h2>Welcome back</h2><p>Sign in to continue to your dashboard.</p><div className="role-tabs"><button type="button" className={role === "student" ? "selected" : ""} onClick={() => { setRole("student"); setError(""); setResetNotice(""); setShowPassword(false); }}><Icon name="♙" /> Student</button><button type="button" className={role === "admin" ? "selected" : ""} onClick={() => { setRole("admin"); setError(""); setResetNotice(""); setShowPassword(false); }}><Icon name="⚙" /> Admin</button></div><label>{role === "student" ? "Student ID or Email" : "Admin Email"}<input name="identifier" required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={role === "admin" ? "Enter admin email" : "GS/2025/0456 or student email"} /></label><label>Password<span className="password-input-wrap"><input name="password" required autoComplete="current-password" type={showPassword ? "text" : "password"} placeholder="Enter your password" /><button className="password-visibility-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0112 5c5.5 0 9 7 9 7a15.8 15.8 0 01-3.1 3.8M6.2 6.2C3.9 7.8 2 12 2 12s3.5 7 10 7a10.5 10.5 0 004.1-.8" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>}</button></span></label><div className="login-options"><label><input type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} /> Remember me</label>{role === "admin" && <button type="button" onClick={() => void sendAdminPasswordReset()} disabled={resettingPassword}>{resettingPassword ? "Sending link…" : "Forgot password?"}</button>}</div>{error && <p className="login-error" role="alert">{error}</p>}{resetNotice && <p className="form-success" role="status">{resetNotice}</p>}{sessionError && <p className="login-error" role="alert">{sessionError}</p>}{profileError && <p className="login-error" role="alert">{profileError}</p>}<button className="login-submit" type="submit" disabled={signingIn}>{signingIn ? "Signing in…" : `Sign in as ${role === "admin" ? "Admin" : "Student"}`} {!signingIn && <Icon name="arrow_forward" />}</button></form></section></main>;
}

const router = createBrowserRouter([
  { path: "/", Component: SignIn },
  { path: "/reset-password", Component: ResetPassword },
  { path: "/admin", Component: () => <RequireRole role="admin"><Dashboard mode="admin" /></RequireRole> },
  { path: "/admin/students", Component: () => <RequireRole role="admin"><AdminStudents /></RequireRole> },
  { path: "/admin/students/:studentId", Component: () => <RequireRole role="admin"><StudentOverview /></RequireRole> },
  { path: "/admin/academic-setup", Component: () => <RequireRole role="admin"><AcademicSetupPage /></RequireRole> },
  { path: "/admin/subjects", Component: () => <RequireRole role="admin"><SubjectManagementPage /></RequireRole> },
  { path: "/admin/examinations", Component: () => <RequireRole role="admin"><ExaminationManagementPage /></RequireRole> },
  { path: "/admin/results", Component: () => <RequireRole role="admin"><AdminManagement page="results" /></RequireRole> },
  { path: "/admin/results/entry", Component: () => <RequireRole role="admin"><BulkResultEntry /></RequireRole> },
  { path: "/admin/grades", Component: () => <RequireRole role="admin"><AdminManagement page="grades" /></RequireRole> },
  { path: "/admin/reports", Component: () => <RequireRole role="admin"><AdminManagement page="reports" /></RequireRole> },
  { path: "/admin/users", Component: () => <RequireRole role="admin"><AdminManagement page="users" /></RequireRole> },
  { path: "/admin/settings", Component: () => <RequireRole role="admin"><AdminManagement page="settings" /></RequireRole> },
  { path: "/student", Component: () => <RequireRole role="student"><Dashboard mode="student" /></RequireRole> },
  { path: "/student/results", Component: () => <RequireRole role="student"><StudentPage page="results" /></RequireRole> },
  { path: "/student/results/all", Component: () => <RequireRole role="student"><AllResultsPage /></RequireRole> },
  { path: "/student/results/terms", Component: () => <RequireRole role="student"><AcademicDirectory kind="terms" /></RequireRole> },
  { path: "/student/results/subjects", Component: () => <RequireRole role="student"><AcademicDirectory kind="subjects" /></RequireRole> },
  { path: "/student/examinations", Component: () => <RequireRole role="student"><StudentPage page="examinations" /></RequireRole> },
  { path: "/student/examinations/history", Component: () => <RequireRole role="student"><PastExaminationsPage /></RequireRole> },
  { path: "/student/subjects", Component: () => <RequireRole role="student"><StudentPage page="subjects" /></RequireRole> },
  { path: "/student/grades", Component: () => <RequireRole role="student"><StudentPage page="grades" /></RequireRole> },
  { path: "/student/reports", Component: () => <RequireRole role="student"><StudentPage page="reports" /></RequireRole> },
  { path: "/student/notifications", Component: () => <RequireRole role="student"><StudentPage page="notifications" /></RequireRole> },
  { path: "*", Component: SignIn },
]);

export default function App() {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setLoading(false), 900); return () => clearTimeout(timer); }, []);
  return loading ? <SplashScreen /> : <RouterProvider router={router} />;
}
