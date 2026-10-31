import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";

type Subject = { id: string; name: string; code: string | null; category: string | null; is_active: boolean; is_core: boolean };
type SchoolClass = { id: string; name: string; is_active: boolean };
type AcademicSession = { id: string; name: string; is_active: boolean };
type AcademicTerm = { id: string; academic_session_id: string; name: string };
type ClassSubject = { class_id: string; subject_id: string; academic_session_id: string };
type SessionSubject = { subject_id: string; academic_session_id: string };
type Enrollment = { student_user_id: string; class_id: string; academic_session_id: string };
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

function useAcademicRecords() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [sessionSubjects, setSessionSubjects] = useState<SessionSubject[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [subjectResult, classResult, sessionResult, termResult, classSubjectResult, sessionSubjectResult, enrollmentResult, examinationResult] = await Promise.all([
        supabase.from("subjects").select("id, name, code, category, is_active, is_core").order("name"),
        supabase.from("classes").select("id, name, is_active").order("name"),
        supabase.from("academic_sessions").select("id, name, is_active").order("name"),
        supabase.from("academic_terms").select("id, academic_session_id, name").order("name"),
        supabase.from("class_subjects").select("class_id, subject_id, academic_session_id"),
        supabase.from("session_subjects").select("subject_id, academic_session_id"),
        supabase.from("student_enrollments").select("student_user_id, class_id, academic_session_id"),
        supabase.from("examinations").select("id, title, academic_term_id, class_id, subject_id, starts_on, ends_on, status").order("created_at", { ascending: false }),
      ]);
      const failedQuery = subjectResult.error ?? classResult.error ?? sessionResult.error ?? termResult.error ?? classSubjectResult.error ?? sessionSubjectResult.error ?? enrollmentResult.error ?? examinationResult.error;
      if (failedQuery) throw failedQuery;
      setSubjects(subjectResult.data ?? []);
      setClasses(classResult.data ?? []);
      setSessions(sessionResult.data ?? []);
      setTerms(termResult.data ?? []);
      setClassSubjects(classSubjectResult.data ?? []);
      setSessionSubjects(sessionSubjectResult.data ?? []);
      setEnrollments(enrollmentResult.data ?? []);
      setExaminations(examinationResult.data ?? []);
    } catch (loadError) {
      console.error("Unable to load academic records:", loadError);
      setError("Could not load the academic records. Check the database connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { subjects, classes, sessions, terms, classSubjects, sessionSubjects, enrollments, examinations, loading, error, refresh, setError };
}

export function SubjectManagementContent() {
  const data = useAcademicRecords();
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const activeSession = data.sessions.find((session) => session.is_active) ?? null;

  useEffect(() => {
    if (!selectedSessionId) setSelectedSessionId(data.sessions.find((session) => session.is_active)?.id ?? data.sessions[0]?.id ?? "");
  }, [data.sessions, selectedSessionId]);

  const classesById = useMemo(() => new Map(data.classes.map((schoolClass) => [schoolClass.id, schoolClass.name])), [data.classes]);
  const enrollmentsByClass = useMemo(() => {
    const counts = new Map<string, number>();
    for (const enrollment of data.enrollments) {
      if (enrollment.academic_session_id !== selectedSessionId) continue;
      counts.set(enrollment.class_id, (counts.get(enrollment.class_id) ?? 0) + 1);
    }
    return counts;
  }, [data.enrollments, selectedSessionId]);
  const subjectClassRows = useMemo(() => {
    const bySubject = new Map<string, ClassSubject[]>();
    for (const allocation of data.classSubjects) {
      if (allocation.academic_session_id !== selectedSessionId) continue;
      bySubject.set(allocation.subject_id, [...(bySubject.get(allocation.subject_id) ?? []), allocation]);
    }
    return bySubject;
  }, [data.classSubjects, selectedSessionId]);
  const subjectsInSession = useMemo(
    () => new Set(data.sessionSubjects.filter((item) => item.academic_session_id === selectedSessionId).map((item) => item.subject_id)),
    [data.sessionSubjects, selectedSessionId],
  );

  const saveSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editSubject) return;
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") ?? "").trim();
    if (!name) {
      data.setError("Subject name is required.");
      return;
    }
    setSaving(true);
    data.setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase.from("subjects").update({
        name,
        code: String(values.get("code") ?? "").trim() || null,
        category: String(values.get("category") ?? "").trim() || null,
        is_active: values.get("is_active") === "on",
        is_core: values.get("is_core") === "on",
      }).eq("id", editSubject.id);
      if (updateError) throw updateError;
      setEditSubject(null);
      setNotice("Subject details updated.");
      await data.refresh();
    } catch (saveError) {
      console.error("Unable to update subject:", saveError);
      data.setError(saveError instanceof Error ? saveError.message : "Could not update the subject.");
    } finally {
      setSaving(false);
    }
  };

  const addSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    data.setError("");
    setNotice("");
    try {
      const { data: createdSubject, error: insertError } = await supabase.from("subjects").insert({
        name: String(values.get("name") ?? "").trim(),
        code: String(values.get("code") ?? "").trim() || null,
        category: String(values.get("category") ?? "").trim() || null,
        is_core: values.get("is_core") === "on",
      }).select("id").single();
      if (insertError) throw insertError;
      const sessionId = String(values.get("academic_session_id") ?? "");
      if (sessionId) {
        const { error: allocationError } = await supabase.from("session_subjects").upsert({
          subject_id: createdSubject.id,
          academic_session_id: sessionId,
        }, { onConflict: "subject_id,academic_session_id", ignoreDuplicates: true });
        if (allocationError) throw new Error(`Subject was created, but session allocation failed: ${allocationError.message}`);
      }
      form.reset();
      setNotice("Subject added.");
      await data.refresh();
    } catch (saveError) {
      console.error("Unable to add subject:", saveError);
      await data.refresh();
      data.setError(saveError instanceof Error && saveError.message.startsWith("Subject was created,") ? saveError.message : saveError instanceof Error && "code" in saveError && saveError.code === "23505" ? "A subject with that name or code already exists." : "Could not add the subject.");
    } finally {
      setSaving(false);
    }
  };

  const allocateSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSaving(true);
    data.setError("");
    setNotice("");
    try {
      const { error: insertError } = await supabase.from("class_subjects").insert({
        subject_id: String(values.get("subject_id") ?? ""),
        class_id: String(values.get("class_id") ?? ""),
        academic_session_id: String(values.get("academic_session_id") ?? ""),
      });
      if (insertError) throw insertError;
      setNotice("Subject allocated to class.");
      await data.refresh();
    } catch (saveError) {
      console.error("Unable to allocate subject to class:", saveError);
      data.setError(saveError instanceof Error && "code" in saveError && saveError.code === "23505" ? "That subject is already allocated to this class for the selected session." : "Could not allocate the subject.");
    } finally {
      setSaving(false);
    }
  };

  const visibleSubjects = data.subjects.filter((subject) =>
    !selectedSubjectId || subject.id === selectedSubjectId,
  );

  return <>
    <section className="card">
      <div className="card-head"><div><h3>Subject catalogue</h3><p>Student counts reflect current class enrollments and subject allocations.</p></div><button type="button" onClick={() => void data.refresh()} disabled={data.loading}>{data.loading ? "Loading…" : "Refresh"}</button></div>
      <div className="settings-form two-col academic-page-filters">
        <label>Academic session<select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}><option value="">Select session</option>{data.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}{session.is_active ? " (Active)" : ""}</option>)}</select></label>
        <label>Subject filter<select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}><option value="">All subjects</option>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      </div>
      {data.loading ? <p className="directory-empty">Loading subjects and class enrollments…</p> : data.error ? <p className="login-error" role="alert">{data.error}</p> : <div className="table-wrap"><table><thead><tr><th>Subject</th><th>Code</th><th>Category</th><th>Core</th><th>Session</th><th>Classes</th><th>Students taking it</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {visibleSubjects.map((subject) => {
          const allocations = subjectClassRows.get(subject.id) ?? [];
          const candidateCount = allocations.reduce((total, allocation) => total + (enrollmentsByClass.get(allocation.class_id) ?? 0), 0);
          return <tr key={subject.id}><td>{subject.name}</td><td>{subject.code ?? "—"}</td><td>{subject.category ?? "—"}</td><td>{subject.is_core ? "Core" : "Elective"}</td><td>{subjectsInSession.has(subject.id) ? "Allocated" : "Not allocated"}</td><td>{allocations.map((allocation) => classesById.get(allocation.class_id) ?? "Class unavailable").join(", ") || (subject.is_core && subjectsInSession.has(subject.id) ? "All classes" : "Not allocated")}</td><td>{candidateCount}</td><td>{subject.is_active ? "Active" : "Inactive"}</td><td><button type="button" onClick={() => setEditSubject(subject)}>Edit</button></td></tr>;
        })}
      </tbody></table></div>}
      {!data.loading && visibleSubjects.length === 0 && !data.error && <p className="directory-empty">No subjects match this filter.</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
    </section>
    {editSubject && <section className="card academic-edit-card"><div className="card-head"><div><h3>Edit {editSubject.name}</h3><p>Changes update the subject catalogue.</p></div><button type="button" onClick={() => setEditSubject(null)}>Cancel</button></div><form className="student-form academic-edit-form" onSubmit={(event) => void saveSubject(event)}>
      <label>Subject name<input name="name" defaultValue={editSubject.name} required maxLength={120} /></label><label>Code<input name="code" defaultValue={editSubject.code ?? ""} maxLength={32} /></label><label>Category<input name="category" defaultValue={editSubject.category ?? ""} maxLength={80} /></label><label className="checkbox-label"><input type="checkbox" name="is_active" defaultChecked={editSubject.is_active} /> Active</label><label className="checkbox-label"><input type="checkbox" name="is_core" defaultChecked={editSubject.is_core} /> Core subject (all classes)</label><button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save subject"}</button>
    </form></section>}
    <div className="academic-setup-grid academic-management-grid">
      <section className="card setup-card"><div className="card-head"><div><h3>Add subject</h3><p>New subjects are automatically added to the active session.</p></div></div><form className="student-form" onSubmit={(event) => void addSubject(event)}><label>Name<input name="name" required maxLength={120} placeholder="Mathematics" /></label><div className="setup-date-row"><label>Code<input name="code" maxLength={32} /></label><label>Category<input name="category" maxLength={80} /></label></div><input type="hidden" name="academic_session_id" value={activeSession?.id ?? ""} /><p className="result-entry-caption">{activeSession ? `Session: ${activeSession.name}` : "Set an active academic session before adding subjects."}</p><label className="checkbox-label"><input type="checkbox" name="is_core" /> Core subject — allocate to all classes</label><button className="primary" disabled={saving || !activeSession}>Add subject</button></form></section>
      <section className="card setup-card"><div className="card-head"><div><h3>Allocate subject to class</h3><p>Core subjects are automatically allocated to every class.</p></div></div><form className="student-form" onSubmit={(event) => void allocateSubject(event)}><label>Subject<select name="subject_id" required defaultValue=""><option value="" disabled>Select subject</option>{data.subjects.filter((subject) => !subject.is_core).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label>Class<select name="class_id" required defaultValue=""><option value="" disabled>Select class</option>{data.classes.filter((schoolClass) => schoolClass.is_active).map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label><label>Academic session<select name="academic_session_id" required value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}><option value="" disabled>Select session</option>{data.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label><button className="primary" disabled={saving || !data.subjects.some((subject) => !subject.is_core) || !data.classes.some((schoolClass) => schoolClass.is_active) || !data.sessions.length}>Allocate subject</button></form></section>
    </div>
  </>;
}

type ManagedClass = { id: string; name: string; is_active: boolean };

export function ClassManagementContent() {
  const [classes, setClasses] = useState<ManagedClass[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [editing, setEditing] = useState<ManagedClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [classResult, enrollmentResult, allocationResult, examinationResult] = await Promise.all([
        supabase.from("classes").select("id, name, is_active").order("name"),
        supabase.from("student_enrollments").select("student_user_id, class_id, academic_session_id"),
        supabase.from("class_subjects").select("class_id, subject_id, academic_session_id"),
        supabase.from("examinations").select("id, title, academic_term_id, class_id, subject_id, starts_on, ends_on, status"),
      ]);
      const queryError = classResult.error ?? enrollmentResult.error ?? allocationResult.error ?? examinationResult.error;
      if (queryError) throw queryError;
      setClasses(classResult.data ?? []);
      setEnrollments(enrollmentResult.data ?? []);
      setClassSubjects(allocationResult.data ?? []);
      setExaminations(examinationResult.data ?? []);
    } catch (loadError) {
      console.error("Unable to load class management records:", loadError);
      setError("Could not load classes and related records. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) {
      setError("Enter a class name.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const query = editing
        ? supabase.from("classes").update({ name }).eq("id", editing.id)
        : supabase.from("classes").insert({ name });
      const { error: saveError } = await query;
      if (saveError) {
        if (saveError.code === "23505") throw new Error("A class with that name already exists.");
        throw saveError;
      }
      setEditing(null);
      if (!editing) form.reset();
      setNotice(editing ? `Class "${name}" updated.` : `Class "${name}" added.`);
      await load();
    } catch (saveError) {
      console.error("Unable to save class:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save the class.");
    } finally {
      setSaving(false);
    }
  };

  const setClassActive = async (schoolClass: ManagedClass, isActive: boolean) => {
    const action = isActive ? "restore" : "archive";
    if (!window.confirm(`${isActive ? "Restore" : "Archive"} "${schoolClass.name}"? ${isActive ? "It will be available for new enrollments." : "Existing student records and results will be preserved."}`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase.from("classes").update({ is_active: isActive }).eq("id", schoolClass.id);
      if (updateError) throw updateError;
      setNotice(`Class "${schoolClass.name}" ${isActive ? "restored" : "archived"}.`);
      await load();
    } catch (updateError) {
      console.error(`Unable to ${action} class:`, updateError);
      setError(updateError instanceof Error ? updateError.message : `Could not ${action} the class.`);
    } finally {
      setSaving(false);
    }
  };

  const enrollmentCounts = new Map<string, number>();
  for (const enrollment of enrollments) enrollmentCounts.set(enrollment.class_id, (enrollmentCounts.get(enrollment.class_id) ?? 0) + 1);
  const allocationCounts = new Map<string, number>();
  for (const allocation of classSubjects) allocationCounts.set(allocation.class_id, (allocationCounts.get(allocation.class_id) ?? 0) + 1);
  const examinationCounts = new Map<string, number>();
  for (const examination of examinations) {
    if (examination.class_id) examinationCounts.set(examination.class_id, (examinationCounts.get(examination.class_id) ?? 0) + 1);
  }

  return <>
    <section className="card admin-records">
      <div className="record-toolbar"><div><h3>School classes</h3><p>Archive classes to keep historical enrollments, subject allocations, examinations, and results intact.</p></div><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button></div>
      {error && <p className="login-error" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
      {loading ? <p className="directory-empty">Loading classes…</p> : classes.length === 0 ? <p className="directory-empty">No classes have been added yet.</p> : <div className="table-wrap"><table><thead><tr><th>Class</th><th>Students enrolled</th><th>Subject allocations</th><th>Class examinations</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {classes.map((schoolClass) => <tr key={schoolClass.id}><td>{schoolClass.name}</td><td>{enrollmentCounts.get(schoolClass.id) ?? 0}</td><td>{allocationCounts.get(schoolClass.id) ?? 0}</td><td>{examinationCounts.get(schoolClass.id) ?? 0}</td><td>{schoolClass.is_active ? "Active" : "Archived"}</td><td><div className="record-actions"><button type="button" disabled={saving} onClick={() => { setEditing(schoolClass); setError(""); setNotice(""); }}>Edit</button><button type="button" className={schoolClass.is_active ? "delete-record" : ""} disabled={saving} onClick={() => void setClassActive(schoolClass, !schoolClass.is_active)}>{schoolClass.is_active ? "Archive" : "Restore"}</button></div></td></tr>)}
      </tbody></table></div>}
    </section>
    <section className="card academic-edit-card">
      <div className="card-head"><div><h3>{editing ? `Edit ${editing.name}` : "Add class"}</h3><p>{editing ? "Renaming a class preserves its linked records." : "Class names must be unique."}</p></div>{editing && <button type="button" onClick={() => setEditing(null)}>Cancel</button>}</div>
      <form className="student-form academic-edit-form" onSubmit={(event) => void saveClass(event)}>
        <label>Class name<input name="name" required maxLength={80} key={editing?.id ?? "new"} defaultValue={editing?.name ?? ""} placeholder="e.g. SS1" /></label>
        <button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save class" : "Add class"}</button>
      </form>
    </section>
  </>;
}

export function ExaminationManagementContent() {
  const data = useAcademicRecords();
  const [editExam, setEditExam] = useState<Examination | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const termsById = useMemo(() => new Map(data.terms.map((term) => [term.id, term])), [data.terms]);
  const classesById = useMemo(() => new Map(data.classes.map((schoolClass) => [schoolClass.id, schoolClass.name])), [data.classes]);
  const subjectsById = useMemo(() => new Map(data.subjects.map((subject) => [subject.id, subject.name])), [data.subjects]);
  const sessionsById = useMemo(() => new Map(data.sessions.map((session) => [session.id, session.name])), [data.sessions]);
  const candidatesByClassSession = useMemo(() => {
    const counts = new Map<string, number>();
    for (const enrollment of data.enrollments) {
      const key = `${enrollment.class_id}:${enrollment.academic_session_id}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [data.enrollments]);

  const saveExamination = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editExam) return;
    const values = new FormData(event.currentTarget);
    const startsOn = String(values.get("starts_on") ?? "") || null;
    const endsOn = String(values.get("ends_on") ?? "") || null;
    if (startsOn && endsOn && startsOn > endsOn) {
      data.setError("The examination end date must be after its start date.");
      return;
    }
    setSaving(true);
    data.setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase.from("examinations").update({
        title: String(values.get("title") ?? "").trim(),
        academic_term_id: String(values.get("academic_term_id") ?? ""),
        class_id: null,
        subject_id: String(values.get("subject_id") ?? "") || null,
        starts_on: startsOn,
        ends_on: endsOn,
        status: String(values.get("status") ?? "draft"),
      }).eq("id", editExam.id);
      if (updateError) throw updateError;
      setEditExam(null);
      setNotice("Examination details updated.");
      await data.refresh();
    } catch (saveError) {
      console.error("Unable to update examination:", saveError);
      data.setError(saveError instanceof Error ? saveError.message : "Could not update the examination.");
    } finally {
      setSaving(false);
    }
  };

  const deleteExamination = async () => {
    if (!editExam || !window.confirm(`Delete "${editExam.title}"? This cannot be undone.`)) return;
    setSaving(true);
    data.setError("");
    setNotice("");
    try {
      const { error: deleteError } = await supabase.from("examinations").delete().eq("id", editExam.id);
      if (deleteError) {
        if (deleteError.code === "23503") {
          throw new Error("This examination has saved results and cannot be deleted.");
        }
        throw deleteError;
      }
      setEditExam(null);
      setNotice(`Examination "${editExam.title}" deleted.`);
      await data.refresh();
    } catch (deleteError) {
      console.error("Unable to delete examination:", deleteError);
      data.setError(deleteError instanceof Error ? deleteError.message : "Could not delete the examination.");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <section className="card">
      <div className="card-head"><div><h3>Examination register</h3><p>Candidate counts are based on enrollments in the examination’s class or all classes for that session.</p></div><button type="button" onClick={() => void data.refresh()} disabled={data.loading}>{data.loading ? "Loading…" : "Refresh"}</button></div>
      {data.loading ? <p className="directory-empty">Loading examinations and enrollments…</p> : data.error ? <p className="login-error" role="alert">{data.error}</p> : <div className="table-wrap"><table><thead><tr><th>Examination</th><th>Session / Term</th><th>Class</th><th>Subject</th><th>Candidates</th><th>Dates</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {data.examinations.map((exam) => {
          const term = termsById.get(exam.academic_term_id);
          const sessionId = term?.academic_session_id ?? "";
          const candidateCount = exam.class_id
            ? candidatesByClassSession.get(`${exam.class_id}:${sessionId}`) ?? 0
            : [...candidatesByClassSession.entries()].reduce((total, [key, count]) => key.endsWith(`:${sessionId}`) ? total + count : total, 0);
          return <tr key={exam.id}><td>{exam.title}</td><td>{sessionsById.get(sessionId) ?? "Session unavailable"}{term ? ` · ${term.name}` : ""}</td><td>{exam.class_id ? classesById.get(exam.class_id) ?? "Class unavailable" : "All classes"}</td><td>{exam.subject_id ? subjectsById.get(exam.subject_id) ?? "Subject unavailable" : "All subjects"}</td><td>{candidateCount}</td><td>{exam.starts_on ?? "—"} – {exam.ends_on ?? "—"}</td><td>{exam.status.replace(/_/g, " ")}</td><td><button type="button" onClick={() => setEditExam(exam)}>Edit</button></td></tr>;
        })}
      </tbody></table></div>}
      {!data.loading && data.examinations.length === 0 && !data.error && <p className="directory-empty">No examinations created yet. Add one in Academic Setup.</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
    </section>
    {editExam && <section className="card academic-edit-card"><div className="card-head"><div><h3>Edit {editExam.title}</h3><p>Saving updates this examination to cover all classes and subjects.</p></div><button type="button" onClick={() => setEditExam(null)}>Cancel</button></div><form className="student-form academic-edit-form examination-edit-form" onSubmit={(event) => void saveExamination(event)}>
      <label>Title<input name="title" defaultValue={editExam.title} required maxLength={120} /></label><label>Term<select name="academic_term_id" defaultValue={editExam.academic_term_id} required>{data.terms.map((term) => <option key={term.id} value={term.id}>{sessionsById.get(term.academic_session_id)} · {term.name}</option>)}</select></label><label>Starts<input name="starts_on" type="date" defaultValue={editExam.starts_on ?? ""} /></label><label>Ends<input name="ends_on" type="date" defaultValue={editExam.ends_on ?? ""} /></label><label>Status<select name="status" defaultValue={editExam.status}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="published">Published</option></select></label><button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save examination"}</button><button className="delete-record" type="button" disabled={saving} onClick={() => void deleteExamination()}>{saving ? "Working…" : "Delete examination"}</button>
    </form></section>}
  </>;
}
