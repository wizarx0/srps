import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { useAuth } from "./lib/auth";

type AcademicSession = { id: string; name: string; is_active: boolean };
type AcademicTerm = { id: string; academic_session_id: string; name: string; term_number: number };
type SchoolClass = { id: string; name: string; is_active: boolean };
type Subject = { id: string; name: string; is_active: boolean };
type Examination = { id: string; title: string; academic_term_id: string; class_id: string | null; subject_id: string | null; status: string };
type GradeBand = { label: string; minimum_score: number; maximum_score: number };
type AssessmentComponent = { id: string; name: string; maximum_score: number; display_order: number };
type StudentRow = { userId: string; fullName: string; studentNumber: string };

export function ResultEntryContent() {
  const { session } = useAuth();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allocatedSubjectIds, setAllocatedSubjectIds] = useState<string[]>([]);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [components, setComponents] = useState<AssessmentComponent[]>([]);
  const [gradeBands, setGradeBands] = useState<GradeBand[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, string>>>({});
  const [published, setPublished] = useState<Record<string, boolean>>({});
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [examinationId, setExaminationId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [componentsFor, setComponentsFor] = useState("");
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [loadingSubjectAllocations, setLoadingSubjectAllocations] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedExamination = examinations.find((examination) => examination.id === examinationId) ?? null;
  const selectedTerm = terms.find((term) => term.id === termId) ?? null;
  const filteredTerms = useMemo(
    () => terms.filter((term) => term.academic_session_id === sessionId),
    [sessionId, terms],
  );
  const filteredExaminations = useMemo(
    () => examinations.filter((examination) => examination.academic_term_id === termId && (!examination.class_id || examination.class_id === classId)),
    [classId, examinations, termId],
  );
  const selectedSubjectId = selectedExamination?.subject_id ?? subjectId;
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const availableSubjects = selectedExamination?.subject_id
    ? subjects.filter((subject) => subject.id === selectedExamination.subject_id)
    : subjects.filter((subject) => allocatedSubjectIds.includes(subject.id));
  const componentSelection = examinationId && selectedSubjectId ? `${examinationId}:${selectedSubjectId}` : "";

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoadingSetup(true);
      try {
        const [sessionResult, classResult, subjectResult, bandResult] = await Promise.all([
          supabase.from("academic_sessions").select("id, name, is_active").order("name"),
          supabase.from("classes").select("id, name, is_active").eq("is_active", true).order("name"),
          supabase.from("subjects").select("id, name, is_active").eq("is_active", true).order("name"),
          supabase.from("grade_bands").select("label, minimum_score, maximum_score").order("minimum_score", { ascending: false }),
        ]);
        const queryError = sessionResult.error ?? classResult.error ?? subjectResult.error ?? bandResult.error;
        if (queryError) throw queryError;
        if (!active) return;
        const loadedSessions = sessionResult.data ?? [];
        setSessions(loadedSessions);
        setClasses(classResult.data ?? []);
        setSubjects(subjectResult.data ?? []);
        setGradeBands(bandResult.data ?? []);
        setSessionId(loadedSessions.find((item) => item.is_active)?.id ?? "");
      } catch (loadError) {
        console.error("Unable to load result-entry setup:", loadError);
        if (active) setError("Could not load result-entry options. Check Academic Setup and try again.");
      } finally {
        if (active) setLoadingSetup(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setTerms([]);
    setTermId("");
    if (!sessionId) return;
    void supabase
      .from("academic_terms")
      .select("id, academic_session_id, name, term_number")
      .eq("academic_session_id", sessionId)
      .order("term_number")
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          console.error("Unable to load terms for result entry:", queryError);
          setError("Could not load terms for this session.");
          return;
        }
        const loadedTerms = data ?? [];
        setTerms(loadedTerms);
        setTermId(loadedTerms[0]?.id ?? "");
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    setAllocatedSubjectIds([]);
    if (!sessionId || !classId) {
      setLoadingSubjectAllocations(false);
      return;
    }
    setLoadingSubjectAllocations(true);
    void supabase
      .from("class_subjects")
      .select("subject_id")
      .eq("class_id", classId)
      .eq("academic_session_id", sessionId)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        setLoadingSubjectAllocations(false);
        if (queryError) {
          console.error("Unable to load class subject allocations:", queryError);
          setError("Could not load subjects allocated to this class.");
          return;
        }
        setAllocatedSubjectIds((data ?? []).map((allocation) => allocation.subject_id));
      });
    return () => {
      active = false;
    };
  }, [classId, sessionId]);

  useEffect(() => {
    let active = true;
    setExaminations([]);
    setExaminationId("");
    if (!termId || !classId) return;
    void supabase
      .from("examinations")
      .select("id, title, academic_term_id, class_id, subject_id, status")
      .eq("academic_term_id", termId)
      .order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          console.error("Unable to load examinations for result entry:", queryError);
          setError("Could not load examinations for this term.");
          return;
        }
        const loadedExaminations = (data ?? []).filter((examination) => !examination.class_id || examination.class_id === classId);
        setExaminations(loadedExaminations);
        setExaminationId(loadedExaminations[0]?.id ?? "");
      });
    return () => {
      active = false;
    };
  }, [classId, termId]);

  const loadComponents = async (examId: string, selectedSubject: string) => {
    const { data, error: queryError } = await supabase
      .from("examination_components")
      .select("id, name, maximum_score, display_order")
      .eq("examination_id", examId)
      .eq("subject_id", selectedSubject)
      .order("display_order")
      .order("created_at");
    if (queryError) throw queryError;
    setComponents(data ?? []);
    setComponentsFor(`${examId}:${selectedSubject}`);
  };

  useEffect(() => {
    let active = true;
    setComponents([]);
    setComponentsFor("");
    setMarks({});
    if (!examinationId || !selectedSubjectId) return;

    setLoadingComponents(true);
    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("examination_components")
          .select("id, name, maximum_score, display_order")
          .eq("examination_id", examinationId)
          .eq("subject_id", selectedSubjectId)
          .order("display_order")
          .order("created_at");
        if (!active) return;
        if (queryError) {
          console.error("Unable to load assessment components:", queryError);
          setError("Could not load assessment components.");
          return;
        }
        setComponents(data ?? []);
        setComponentsFor(`${examinationId}:${selectedSubjectId}`);
      } catch (loadError) {
        console.error("Unable to load assessment components:", loadError);
        if (active) setError("Could not load assessment components.");
      } finally {
        if (active) setLoadingComponents(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [examinationId, selectedSubjectId]);

  useEffect(() => {
    let active = true;
    setStudents([]);
    setMarks({});
    setPublished({});
    setLoadingStudents(false);
    setError("");
    if (!sessionId || !classId || !examinationId || !selectedSubjectId || componentsFor !== componentSelection || components.length === 0) return;

    void (async () => {
      setLoadingStudents(true);
      try {
        const { data: enrollments, error: enrollmentError } = await supabase
          .from("student_enrollments")
          .select("student_user_id")
          .eq("class_id", classId)
          .eq("academic_session_id", sessionId);
        if (enrollmentError) throw enrollmentError;

        const studentIds = (enrollments ?? []).map((enrollment) => enrollment.student_user_id);
        if (studentIds.length === 0) {
          if (active) setStudents([]);
          return;
        }

        const [profilesResult, studentProfilesResult, resultsResult] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", studentIds),
          supabase.from("student_profiles").select("user_id, student_number").in("user_id", studentIds),
          supabase
            .from("results")
            .select("id, student_user_id, score, is_published")
            .eq("examination_id", examinationId)
            .eq("subject_id", selectedSubjectId)
            .in("student_user_id", studentIds),
        ]);
        const queryError = profilesResult.error ?? studentProfilesResult.error ?? resultsResult.error;
        if (queryError) throw queryError;
        if (!active) return;

        const nameById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]));
        const numberById = new Map((studentProfilesResult.data ?? []).map((profile) => [profile.user_id, profile.student_number]));
        const resultRows = resultsResult.data ?? [];
        const resultIds = resultRows.map((result) => result.id);
        const componentMarksResult = resultIds.length
          ? await supabase.from("result_components")
            .select("result_id, examination_component_id, score")
            .in("result_id", resultIds)
          : { data: [], error: null };
        if (componentMarksResult.error) throw componentMarksResult.error;
        if (!active) return;
        const resultById = new Map(resultRows.map((result) => [result.id, result.student_user_id]));
        const loadedMarks: Record<string, Record<string, string>> = {};
        const loadedPublished: Record<string, boolean> = {};
        for (const result of resultRows) {
          loadedPublished[result.student_user_id] = result.is_published;
        }
        for (const componentMark of componentMarksResult.data ?? []) {
          if (!componentMark.examination_component_id) continue;
          const userId = resultById.get(componentMark.result_id);
          if (userId) {
            loadedMarks[userId] = {
              ...loadedMarks[userId],
              [componentMark.examination_component_id]: String(componentMark.score),
            };
          }
        }
        setStudents(studentIds
          .map((userId) => ({
            userId,
            fullName: nameById.get(userId) ?? "Name unavailable",
            studentNumber: numberById.get(userId) ?? "ID unavailable",
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName)));
        setMarks(loadedMarks);
        setPublished(loadedPublished);
      } catch (loadError) {
        console.error("Unable to load students and saved marks:", loadError);
        if (active) setError("Could not load enrolled students or saved marks.");
      } finally {
        if (active) setLoadingStudents(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [classId, components, componentsFor, componentSelection, examinationId, selectedSubjectId, sessionId]);

  const saveResults = async (publishResults: boolean) => {
    if (!session || !examinationId || !selectedSubjectId) {
      setError("Choose a session, term, class, examination, and subject first.");
      return;
    }
    if (publishResults) {
      for (const student of students) {
        for (const component of components) {
          const value = marks[student.userId]?.[component.id]?.trim() ?? "";
          if (value === "") {
            setError(`Enter every component mark for ${student.fullName} before publishing.`);
            return;
          }
          const score = Number(value);
          if (!Number.isFinite(score) || score < 0 || score > Number(component.maximum_score)) {
            setError(`Enter a mark from 0 to ${component.maximum_score} for ${student.fullName} (${component.name}).`);
            return;
          }
        }
      }
    } else {
      for (const student of students) {
        for (const component of components) {
          const value = marks[student.userId]?.[component.id]?.trim() ?? "";
          if (value === "") continue;
          const score = Number(value);
          if (!Number.isFinite(score) || score < 0 || score > Number(component.maximum_score)) {
            setError(`Enter a mark from 0 to ${component.maximum_score} for ${student.fullName} (${component.name}).`);
            return;
          }
        }
      }
    }
    if (students.length === 0) {
      setError("There are no enrolled students to save.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data: savedCount, error: saveError } = await supabase.rpc("save_class_results", {
        p_examination_id: examinationId,
        p_subject_id: selectedSubjectId,
        p_students: students.map((student) => ({
          student_user_id: student.userId,
          marks: marks[student.userId] ?? {},
        })),
        p_publish: publishResults,
      });
      if (saveError) throw saveError;
      setPublished((current) => {
        const next = { ...current };
        for (const student of students) next[student.userId] = publishResults;
        return next;
      });
      setNotice(publishResults
        ? `Published ${savedCount} class result${savedCount === 1 ? "" : "s"}.`
        : `Saved ${savedCount} class result${savedCount === 1 ? "" : "s"} as drafts. They are hidden from students until published.`);
      await loadComponents(examinationId, selectedSubjectId);
    } catch (saveError) {
      console.error("Unable to save examination results:", saveError);
      const details = saveError && typeof saveError === "object" && "message" in saveError && typeof saveError.message === "string"
        ? ` ${saveError.message}`
        : "";
      setError(`Could not save results.${details}`);
    } finally {
      setSaving(false);
    }
  };

  const setMark = (userId: string, componentId: string, value: string) => {
    setMarks((current) => ({
      ...current,
      [userId]: { ...current[userId], [componentId]: value },
    }));
    setNotice("");
  };

  const totalMaximum = components.reduce((total, component) => total + Number(component.maximum_score), 0);
  const totalScore = (userId: string) => {
    let hasEnteredMark = false;
    const enteredTotal = components.reduce((total, component) => {
      const value = marks[userId]?.[component.id]?.trim() ?? "";
      if (value === "") return total;
      hasEnteredMark = true;
      return total + Number(value);
    }, 0);
    return hasEnteredMark && totalMaximum > 0
      ? Number(((enteredTotal / totalMaximum) * 100).toFixed(2))
      : null;
  };

  return <>
    <section className="card bulk-entry">
      <div className="settings-form three-col result-entry-filters">
        <label>Academic session<select value={sessionId} onChange={(event) => { setSessionId(event.target.value); setSubjectId(""); }} disabled={loadingSetup}><option value="">Select session</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_active ? " (Active)" : ""}</option>)}</select></label>
        <label>Term<select value={termId} onChange={(event) => setTermId(event.target.value)} disabled={!sessionId}><option value="">Select term</option>{filteredTerms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Class<select value={classId} onChange={(event) => { setClassId(event.target.value); setSubjectId(""); }}><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Examination<select value={examinationId} onChange={(event) => setExaminationId(event.target.value)} disabled={!termId || !classId}><option value="">Select examination</option>{filteredExaminations.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}</select></label>
        <label>Subject<select value={selectedSubjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={!examinationId || loadingSubjectAllocations || Boolean(selectedExamination?.subject_id)}><option value="">Select subject</option>{availableSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      {!loadingSetup && sessions.length === 0 && <p className="login-error">Add an academic session in Academic Setup before entering results.</p>}
      {!loadingSetup && !selectedTerm && sessionId && <p className="directory-empty">Add a term under this session in Academic Setup.</p>}
      {!loadingSetup && filteredExaminations.length === 0 && termId && classId && <p className="directory-empty">No examination exists for this term yet. Create one in Academic Setup.</p>}
      {selectedSubject && selectedExamination?.subject_id && <p className="directory-empty">This examination is for {selectedSubject.name}.</p>}
      {error && <p className="login-error" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
      {componentSelection && <>
        <section className="result-components-setup">
          <div className="card-head"><div><h3>Assessment components</h3><p>Components and maximum scores configured for this examination and subject.</p></div></div>
          {loadingComponents ? <p className="directory-empty">Loading assessment components…</p> : components.length > 0 ? <div className="setup-chip-list">{components.map((component) => <span key={component.id}>{component.name} · / {component.maximum_score}</span>)}<b className="result-total-maximum">Total available: {totalMaximum}</b></div> : <p className="directory-empty">No assessment components are configured for this examination and subject. Review the examination setup before entering results.</p>}
        </section>
      </>}
      {loadingStudents ? <p className="directory-empty">Loading class register and saved marks…</p> : students.length > 0 ? <>
        <p className="result-entry-caption">{students.length} students · {selectedTerm?.name ?? "Term not selected"} · {selectedSubject?.name ?? "Subject not selected"} · totals normalized to 100</p>
        <div className="table-wrap"><table><thead><tr><th>Student</th><th>Student ID</th>{components.map((component) => <th key={component.id}>{component.name}<small className="result-column-maximum"> / {component.maximum_score}</small></th>)}<th>Total / 100</th><th>Grade</th><th>Status</th></tr></thead><tbody>
          {students.map((student) => {
            const total = totalScore(student.userId);
            const grade = total === null ? null : gradeBands.find(
              (band) => total >= Number(band.minimum_score) && total <= Number(band.maximum_score),
            )?.label ?? null;
            const enteredCount = components.filter((component) => (marks[student.userId]?.[component.id] ?? "").trim() !== "").length;
            return <tr key={student.userId}>
              <td>{student.fullName}</td><td>{student.studentNumber}</td>
              {components.map((component) => <td key={component.id}><input className="mark-input" type="number" min="0" max={component.maximum_score} step="0.01" value={marks[student.userId]?.[component.id] ?? ""} onChange={(event) => setMark(student.userId, component.id, event.target.value)} aria-label={`${component.name} mark for ${student.fullName}`} /></td>)}
              <td>{total === null ? "—" : `${total.toFixed(2)}%`}</td><td>{grade ?? "—"}</td>
              <td><span className={`badge ${published[student.userId] ? "success" : "warning"}`}>{published[student.userId] ? "Published" : enteredCount === components.length ? "Draft ready" : `${enteredCount}/${components.length} entered`}</span></td>
            </tr>;
          })}
        </tbody></table></div>
        {gradeBands.length === 0 && <p className="directory-empty">No grade bands are configured, so grades will remain blank until an admin sets them up.</p>}
        <div className="result-entry-actions"><button className="primary" type="button" disabled={saving || loadingStudents} onClick={() => void saveResults(false)}>{saving ? "Saving…" : "Save class draft"}</button><button className="primary" type="button" disabled={saving || loadingStudents} onClick={() => void saveResults(true)}>{saving ? "Publishing…" : "Publish class results"}</button></div>
      </> : !loadingSetup && examinationId && selectedSubjectId && componentsFor === componentSelection && components.length > 0 && !error ? <p className="directory-empty">No students are enrolled in this class for the selected session.</p> : !loadingSetup && !error && !componentSelection && <p className="directory-empty">Select a session, term, class, examination, and subject to load the class register.</p>}
    </section>
  </>;
}
