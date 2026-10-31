import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";

type AcademicSession = { id: string; name: string; starts_on: string | null; ends_on: string | null; is_active: boolean };
type AcademicTerm = { id: string; academic_session_id: string; name: string; term_number: number };
type SchoolClass = { id: string; name: string };
type Subject = { id: string; name: string; code: string | null; category: string | null; is_active: boolean };
type Examination = {
  id: string;
  title: string;
  academic_term_id: string;
  class_id: string | null;
  subject_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
};

type SetupData = {
  sessions: AcademicSession[];
  terms: AcademicTerm[];
  classes: SchoolClass[];
  subjects: Subject[];
  examinations: Examination[];
};

const emptyData: SetupData = { sessions: [], terms: [], classes: [], subjects: [], examinations: [] };

export function AcademicSetupContent() {
  const [data, setData] = useState<SetupData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sessions, terms, classes, subjects, examinations] = await Promise.all([
        supabase.from("academic_sessions").select("id, name, starts_on, ends_on, is_active").order("name"),
        supabase.from("academic_terms").select("id, academic_session_id, name, term_number").order("term_number"),
        supabase.from("classes").select("id, name").order("name"),
        supabase.from("subjects").select("id, name, code, category, is_active").order("name"),
        supabase.from("examinations").select("id, title, academic_term_id, class_id, subject_id, starts_on, ends_on, status").order("created_at", { ascending: false }),
      ]);
      const queryError = sessions.error ?? terms.error ?? classes.error ?? subjects.error ?? examinations.error;
      if (queryError) {
        console.error("Unable to load academic setup:", queryError);
        setError("Could not load academic setup. Check the connection and try again.");
      } else {
        setData({
          sessions: sessions.data ?? [],
          terms: terms.data ?? [],
          classes: classes.data ?? [],
          subjects: subjects.data ?? [],
          examinations: examinations.data ?? [],
        });
      }
    } catch (loadError) {
      console.error("Unable to load academic setup:", loadError);
      setError("Could not load academic setup. Check the connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const runAction = async (
    event: FormEvent<HTMLFormElement>,
    action: (values: FormData) => Promise<void>,
    successMessage: string | (() => string),
  ) => {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await action(new FormData(form));
      form.reset();
      setNotice(typeof successMessage === "function" ? successMessage() : successMessage);
      await loadData();
    } catch (actionError) {
      console.error("Academic setup update failed:", actionError);
      setError(actionError instanceof Error ? actionError.message : "Could not save academic setup.");
    } finally {
      setSaving(false);
    }
  };

  const setActiveSession = async (sessionId: string) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const deactivate = await supabase.from("academic_sessions").update({ is_active: false }).eq("is_active", true);
      if (deactivate.error) throw deactivate.error;
      const activate = await supabase.from("academic_sessions").update({ is_active: true }).eq("id", sessionId);
      if (activate.error) throw activate.error;
      setNotice("Active academic session updated.");
      await loadData();
    } catch (actionError) {
      console.error("Unable to change the active academic session:", actionError);
      setError("Could not change the active session. Refresh the page and try again.");
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const addSession = (event: FormEvent<HTMLFormElement>) => runAction(event, async (values) => {
    const name = String(values.get("name") ?? "").trim();
    const startsOn = String(values.get("startsOn") ?? "") || null;
    const endsOn = String(values.get("endsOn") ?? "") || null;
    if (startsOn && endsOn && startsOn > endsOn) throw new Error("The session end date must be after its start date.");
    const { error: insertError } = await supabase.from("academic_sessions").insert({
      name,
      starts_on: startsOn,
      ends_on: endsOn,
      is_active: false,
    });
    if (insertError) throw new Error(insertError.code === "23505" ? "That academic session already exists." : insertError.message);
  }, "Academic session added. Choose it as active when ready.");

  const addTerm = (event: FormEvent<HTMLFormElement>) => runAction(event, async (values) => {
    const sessionId = String(values.get("sessionId") ?? "");
    const name = String(values.get("name") ?? "").trim();
    const termNumber = Number(values.get("termNumber"));
    const startsOn = String(values.get("startsOn") ?? "") || null;
    const endsOn = String(values.get("endsOn") ?? "") || null;
    if (startsOn && endsOn && startsOn > endsOn) throw new Error("The term end date must be after its start date.");
    const { error: insertError } = await supabase.from("academic_terms").insert({
      academic_session_id: sessionId,
      name,
      term_number: termNumber,
      starts_on: startsOn,
      ends_on: endsOn,
    });
    if (insertError) throw new Error(insertError.code === "23505" ? "That term number or name already exists in this session." : insertError.message);
  }, "Academic term added.");

  const addSubject = (event: FormEvent<HTMLFormElement>) => runAction(event, async (values) => {
    const { error: insertError } = await supabase.from("subjects").insert({
      name: String(values.get("name") ?? "").trim(),
      code: String(values.get("code") ?? "").trim() || null,
      category: String(values.get("category") ?? "").trim() || null,
      is_core: values.get("is_core") === "on",
    });
    if (insertError) throw new Error(insertError.code === "23505" ? "A subject with that name or code already exists." : insertError.message);
  }, "Subject added.");

  const addExamination = (event: FormEvent<HTMLFormElement>) => runAction(event, async (values) => {
    const startsOn = String(values.get("startsOn") ?? "") || null;
    const endsOn = String(values.get("endsOn") ?? "") || null;
    if (startsOn && endsOn && startsOn > endsOn) throw new Error("The examination end date must be after its start date.");
    const { error: createError } = await supabase.rpc("create_global_examination", {
      p_title: String(values.get("title") ?? "").trim(),
      p_academic_term_id: String(values.get("termId") ?? ""),
      p_starts_on: startsOn,
      p_ends_on: endsOn,
      p_status: String(values.get("status") ?? "draft"),
    });
    if (createError) throw new Error(createError.message);
  }, "Created one examination for all classes and subjects with CA (40) and Exam (60) components.");

  const termsById = new Map(data.terms.map((term) => [term.id, term]));
  const sessionsById = new Map(data.sessions.map((session) => [session.id, session.name]));
  const classesById = new Map(data.classes.map((schoolClass) => [schoolClass.id, schoolClass.name]));
  const subjectsById = new Map(data.subjects.map((subject) => [subject.id, subject.name]));

  return <>
    <section className="academic-setup-grid">
      <article className="card setup-card">
        <div className="card-head"><div><h3>Academic sessions</h3><p>Set the current school year.</p></div></div>
        <form className="student-form" onSubmit={(event) => void addSession(event)}>
          <label>Session name<input name="name" required maxLength={80} placeholder="2026/2027" /></label>
          <div className="setup-date-row"><label>Starts<input name="startsOn" type="date" /></label><label>Ends<input name="endsOn" type="date" /></label></div>
          <button className="primary" type="submit" disabled={saving}>Add session</button>
        </form>
        <div className="setup-records">{data.sessions.map((session) => <div className="setup-record" key={session.id}><div><b>{session.name}</b><small>{session.starts_on ?? "Start date unset"} – {session.ends_on ?? "End date unset"}</small></div>{session.is_active ? <span className="badge success">Active</span> : <button type="button" disabled={saving} onClick={() => void setActiveSession(session.id)}>Set active</button>}</div>)}</div>
      </article>

      <article className="card setup-card">
        <div className="card-head"><div><h3>School classes</h3><p>Standard class groups used for enrollments and examinations.</p></div></div>
        <div className="setup-chip-list">{data.classes.map((schoolClass) => <span key={schoolClass.id}>{schoolClass.name}</span>)}</div>
      </article>

      <article className="card setup-card">
        <div className="card-head"><div><h3>Academic terms</h3><p>Add terms under an academic session.</p></div></div>
        <form className="student-form" onSubmit={(event) => void addTerm(event)}>
          <label>Academic session<select name="sessionId" required defaultValue=""><option value="" disabled>Select a session</option>{data.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>
          <div className="setup-date-row"><label>Term number<select name="termNumber" required defaultValue="1"><option value="1">First</option><option value="2">Second</option><option value="3">Third</option></select></label><label>Term name<input name="name" required maxLength={80} placeholder="First Term" /></label></div>
          <div className="setup-date-row"><label>Starts<input name="startsOn" type="date" /></label><label>Ends<input name="endsOn" type="date" /></label></div>
          <button className="primary" type="submit" disabled={saving || data.sessions.length === 0}>Add term</button>
        </form>
        <div className="setup-records">{data.terms.map((term) => <div className="setup-record" key={term.id}><div><b>{term.name}</b><small>{sessionsById.get(term.academic_session_id) ?? "Session unavailable"} · Term {term.term_number}</small></div></div>)}</div>
      </article>

      <article className="card setup-card">
        <div className="card-head"><div><h3>Subjects</h3><p>Maintain the school subject catalogue.</p></div></div>
        <form className="student-form" onSubmit={(event) => void addSubject(event)}>
          <label>Subject name<input name="name" required maxLength={120} placeholder="Mathematics" /></label>
          <div className="setup-date-row"><label>Code<input name="code" maxLength={32} placeholder="MATH" /></label><label>Category<input name="category" maxLength={80} placeholder="Core subject" /></label></div>
          <label className="checkbox-label"><input type="checkbox" name="is_core" /> Core subject — allocate to all classes</label>
          <button className="primary" type="submit" disabled={saving}>Add subject</button>
        </form>
        <div className="setup-records">{data.subjects.map((subject) => <div className="setup-record" key={subject.id}><div><b>{subject.name}</b><small>{[subject.code, subject.category].filter(Boolean).join(" · ") || "No code or category"}</small></div><span className={`badge ${subject.is_active ? "success" : "muted"}`}>{subject.is_active ? "Active" : "Inactive"}</span></div>)}</div>
      </article>
    </section>

    <section className="card setup-card setup-examinations">
      <div className="card-head"><div><h3>Examinations</h3><p>Each examination applies to all classes and subjects. Every allocated subject starts with CA / 40 and Exam / 60.</p></div></div>
      <form className="student-form setup-exam-form" onSubmit={(event) => void addExamination(event)}>
        <label>Examination title<input name="title" required maxLength={120} placeholder="End of Term Examination" /></label>
        <label>Term<select name="termId" required defaultValue=""><option value="" disabled>Select a term</option>{data.terms.map((term) => <option key={term.id} value={term.id}>{sessionsById.get(term.academic_session_id)} · {term.name}</option>)}</select></label>
        <label>Status<select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="published">Published</option></select></label>
        <label>Starts<input name="startsOn" type="date" /></label>
        <label>Ends<input name="endsOn" type="date" /></label>
        <button className="primary" type="submit" disabled={saving || data.terms.length === 0}>Create examination</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Examination</th><th>Session / Term</th><th>Class</th><th>Subject</th><th>Dates</th><th>Status</th></tr></thead><tbody>{data.examinations.map((exam) => {
        const term = termsById.get(exam.academic_term_id);
        return <tr key={exam.id}><td>{exam.title}</td><td>{term ? `${sessionsById.get(term.academic_session_id) ?? "Session unavailable"} · ${term.name}` : "Term unavailable"}</td><td>{exam.class_id ? classesById.get(exam.class_id) ?? "Class unavailable" : "All classes"}</td><td>{exam.subject_id ? subjectsById.get(exam.subject_id) ?? "Subject unavailable" : "All subjects"}</td><td>{exam.starts_on ?? "—"} – {exam.ends_on ?? "—"}</td><td>{exam.status}</td></tr>;
      })}</tbody></table></div>
    </section>

    {error && <p className="login-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {loading && <p className="directory-empty">Loading academic setup…</p>}
    <button className="back-button setup-refresh" type="button" onClick={() => void loadData()} disabled={loading}>Refresh academic setup</button>
  </>;
}
