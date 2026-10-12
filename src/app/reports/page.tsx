"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpDown, Check, ChevronDown, Download, LoaderCircle, RefreshCw, Save } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Option = { id: string; option_text: string; is_correct: boolean };
type Question = { id: string; question_text: string; question_type: "multiple_choice" | "written"; points: number; options: Option[] };
type Quiz = { id: string; title: string; questions: Question[] };
type Answer = { id: string; question_id: string; selected_option_id: string | null; written_answer: string | null; score_awarded: number };
type Submission = { id: string; quiz_id: string; participant_data: Record<string, unknown>; total_score: number; submitted_at: string; answers: Answer[] };
type ReportData = { quizzes: Quiz[]; submissions: Submission[] };

function candidateName(submission: Submission) {
  const data = submission.participant_data ?? {};
  const nameEntry = Object.entries(data).find(([key, value]) => /name|ชื่อ/i.test(key) && typeof value === "string" && value.trim());
  return nameEntry?.[1] as string | undefined ?? Object.values(data).find((value) => typeof value === "string" && value.trim()) as string | undefined ?? "Candidate";
}

function escapeCsv(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export default function ReportsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<ReportData>({ quizzes: [], submissions: [] });
  const [quizId, setQuizId] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sortAscending, setSortAscending] = useState(false);

  const load = useCallback(async (token: string, selectedQuiz?: string) => {
    setLoading(true); setError("");
    try {
      const suffix = selectedQuiz ? `?quizId=${encodeURIComponent(selectedQuiz)}` : "";
      const response = await fetch(`/api/admin/reports${suffix}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load reports.");
      setData(payload); setQuizId(payload.quizzes[0]?.id ?? ""); setQuestionId(payload.quizzes[0]?.questions[0]?.id ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load reports."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let alive = true;
    void supabaseBrowser().then(async (client) => {
      const { data: authData } = await client.auth.getSession();
      if (!alive) return;
      setSession(authData.session);
      if (authData.session) await load(authData.session.access_token, new URLSearchParams(window.location.search).get("quizId") ?? undefined);
      else { setError("กรุณาเข้าสู่ระบบแอดมินก่อนดูรายงาน"); setLoading(false); }
    }).catch((cause) => { if (alive) { setError(cause instanceof Error ? cause.message : "Unable to connect."); setLoading(false); } });
    return () => { alive = false; };
  }, [load]);

  const quiz = data.quizzes.find((item) => item.id === quizId);
  const question = quiz?.questions.find((item) => item.id === questionId);
  const submissions = data.submissions.filter((item) => item.quiz_id === quizId);
  const ranked = useMemo(() => [...submissions].sort((a, b) => (Number(a.total_score) - Number(b.total_score)) * (sortAscending ? 1 : -1)), [submissions, sortAscending]);
  const questionResponses = submissions.flatMap((submission) => {
    const answer = submission.answers?.find((item) => item.question_id === questionId);
    return answer ? [{ submission, answer }] : [];
  });
  const correctOption = question?.options?.find((option) => option.is_correct);
  const totalPoints = (quiz?.questions ?? []).reduce((sum, item) => sum + Number(item.points), 0);
  const average = submissions.length ? submissions.reduce((sum, item) => sum + Number(item.total_score), 0) / submissions.length : 0;

  async function saveScore(submission: Submission, answer: Answer, score: number) {
    if (!session) return;
    setSaving(answer.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/reports", { method: "PATCH", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ submissionId: submission.id, answerId: answer.id, scoreAwarded: score }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save score.");
      setData((current) => ({ ...current, submissions: current.submissions.map((item) => item.id === submission.id ? { ...item, total_score: payload.totalScore, answers: item.answers.map((row) => row.id === answer.id ? { ...row, score_awarded: score } : row) } : item) }));
      setNotice(`บันทึกคะแนนของ ${candidateName(submission)} แล้ว`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save score."); }
    finally { setSaving(null); }
  }

  function exportCsv() {
    const rows = [["Rank", "Candidate", "Quiz", "Score", "Submitted"], ...ranked.map((item, index) => [index + 1, candidateName(item), quiz?.title ?? "", item.total_score, new Date(item.submitted_at).toLocaleString()])];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${quiz?.title ?? "exam"}-results.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><Link href="/" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="กลับหน้าแอดมิน"><ArrowLeft size={19}/></Link><div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800">Assessly · Admin</p><h1 className="text-lg font-bold sm:text-xl">รายงานผลสอบ</h1></div></div><div className="flex items-center gap-2"><button onClick={() => session && load(session.access_token, quizId)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"><RefreshCw size={15}/> <span className="hidden sm:inline">รีเฟรช</span></button><button disabled={!submissions.length} onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"><Download size={15}/> CSV</button></div></div></header>
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {loading ? <div className="flex min-h-64 items-center justify-center gap-3 text-slate-500"><LoaderCircle className="animate-spin"/>กำลังโหลดรายงาน…</div> : data.quizzes.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-bold">ยังไม่มีข้อสอบ</h2><p className="mt-2 text-sm text-slate-500">สร้างข้อสอบและรับคำตอบก่อน แล้วรายงานจะแสดงที่นี่</p></div> : <>
        <div className="grid gap-4 sm:grid-cols-3"><Metric label="ผู้เข้าสอบ" value={String(submissions.length)} hint="รายการส่งข้อสอบ"/><Metric label="คะแนนเฉลี่ย" value={`${average.toFixed(2)} / ${totalPoints}`} hint="คะแนนรวมเฉลี่ย"/><Metric label="จำนวนข้อ" value={String(quiz?.questions.length ?? 0)} hint="ข้อในแบบทดสอบ"/></div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><label className="space-y-2 text-sm font-semibold">ข้อสอบชุดนี้<span className="relative block"><select disabled={data.quizzes.length < 2} value={quizId} onChange={(event) => { const next = event.target.value; setQuizId(next); setQuestionId(data.quizzes.find((item) => item.id === next)?.questions[0]?.id ?? ""); }} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 outline-none focus:border-emerald-700 disabled:cursor-default disabled:bg-slate-50">{data.quizzes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>{data.quizzes.length > 1 && <ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-slate-400" size={18}/>}</span><span className="block text-xs font-normal text-slate-400">รายงานนี้แสดงข้อมูลเฉพาะข้อสอบชุดที่เลือก</span></label><label className="space-y-2 text-sm font-semibold">เลือกข้อคำถาม<span className="relative block"><select value={questionId} onChange={(event) => setQuestionId(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 outline-none focus:border-emerald-700">{quiz?.questions.map((item, index) => <option key={item.id} value={item.id}>ข้อ {index + 1} · {item.question_text.slice(0, 80)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-slate-400" size={18}/></span></label></div>
        {question ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-700">{question.question_type === "multiple_choice" ? "ปรนัย" : "อัตนัย"} · {question.points} คะแนน</p><h2 className="mt-2 text-lg font-bold">{question.question_text}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">ตอบแล้ว {questionResponses.length} / {submissions.length}</span></div>{correctOption && <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><Check size={16}/>คำตอบที่ถูก: {correctOption.option_text}</p>}</div>
          {questionResponses.length ? <div className="divide-y divide-slate-100">{questionResponses.map(({ submission, answer }) => { const selected = question.options?.find((option) => option.id === answer.selected_option_id); const isCorrect = question.question_type === "multiple_choice" && Boolean(selected?.is_correct); const score = Number(answer.score_awarded ?? 0); return <article key={answer.id} className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{candidateName(submission)}</h3><span className="text-xs text-slate-400">{new Date(submission.submitted_at).toLocaleString()}</span>{question.question_type === "multiple_choice" && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>{isCorrect ? "ถูก" : "ผิด"}</span>}</div><div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{question.question_type === "multiple_choice" ? selected?.option_text ?? <span className="italic text-slate-400">ไม่ได้เลือกคำตอบ</span> : answer.written_answer || <span className="italic text-slate-400">ไม่ได้ตอบ</span>}</div>{Object.keys(submission.participant_data ?? {}).length > 0 && <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">ข้อมูลผู้เข้าสอบ</summary><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{Object.entries(submission.participant_data).map(([key, value]) => <span key={key}><b>{key}:</b> {String(value)}</span>)}</div></details>}</div><div className="flex items-end gap-2 sm:min-w-48 sm:justify-end"><label className="text-xs font-semibold text-slate-500">คะแนน / {question.points}<input aria-label={`คะแนน ${candidateName(submission)}`} type="number" min="0" max={question.points} step="0.01" defaultValue={score} id={`score-${answer.id}`} className="mt-1 w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-700"/></label><button disabled={saving === answer.id} onClick={() => { const input = document.getElementById(`score-${answer.id}`) as HTMLInputElement | null; if (input) void saveScore(submission, answer, Number(input.value)); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{saving === answer.id ? <LoaderCircle className="animate-spin" size={15}/> : <Save size={15}/>}บันทึก</button></div></article>; })}</div> : <p className="p-8 text-center text-sm text-slate-500">ยังไม่มีคำตอบสำหรับข้อนี้</p>}</section> : <div className="rounded-xl bg-white p-8 text-center text-slate-500">ข้อสอบนี้ยังไม่มีคำถาม</div>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold">อันดับคะแนน</h2><p className="mt-1 text-sm text-slate-500">คะแนนรวมเรียงจากมากไปน้อย</p></div><button onClick={() => setSortAscending((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"><ArrowUpDown size={15}/>{sortAscending ? "น้อยไปมาก" : "มากไปน้อย"}</button></div>{ranked.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">อันดับ</th><th className="px-5 py-3">ผู้เข้าสอบ</th><th className="px-5 py-3">คะแนน</th><th className="px-5 py-3">ส่งเมื่อ</th></tr></thead><tbody className="divide-y divide-slate-100">{ranked.map((item, index) => <tr key={item.id}><td className="px-5 py-3 font-bold text-emerald-800">#{index + 1}</td><td className="px-5 py-3 font-semibold">{candidateName(item)}</td><td className="px-5 py-3">{Number(item.total_score).toFixed(2)} / {totalPoints}</td><td className="px-5 py-3 text-slate-500">{new Date(item.submitted_at).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">ยังไม่มีผู้ส่งข้อสอบ</p>}</section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-bold">รายละเอียดคำตอบรายคน</h2><p className="mt-1 text-sm text-slate-500">เปิดชื่อผู้เข้าสอบเพื่อดูข้อมูลและคำตอบครบทุกข้อในชุดนี้</p></div>{ranked.length ? <div className="divide-y divide-slate-100">{ranked.map((submission, index) => <details key={submission.id} className="group"><summary className="grid cursor-pointer list-none grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 hover:bg-slate-50 sm:grid-cols-[50px_minmax(0,1fr)_minmax(130px,auto)_minmax(160px,auto)]"><span className="font-bold text-emerald-800">#{index + 1}</span><span className="min-w-0"><b className="block truncate text-sm">{candidateName(submission)}</b><small className="text-slate-400">{Object.entries(submission.participant_data ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</small></span><b className="text-sm">{Number(submission.total_score).toFixed(2)} / {totalPoints}</b><time className="hidden text-xs text-slate-500 sm:block">{new Date(submission.submitted_at).toLocaleString()}</time></summary><div className="space-y-3 bg-slate-50/70 px-5 py-4 sm:px-8">{(quiz?.questions ?? []).map((item, questionIndex) => { const answer = submission.answers?.find((row) => row.question_id === item.id); const option = item.options?.find((row) => row.id === answer?.selected_option_id); const expected = item.options?.find((row) => row.is_correct); const correct = item.question_type === "multiple_choice" && Boolean(option?.is_correct); return <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">ข้อ {questionIndex + 1} · {item.question_text}</h3><span className="text-xs font-semibold text-slate-500">{Number(answer?.score_awarded ?? 0)} / {item.points} คะแนน</span></div><p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.question_type === "multiple_choice" ? option?.option_text ?? "ไม่ได้เลือกคำตอบ" : answer?.written_answer ?? "ไม่ได้ตอบ"}</p>{item.question_type === "multiple_choice" && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2.5 py-1 font-bold ${correct ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>{correct ? "ตอบถูก" : "ตอบผิด"}</span><span className="text-slate-500">เฉลย: {expected?.option_text ?? "ยังไม่กำหนด"}</span></div>}</article>; })}</div></details>)}</div> : <p className="p-8 text-center text-sm text-slate-500">ยังไม่มีผู้ส่งข้อสอบในชุดนี้</p>}</section>
      </>}
    </section>
  </main>;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-400">{hint}</p></div>; }
