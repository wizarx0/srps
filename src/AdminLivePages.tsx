import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { supabase } from "./lib/supabase";

type Profile = { id: string; full_name: string; role: string };
type StudentProfile = { user_id: string; student_number: string; guardian_contact: string | null };
type Enrollment = { id: string; student_user_id: string; class_id: string; academic_session_id: string };
type SchoolClass = { id: string; name: string; is_active: boolean };
type Session = { id: string; name: string; is_active: boolean };
type Term = { id: string; academic_session_id: string; name: string; term_number?: number };
type Exam = { id: string; title: string; academic_term_id: string; class_id: string | null };
type Subject = { id: string; name: string };
type AdminPage = "results" | "grades" | "reports" | "users";

export function AdminDataPage({ page }: { page: AdminPage }) {
  if (page === "results") return <AdminResults />;
  if (page === "grades") return <AdminGrades />;
  if (page === "reports") return <AdminReports />;
  return <AdminUsers />;
}

function AdminResults() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Array<{ id: string; student_user_id: string; examination_id: string; subject_id: string; score: number; grade: string | null; is_published: boolean }>>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>([]);
  const [examinations, setExaminations] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [examFilter, setExamFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [results, profileRows, studentRows, examRows, subjectRows, sessionRows, termRows] = await Promise.all([
        supabase.from("results").select("id, student_user_id, examination_id, subject_id, score, grade, is_published, created_at").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, role").eq("role", "student"),
        supabase.from("student_profiles").select("user_id, student_number, guardian_contact"),
        supabase.from("examinations").select("id, title, academic_term_id, class_id"),
        supabase.from("subjects").select("id, name"),
        supabase.from("academic_sessions").select("id, name, is_active").order("name"),
        supabase.from("academic_terms").select("id, academic_session_id, name, term_number").order("term_number"),
      ]);
      const queryError = results.error ?? profileRows.error ?? studentRows.error ?? examRows.error ?? subjectRows.error ?? sessionRows.error ?? termRows.error;
      if (queryError) throw queryError;
      setRows(results.data ?? []);
      setProfiles(profileRows.data ?? []);
      setStudentProfiles(studentRows.data ?? []);
      setExaminations(examRows.data ?? []);
      setSubjects(subjectRows.data ?? []);
      setSessions(sessionRows.data ?? []);
      setTerms(termRows.data ?? []);
    } catch (loadError) {
      console.error("Unable to load admin results:", loadError);
      setError("Could not load result records.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const profileById = new Map(profiles.map((item) => [item.id, item]));
  const studentById = new Map(studentProfiles.map((item) => [item.user_id, item]));
  const examById = new Map(examinations.map((item) => [item.id, item]));
  const subjectById = new Map(subjects.map((item) => [item.id, item]));
  const termById = new Map(terms.map((item) => [item.id, item]));
  const sessionById = new Map(sessions.map((item) => [item.id, item]));
  const filteredRows = rows.filter((row) => {
    const examination = examById.get(row.examination_id);
    const term = examination ? termById.get(examination.academic_term_id) : undefined;
    return (statusFilter === "all" || (statusFilter === "published" ? row.is_published : !row.is_published))
      && (!sessionFilter || term?.academic_session_id === sessionFilter)
      && (!termFilter || term?.id === termFilter)
      && (!examFilter || examination?.id === examFilter);
  }).sort((left, right) => {
    const leftExam = examById.get(left.examination_id);
    const rightExam = examById.get(right.examination_id);
    const leftTerm = leftExam ? termById.get(leftExam.academic_term_id) : undefined;
    const rightTerm = rightExam ? termById.get(rightExam.academic_term_id) : undefined;
    const leftSession = leftTerm ? sessionById.get(leftTerm.academic_session_id) : undefined;
    const rightSession = rightTerm ? sessionById.get(rightTerm.academic_session_id) : undefined;
    return (leftSession?.name ?? "").localeCompare(rightSession?.name ?? "")
      || (leftTerm?.term_number ?? 0) - (rightTerm?.term_number ?? 0)
      || (leftExam?.title ?? "").localeCompare(rightExam?.title ?? "")
      || (profileById.get(left.student_user_id)?.full_name ?? "").localeCompare(profileById.get(right.student_user_id)?.full_name ?? "");
  });
  const groupedRows = new Map<string, { heading: string; rows: typeof filteredRows }>();
  for (const row of filteredRows) {
    const examination = examById.get(row.examination_id);
    const term = examination ? termById.get(examination.academic_term_id) : undefined;
    const sessionName = term ? sessionById.get(term.academic_session_id)?.name ?? "Session unavailable" : "Session unavailable";
    const groupKey = `${term?.academic_session_id ?? "missing-session"}:${term?.id ?? "missing-term"}:${examination?.id ?? row.examination_id}`;
    const group = groupedRows.get(groupKey) ?? {
      heading: `${sessionName} · ${term?.name ?? "Term unavailable"} · ${examination?.title ?? "Examination unavailable"}`,
      rows: [],
    };
    group.rows.push(row);
    groupedRows.set(groupKey, group);
  }
  const availableTerms = terms.filter((term) => !sessionFilter || term.academic_session_id === sessionFilter)
    .sort((left, right) => (left.term_number ?? 0) - (right.term_number ?? 0));
  const availableExaminations = examinations.filter((examination) => {
    const term = termById.get(examination.academic_term_id);
    return (!sessionFilter || term?.academic_session_id === sessionFilter) && (!termFilter || term?.id === termFilter);
  }).sort((left, right) => left.title.localeCompare(right.title));

  return <section className="card admin-records">
    <div className="record-toolbar"><div><h3>Result records</h3><p>{rows.length} saved result rows</p></div><div className="result-entry-actions"><select aria-label="Filter by session" value={sessionFilter} onChange={(event) => { setSessionFilter(event.target.value); setTermFilter(""); setExamFilter(""); }}><option value="">All sessions</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Filter by term" value={termFilter} onChange={(event) => { setTermFilter(event.target.value); setExamFilter(""); }}><option value="">All terms</option>{availableTerms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Filter by examination" value={examFilter} onChange={(event) => setExamFilter(event.target.value)}><option value="">All examinations</option>{availableExaminations.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><select aria-label="Filter by publication status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Drafts</option></select><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button><button className="primary" type="button" onClick={() => navigate("/admin/results/entry")}>Enter class results</button></div></div>
    {error && <p className="login-error" role="alert">{error}</p>}
    {loading ? <p className="directory-empty">Loading results…</p> : filteredRows.length === 0 ? <p className="directory-empty">No result records match these filters.</p> : [...groupedRows.entries()].map(([key, group]) => <section className="result-group" key={key}><h4>{group.heading}</h4><div className="table-wrap"><table><thead><tr><th>Student</th><th>Student ID</th><th>Subject</th><th>Score</th><th>Grade</th><th>Status</th></tr></thead><tbody>{group.rows.map((row) => <tr key={row.id}><td>{profileById.get(row.student_user_id)?.full_name ?? "Student unavailable"}</td><td>{studentById.get(row.student_user_id)?.student_number ?? "—"}</td><td>{subjectById.get(row.subject_id)?.name ?? "Subject unavailable"}</td><td>{Number(row.score).toFixed(2)}%</td><td>{row.grade ?? "—"}</td><td>{row.is_published ? "Published" : "Draft"}</td></tr>)}</tbody></table></div></section>)}
  </section>;
}

type GradeBand = { id: string; label: string; minimum_score: number; maximum_score: number; description: string | null };
function AdminGrades() {
  const [bands, setBands] = useState<GradeBand[]>([]);
  const [results, setResults] = useState<Array<{ score: number; grade: string | null; is_published: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<GradeBand | null>(null);
  const [passingScore, setPassingScore] = useState("50");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [bandResult, resultResult, settingsResult] = await Promise.all([
        supabase.from("grade_bands").select("id, label, minimum_score, maximum_score, description").order("minimum_score", { ascending: false }),
        supabase.from("results").select("score, grade, is_published"),
        supabase.from("school_settings").select("passing_score").eq("id", true).maybeSingle(),
      ]);
      if (bandResult.error) throw bandResult.error;
      if (resultResult.error) throw resultResult.error;
      if (settingsResult.error) throw settingsResult.error;
      setBands(bandResult.data ?? []);
      setResults(resultResult.data ?? []);
      setPassingScore(String(settingsResult.data?.passing_score ?? 50));
    } catch (loadError) {
      console.error("Unable to load grading records:", loadError);
      setError("Could not load grade bands and result counts.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const savePassingScore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const score = Number(passingScore);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError("Enter a passing score between 0 and 100.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: saveError } = await supabase.from("school_settings")
        .update({ passing_score: score })
        .eq("id", true);
      if (saveError) throw saveError;
      setNotice("Minimum passing score updated.");
      await load();
    } catch (saveError) {
      console.error("Unable to update the minimum passing score:", saveError);
      setError("Could not save the minimum passing score.");
    } finally {
      setSaving(false);
    }
  };

  const saveBand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const label = String(values.get("label") ?? "").trim();
    const minimum = Number(values.get("minimum_score"));
    const maximum = Number(values.get("maximum_score"));
    if (!label || minimum < 0 || maximum > 100 || minimum > maximum) {
      setError("Enter a grade label and a valid score range between 0 and 100.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const query = editing
        ? supabase.from("grade_bands").update({ label, minimum_score: minimum, maximum_score: maximum, description: String(values.get("description") ?? "").trim() || null }).eq("id", editing.id)
        : supabase.from("grade_bands").insert({ label, minimum_score: minimum, maximum_score: maximum, description: String(values.get("description") ?? "").trim() || null });
      const { error: saveError } = await query;
      if (saveError) throw saveError;
      setEditing(null);
      setNotice(editing ? "Grade band updated." : "Grade band added.");
      await load();
    } catch (saveError) {
      console.error("Unable to save grade band:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save grade band.");
    } finally {
      setSaving(false);
    }
  };

  const deleteBand = async (band: GradeBand) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: deleteError } = await supabase.from("grade_bands").delete().eq("id", band.id);
      if (deleteError) throw deleteError;
      setNotice(`Grade band ${band.label} removed. Existing saved grades are unchanged.`);
      await load();
    } catch (deleteError) {
      console.error("Unable to delete grade band:", deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete grade band.");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <section className="card academic-edit-card">
      <div className="card-head"><div><h3>Pass rate settings</h3><p>This minimum score determines the active-session pass rate on the admin dashboard.</p></div></div>
      <form className="student-form academic-edit-form" onSubmit={(event) => void savePassingScore(event)}>
        <label>Minimum passing score (%)<input type="number" min="0" max="100" step="0.01" value={passingScore} onChange={(event) => setPassingScore(event.target.value)} required /></label>
        <button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save passing score"}</button>
      </form>
    </section>
    <section className="card admin-records">
      <div className="record-toolbar"><div><h3>Grade bands</h3><p>{results.filter((result) => result.is_published).length} published results · grades are derived from the score ranges below</p></div><button type="button" onClick={() => { setEditing(null); setNotice(""); }}>+ Add grade band</button></div>
      {error && <p className="login-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
      {loading ? <p className="directory-empty">Loading grade bands…</p> : bands.length === 0 ? <p className="directory-empty">No grade bands configured. Add the school’s grading scale.</p> : <div className="table-wrap"><table><thead><tr><th>Grade</th><th>Minimum</th><th>Maximum</th><th>Published results in band</th><th>Description</th><th>Actions</th></tr></thead><tbody>
        {bands.map((band) => <tr key={band.id}><td>{band.label}</td><td>{band.minimum_score}</td><td>{band.maximum_score}</td><td>{results.filter((result) => result.is_published && Number(result.score) >= Number(band.minimum_score) && Number(result.score) <= Number(band.maximum_score)).length}</td><td>{band.description ?? "—"}</td><td><div className="record-actions"><button type="button" onClick={() => setEditing(band)}>Edit</button><button type="button" className="delete-record" disabled={saving} onClick={() => void deleteBand(band)}>Delete</button></div></td></tr>)}
      </tbody></table></div>}
    </section>
    {!editing && <section className="card academic-edit-card"><h3>Add grade band</h3><GradeBandForm key="new" band={null} saving={saving} onSubmit={saveBand} /></section>}
    {editing && <section className="card academic-edit-card"><div className="card-head"><h3>Edit grade band {editing.label}</h3><button type="button" onClick={() => setEditing(null)}>Cancel</button></div><GradeBandForm key={editing.id} band={editing} saving={saving} onSubmit={saveBand} /></section>}
  </>;
}

function GradeBandForm({ band, saving, onSubmit }: { band: GradeBand | null; saving: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="student-form academic-edit-form" onSubmit={onSubmit}>
    <label>Grade label<input name="label" required maxLength={24} defaultValue={band?.label ?? ""} placeholder="A" /></label>
    <label>Minimum score<input name="minimum_score" type="number" min="0" max="100" step="0.01" required defaultValue={band?.minimum_score ?? ""} /></label>
    <label>Maximum score<input name="maximum_score" type="number" min="0" max="100" step="0.01" required defaultValue={band?.maximum_score ?? ""} /></label>
    <label>Description<input name="description" maxLength={200} defaultValue={band?.description ?? ""} /></label>
    <button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : band ? "Save grade band" : "Add grade band"}</button>
  </form>;
}

type Report = { id: string; student_user_id: string; academic_term_id: string; title: string; status: string; storage_path: string | null; created_at: string };
const REPORT_BUCKET = "student-reports";
const MAX_REPORT_SIZE = 10 * 1024 * 1024;

function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingReportId, setDownloadingReportId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [reportResult, profileResult, studentResult, termResult, sessionResult] = await Promise.all([
        supabase.from("student_reports").select("id, student_user_id, academic_term_id, title, status, storage_path, created_at").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, role").eq("role", "student"),
        supabase.from("student_profiles").select("user_id, student_number, guardian_contact"),
        supabase.from("academic_terms").select("id, academic_session_id, name"),
        supabase.from("academic_sessions").select("id, name, is_active").order("name"),
      ]);
      const queryError = reportResult.error ?? profileResult.error ?? studentResult.error ?? termResult.error ?? sessionResult.error;
      if (queryError) throw queryError;
      setReports(reportResult.data ?? []);
      setProfiles(profileResult.data ?? []);
      setStudents(studentResult.data ?? []);
      setTerms(termResult.data ?? []);
      setSessions(sessionResult.data ?? []);
    } catch (loadError) {
      console.error("Unable to load student reports:", loadError);
      setError("Could not load student reports.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const createReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(event.currentTarget);
    const file = values.get("document");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      setError("Choose a PDF report document.");
      return;
    }
    if (file.size > MAX_REPORT_SIZE) {
      setError("The report PDF must be 10 MB or smaller.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    let reportId: string | null = null;
    let storagePath: string | null = null;
    try {
      const studentUserId = String(values.get("student_user_id") ?? "");
      const { data: report, error: insertError } = await supabase.from("student_reports").insert({
        student_user_id: studentUserId,
        academic_term_id: String(values.get("academic_term_id") ?? ""),
        title: String(values.get("title") ?? "").trim(),
        status: "draft",
      }).select("id").single();
      if (insertError) throw insertError;
      reportId = report.id;

      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      storagePath = `${studentUserId}/${report.id}/${safeFilename}`;
      const { error: uploadError } = await supabase.storage.from(REPORT_BUCKET).upload(storagePath, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const status = String(values.get("status") ?? "draft");
      const { error: updateError } = await supabase.from("student_reports").update({
        storage_path: storagePath,
        status,
      }).eq("id", report.id);
      if (updateError) throw updateError;

      form.reset();
      setNotice(status === "published" ? "Report uploaded and published." : "Report uploaded as a draft.");
      await load();
    } catch (saveError) {
      console.error("Unable to create student report:", saveError);
      let cleanupFailed = false;
      if (storagePath) {
        const { error: cleanupError } = await supabase.storage.from(REPORT_BUCKET).remove([storagePath]);
        if (cleanupError) {
          console.error("Unable to clean up an incomplete report upload:", cleanupError);
          cleanupFailed = true;
        }
      }
      if (reportId) {
        const { error: cleanupError } = await supabase.from("student_reports").delete().eq("id", reportId);
        if (cleanupError) {
          console.error("Unable to clean up an incomplete report record:", cleanupError);
          cleanupFailed = true;
        }
      }
      const duplicate = typeof saveError === "object" && saveError !== null && "code" in saveError && saveError.code === "23505";
      setError(duplicate
        ? "A report with this title already exists for this student and term."
        : cleanupFailed
          ? "The report could not be completed, and cleanup was unsuccessful. Refresh the report list and check for an incomplete draft."
          : "Could not upload the report. Check the PDF and try again.");
    } finally {
      setSaving(false);
    }
  };

  const downloadReport = async (report: Report) => {
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
      setError("Could not download this report document.");
    } finally {
      setDownloadingReportId("");
    }
  };

  const updateStatus = async (report: Report) => {
    const status = report.status === "published" ? "draft" : "published";
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase.from("student_reports").update({ status }).eq("id", report.id);
      if (updateError) throw updateError;
      setNotice(`Report ${status}.`);
      await load();
    } catch (updateError) {
      console.error("Unable to update report status:", updateError);
      setError("Could not update report status.");
    } finally {
      setSaving(false);
    }
  };

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const studentById = new Map(students.map((student) => [student.user_id, student]));
  const termById = new Map(terms.map((term) => [term.id, term]));
  const sessionById = new Map(sessions.map((session) => [session.id, session.name]));

  return <>
    <section className="card admin-records">
      <div className="record-toolbar"><div><h3>Student reports</h3><p>{reports.length} report records · PDF documents up to 10 MB</p></div><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button></div>
      {error && <p className="login-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
      {loading ? <p className="directory-empty">Loading reports…</p> : reports.length === 0 ? <p className="directory-empty">No reports created yet.</p> : <div className="table-wrap"><table><thead><tr><th>Student</th><th>Student ID</th><th>Report</th><th>Session / Term</th><th>Document</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {reports.map((report) => {
          const term = termById.get(report.academic_term_id);
          const filename = report.storage_path?.split("/").pop();
          return <tr key={report.id}><td>{profileById.get(report.student_user_id)?.full_name ?? "Student unavailable"}</td><td>{studentById.get(report.student_user_id)?.student_number ?? "—"}</td><td>{report.title}</td><td>{term ? `${sessionById.get(term.academic_session_id) ?? "Session unavailable"} · ${term.name}` : "Term unavailable"}</td><td>{report.storage_path ? <button type="button" disabled={downloadingReportId === report.id} onClick={() => void downloadReport(report)}>{downloadingReportId === report.id ? "Preparing…" : `Download ${filename}`}</button> : "Not attached"}</td><td>{report.status}</td><td><button type="button" disabled={saving || (report.status !== "published" && !report.storage_path)} onClick={() => void updateStatus(report)}>{report.status === "published" ? "Unpublish" : "Publish"}</button></td></tr>;
        })}
      </tbody></table></div>}
    </section>
    <section className="card academic-edit-card"><div className="card-head"><div><h3>Upload student report</h3><p>Attach a PDF report card. Published reports are available to the selected student.</p></div></div><form className="student-form academic-edit-form" onSubmit={(event) => void createReport(event)}>
      <label>Student<select name="student_user_id" required defaultValue=""><option value="" disabled>Select student</option>{students.map((student) => <option key={student.user_id} value={student.user_id}>{profileById.get(student.user_id)?.full_name ?? "Student"} · {student.student_number}</option>)}</select></label>
      <label>Term<select name="academic_term_id" required defaultValue=""><option value="" disabled>Select term</option>{terms.map((term) => <option key={term.id} value={term.id}>{sessionById.get(term.academic_session_id)} · {term.name}</option>)}</select></label>
      <label>Report title<input name="title" required maxLength={120} placeholder="Term Report Card" /></label>
      <label>PDF document<input name="document" type="file" accept="application/pdf,.pdf" required /></label>
      <label>Status<select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="published">Published</option></select></label>
      <button className="primary" disabled={saving || students.length === 0 || terms.length === 0}>{saving ? "Uploading…" : "Upload report"}</button>
    </form></section>
  </>;
}

function AdminUsers() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [profileResult, studentResult, enrollmentResult, classResult, sessionResult] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role").order("full_name"),
        supabase.from("student_profiles").select("user_id, student_number, guardian_contact"),
        supabase.from("student_enrollments").select("id, student_user_id, class_id, academic_session_id"),
        supabase.from("classes").select("id, name, is_active"),
        supabase.from("academic_sessions").select("id, name, is_active").order("name"),
      ]);
      const queryError = profileResult.error ?? studentResult.error ?? enrollmentResult.error ?? classResult.error ?? sessionResult.error;
      if (queryError) throw queryError;
      setProfiles(profileResult.data ?? []);
      setStudents(studentResult.data ?? []);
      setEnrollments(enrollmentResult.data ?? []);
      setClasses(classResult.data ?? []);
      setSessions(sessionResult.data ?? []);
    } catch (loadError) {
      console.error("Unable to load user accounts:", loadError);
      setError("Could not load user accounts.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  const studentById = new Map(students.map((student) => [student.user_id, student]));
  const classById = new Map(classes.map((item) => [item.id, item.name]));
  const sessionById = new Map(sessions.map((item) => [item.id, item.name]));
  const filtered = profiles.filter((profile) => {
    const studentId = studentById.get(profile.id)?.student_number ?? "";
    return `${profile.full_name} ${profile.role} ${studentId}`.toLowerCase().includes(query.toLowerCase());
  });

  return <section className="card admin-records">
    <div className="record-toolbar"><div><h3>User accounts</h3><p>{profiles.length} real account profiles · student credentials are created from Student Accounts</p></div><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button></div>
    <label className="student-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, student ID, or role" /></label>
    {error && <p className="login-error" role="alert">{error}</p>}
    {loading ? <p className="directory-empty">Loading accounts…</p> : filtered.length === 0 ? <p className="directory-empty">No accounts match this search.</p> : <div className="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Student ID</th><th>Class</th><th>Academic session</th><th>Actions</th></tr></thead><tbody>
      {filtered.map((profile) => {
        const student = studentById.get(profile.id);
        const enrollment = enrollments.find((item) => item.student_user_id === profile.id);
        return <tr key={profile.id}><td>{profile.full_name}</td><td>{profile.role}</td><td>{student?.student_number ?? "—"}</td><td>{enrollment ? classById.get(enrollment.class_id) ?? "—" : "—"}</td><td>{enrollment ? sessionById.get(enrollment.academic_session_id) ?? "—" : "—"}</td><td>{student && <button type="button" onClick={() => navigate(`/admin/students/${profile.id}`)}>Student overview</button>}</td></tr>;
      })}
    </tbody></table></div>}
    <p className="result-entry-caption">Email addresses are securely managed and are not displayed here. Account management remains restricted to the secure admin creation flow.</p>
  </section>;
}

type StudentOverviewRecord = {
  profile: Profile;
  student: StudentProfile;
  className: string;
  sessionName: string;
};

export function AdminStudentOverview() {
  const navigate = useNavigate();
  const { studentId = "" } = useParams();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [results, setResults] = useState<Array<{ id: string; student_user_id: string; score: number; grade: string | null; is_published: boolean; examination_id: string; subject_id: string }>>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [examinations, setExaminations] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Profile");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [profileResult, studentResult, enrollmentResult, classResult, sessionResult, resultResult, reportResult, examResult, subjectResult, termResult] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role").eq("role", "student").order("full_name"),
        supabase.from("student_profiles").select("user_id, student_number, guardian_contact"),
        supabase.from("student_enrollments").select("id, student_user_id, class_id, academic_session_id"),
        supabase.from("classes").select("id, name, is_active"),
        supabase.from("academic_sessions").select("id, name, is_active").order("name"),
        supabase.from("results").select("id, student_user_id, score, grade, is_published, examination_id, subject_id"),
        supabase.from("student_reports").select("id, student_user_id, academic_term_id, title, status, storage_path, created_at"),
        supabase.from("examinations").select("id, title, academic_term_id, class_id"),
        supabase.from("subjects").select("id, name"),
        supabase.from("academic_terms").select("id, academic_session_id, name, term_number").order("term_number"),
      ]);
      const queryError = profileResult.error ?? studentResult.error ?? enrollmentResult.error ?? classResult.error ?? sessionResult.error ?? resultResult.error ?? reportResult.error ?? examResult.error ?? subjectResult.error ?? termResult.error;
      if (queryError) throw queryError;
      setProfiles(profileResult.data ?? []);
      setStudents(studentResult.data ?? []);
      setEnrollments(enrollmentResult.data ?? []);
      setClasses(classResult.data ?? []);
      setSessions(sessionResult.data ?? []);
      setResults(resultResult.data ?? []);
      setReports(reportResult.data ?? []);
      setExaminations(examResult.data ?? []);
      setSubjects(subjectResult.data ?? []);
      setTerms(termResult.data ?? []);
    } catch (loadError) {
      console.error("Unable to load student overview records:", loadError);
      setError("Could not load student records.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const classById = new Map(classes.map((item) => [item.id, item.name]));
  const sessionById = new Map(sessions.map((item) => [item.id, item.name]));
  const studentById = new Map(students.map((item) => [item.user_id, item]));
  const enrollmentByStudent = new Map(enrollments.map((item) => [item.student_user_id, item]));
  const profilesById = new Map(profiles.map((item) => [item.id, item]));
  const studentRows = useMemo(() => students.flatMap((student) => {
    const profile = profilesById.get(student.user_id);
    if (!profile) return [];
    const enrollment = enrollmentByStudent.get(student.user_id);
    return [{
      profile,
      student,
      className: enrollment ? classById.get(enrollment.class_id) ?? "Class unavailable" : "Not enrolled",
      sessionName: enrollment ? sessionById.get(enrollment.academic_session_id) ?? "Session unavailable" : "—",
    } satisfies StudentOverviewRecord];
  }).filter((row) => `${row.profile.full_name} ${row.student.student_number}`.toLowerCase().includes(query.toLowerCase())), [students, profiles, enrollments, classes, sessions, query]);

  const selected = studentRows.find((row) => row.profile.id === studentId) ?? null;
  const selectedEnrollment = selected ? enrollmentByStudent.get(selected.profile.id) : null;
  useEffect(() => {
    setSelectedStudentId(selected?.profile.full_name ?? "");
    setSelectedClassId(selectedEnrollment?.class_id ?? "");
  }, [selected?.profile.id, selected?.profile.full_name, selectedEnrollment?.class_id]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const values = new FormData(event.currentTarget);
    const fullName = String(values.get("full_name") ?? "").trim();
    const studentNumber = String(values.get("student_number") ?? "").trim();
    const classId = String(values.get("class_id") ?? "");
    if (!fullName || !studentNumber || !classId) {
      setError("Name, student ID, and class are required.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const [profileUpdate, studentUpdate] = await Promise.all([
        supabase.from("profiles").update({ full_name: fullName }).eq("id", selected.profile.id),
        supabase.from("student_profiles").update({
          student_number: studentNumber,
          guardian_contact: String(values.get("guardian_contact") ?? "").trim() || null,
        }).eq("user_id", selected.profile.id),
      ]);
      if (profileUpdate.error) throw profileUpdate.error;
      if (studentUpdate.error) throw studentUpdate.error;
      if (selectedEnrollment) {
        const { error: enrollmentError } = await supabase.from("student_enrollments").update({ class_id: classId }).eq("id", selectedEnrollment.id);
        if (enrollmentError) throw enrollmentError;
      } else {
        const activeSession = sessions.find((item) => item.is_active);
        if (!activeSession) throw new Error("Set an active academic session before enrolling this student.");
        const { error: enrollmentError } = await supabase.from("student_enrollments").insert({
          student_user_id: selected.profile.id,
          class_id: classId,
          academic_session_id: activeSession.id,
        });
        if (enrollmentError) throw enrollmentError;
      }
      setNotice("Student profile updated.");
      await load();
    } catch (saveError) {
      console.error("Unable to update student profile:", saveError);
      setError(saveError instanceof Error && "code" in saveError && saveError.code === "23505" ? "That student ID is already in use." : "Could not update the student profile.");
    } finally {
      setSaving(false);
    }
  };

  const setStudentPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    if (password.length < 8) {
      setPasswordError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setPasswordError("The passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    setPasswordError("");
    setPasswordNotice("");
    try {
      const { error: invokeError } = await supabase.functions.invoke("set-student-password", {
        body: { studentUserId: selected.profile.id, password },
      });
      if (invokeError) {
        const response = invokeError.context;
        if (response instanceof Response) {
          const responseBody: unknown = await response.json().catch(() => null);
          if (responseBody && typeof responseBody === "object" && "error" in responseBody && typeof responseBody.error === "string") {
            throw new Error(responseBody.error);
          }
        }
        throw new Error(invokeError.message);
      }
      form.reset();
      setPasswordNotice("Student password updated. Share it securely with the student.");
    } catch (updateError) {
      console.error("Unable to update the student password:", updateError);
      setPasswordError(updateError instanceof Error ? updateError.message : "Could not update the student password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!studentId || studentId === "overview") {
    return <section className="card student-selector">
      <div className="card-head"><div><h3>Student directory</h3><p>{students.length} student accounts</p></div><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button></div>
      <label className="student-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by student name or ID" /></label>
      {error && <p className="login-error" role="alert">{error}</p>}
      {loading ? <p className="directory-empty">Loading student records…</p> : studentRows.length === 0 ? <p className="directory-empty">No students match the search.</p> : studentRows.map((row) => <button className="student-select-row" key={row.profile.id} onClick={() => navigate(`/admin/students/${row.profile.id}`)}><span className="student-select-avatar">{row.profile.full_name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2)}</span><span><b>{row.profile.full_name}</b><small>{row.student.student_number} · {row.className} · {row.sessionName}</small></span><span className="directory-arrow">Open profile →</span></button>)}
    </section>;
  }

  const studentResults = results.filter((result) => result.student_user_id === studentId);
  const studentReports = reports.filter((report) => report.student_user_id === studentId);
  const examById = new Map(examinations.map((item) => [item.id, item]));
  const subjectById = new Map(subjects.map((item) => [item.id, item.name]));
  const termById = new Map(terms.map((item) => [item.id, item]));
  const activeSession = sessions.find((item) => item.is_active);
  const currentSessionResults = studentResults.filter((result) => {
    const examination = examById.get(result.examination_id);
    const term = examination ? termById.get(examination.academic_term_id) : undefined;
    return result.is_published && term?.academic_session_id === activeSession?.id;
  });
  const currentAverage = currentSessionResults.length
    ? currentSessionResults.reduce((total, result) => total + Number(result.score), 0) / currentSessionResults.length
    : null;
  const sessionOrder = new Map(sessions.map((item, index) => [item.id, index]));
  const sortedStudentResults = [...studentResults].sort((left, right) => {
    const leftExam = examById.get(left.examination_id);
    const rightExam = examById.get(right.examination_id);
    const leftTerm = leftExam ? termById.get(leftExam.academic_term_id) : undefined;
    const rightTerm = rightExam ? termById.get(rightExam.academic_term_id) : undefined;
    return (sessionOrder.get(leftTerm?.academic_session_id ?? "") ?? Number.MAX_SAFE_INTEGER)
      - (sessionOrder.get(rightTerm?.academic_session_id ?? "") ?? Number.MAX_SAFE_INTEGER)
      || (leftTerm?.term_number ?? 0) - (rightTerm?.term_number ?? 0)
      || (leftExam?.title ?? "").localeCompare(rightExam?.title ?? "");
  });
  const resultsByTerm = new Map<string, { heading: string; results: typeof sortedStudentResults }>();
  for (const result of sortedStudentResults) {
    const examination = examById.get(result.examination_id);
    const term = examination ? termById.get(examination.academic_term_id) : undefined;
    const sessionName = term ? sessionById.get(term.academic_session_id) ?? "Session unavailable" : "Session unavailable";
    const groupKey = `${term?.academic_session_id ?? "missing-session"}:${term?.id ?? "missing-term"}`;
    const group = resultsByTerm.get(groupKey) ?? {
      heading: `${sessionName} · ${term?.name ?? "Term unavailable"}`,
      results: [],
    };
    group.results.push(result);
    resultsByTerm.set(groupKey, group);
  }

  return <div className="student-profile-page">
    <button className="back-link" onClick={() => navigate("/admin/students/overview")}>← Student directory</button>
    {error && <p className="login-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {loading ? <section className="card"><p className="directory-empty">Loading student profile…</p></section> : !selected ? <section className="card"><p className="directory-empty">Student record not found.</p></section> : <>
      <section className="student-profile-head"><div className="student-photo">{selected.profile.full_name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2)}</div><div><span className="eyebrow">STUDENT OVERVIEW</span><h2>{selected.profile.full_name}</h2><p>{selected.student.student_number} · {selected.className} · {selected.sessionName}</p></div><aside className="student-current-average" aria-label={`Current session average: ${currentAverage === null ? "no published results" : `${currentAverage.toFixed(1)} percent`}`}><span>Current Average</span><strong>{currentAverage === null ? "—" : `${currentAverage.toFixed(1)}%`}</strong><small>{activeSession?.name ?? "No active session"}</small></aside></section>
      <div className="profile-tabs">{["Profile", "Results", "Reports"].map((item) => <button type="button" key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
      {tab === "Profile" ? <><section className="card student-profile-panel"><div className="card-head"><h3>Profile & enrolment</h3></div><form className="student-form academic-edit-form" onSubmit={(event) => void saveProfile(event)}>
        <label>Full name<input name="full_name" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} required /></label>
        <label>Student ID<input name="student_number" defaultValue={selected.student.student_number} required /></label>
        <label>Guardian contact<input name="guardian_contact" defaultValue={selected.student.guardian_contact ?? ""} /></label>
        <label>Class<select name="class_id" value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} required>{classes.filter((item) => item.is_active || item.id === selectedClassId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_active ? "" : " (Archived)"}</option>)}</select></label>
        <button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
      </form></section><section className="card student-profile-panel"><div className="card-head"><div><h3>Change student password</h3><p>Set a temporary password and share it with the student securely.</p></div></div><form className="student-form academic-edit-form" onSubmit={(event) => void setStudentPassword(event)}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label><button className="primary" type="submit" disabled={passwordSaving}>{passwordSaving ? "Updating…" : "Update student password"}</button></form>{passwordError && <p className="login-error" role="alert">{passwordError}</p>}{passwordNotice && <p className="form-success" role="status">{passwordNotice}</p>}</section></> : tab === "Results" ? <section className="student-result-groups">{[...resultsByTerm.entries()].map(([key, group]) => <section className="card student-result-group" key={key}><h3>{group.heading}</h3><div className="table-wrap"><table><thead><tr><th>Examination</th><th>Subject</th><th>Score</th><th>Grade</th><th>Status</th></tr></thead><tbody>{group.results.map((result) => <tr key={result.id}><td>{examById.get(result.examination_id)?.title ?? "Examination"}</td><td>{subjectById.get(result.subject_id) ?? "Subject"}</td><td>{Number(result.score).toFixed(2)}%</td><td>{result.grade ?? "—"}</td><td>{result.is_published ? "Published" : "Draft"}</td></tr>)}</tbody></table></div></section>)}{studentResults.length === 0 && <section className="card"><p className="directory-empty">No results for this student.</p></section>}</section> : <section className="card"><div className="history-list">{studentReports.map((report) => { const term = termById.get(report.academic_term_id); return <div key={report.id}><p><b>{report.title}</b><small>{term ? `${sessionById.get(term.academic_session_id) ?? "Session"} · ${term.name}` : "Term unavailable"} · {report.status}</small></p><span>{report.storage_path ?? "No document attached"}</span></div>; })}</div>{studentReports.length === 0 && <p className="directory-empty">No reports for this student.</p>}</section>}
    </>}
  </div>;
}
