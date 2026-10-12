"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Expand, Minimize2, MonitorPlay } from "lucide-react";
import "../projector.css";

type Option = { id: string; option_text: string };
type Question = { id: string; question_text: string; image_url: string | null; question_type: "multiple_choice" | "written"; points: number; options: Option[] };
type Quiz = { id: string; title: string; description: string; time_limit_minutes: number | null; questions: Question[] };

export default function ProjectorPage() { return <Suspense fallback={<main className="projector-screen"><section className="projector-message">กำลังเปิดโหมดนำเสนอ…</section></main>}><ProjectorContent/></Suspense>; }

function ProjectorContent() {
  const { quizId } = useParams<{ quizId: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [index, setIndex] = useState(-1);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const move = useCallback((step: number) => setIndex((current) => Math.max(-1, Math.min(quiz?.questions.length ?? 0, current + step))), [quiz]);

  useEffect(() => { fetch(`/api/exam/${quizId}`).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "เปิดข้อสอบไม่ได้"); setQuiz(payload.quiz); }).catch((cause) => setError(cause instanceof Error ? cause.message : "เปิดข้อสอบไม่ได้")); }, [quizId]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "ArrowRight" || event.key === "PageDown") move(1); else if (event.key === "ArrowLeft" || event.key === "PageUp") move(-1); else if (event.key.toLowerCase() === "f") void document.documentElement.requestFullscreen?.(); else if (event.key === "Escape" && document.fullscreenElement) void document.exitFullscreen?.(); }; const onFull = () => setFullscreen(Boolean(document.fullscreenElement)); window.addEventListener("keydown", onKey); document.addEventListener("fullscreenchange", onFull); return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFull); }; }, [move]);

  async function toggleFullscreen() { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen?.(); }
  const question = quiz && index >= 0 ? quiz.questions[index] : null;
  return <main className="projector-screen"><header className="projector-toolbar"><a href="/" className="projector-back"><ArrowLeft size={17}/><span>แอดมิน</span></a><div className="projector-toolbar-title"><MonitorPlay size={17}/><span>โหมดนำเสนอ</span></div><button className="projector-fullscreen" onClick={toggleFullscreen}>{fullscreen ? <Minimize2 size={16}/> : <Expand size={16}/>}<span>{fullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"}</span></button></header>
    {error ? <section className="projector-message"><h1>ไม่สามารถเปิดข้อสอบนี้</h1><p>{error}</p></section> : !quiz ? <section className="projector-message">กำลังโหลดข้อสอบ…</section> : <>
      <section className="projector-slide" aria-live="polite">{index < 0 ? <div className="projector-cover"><div className="projector-logo"><MonitorPlay size={22}/> ASSESSLY</div><p className="projector-eyebrow">ONLINE ASSESSMENT</p><h1>{quiz.title}</h1><p className="projector-description">{quiz.description || "เตรียมตัวให้พร้อม แล้วเริ่มทำข้อสอบได้เลย"}</p><div className="projector-meta"><span>{quiz.questions.length} คำถาม</span>{quiz.time_limit_minutes && <span>{quiz.time_limit_minutes} นาที</span>}</div><button className="projector-start" onClick={() => setIndex(0)}>เริ่มนำเสนอ <ArrowRight size={19}/></button></div> : question ? <div className="projector-question"><div className="projector-question-meta"><span>คำถาม {index + 1} / {quiz.questions.length}</span><span>{question.points} คะแนน</span></div><h1>{question.question_text}</h1>{question.image_url && <img className="projector-image" src={question.image_url} alt="ภาพประกอบคำถาม"/>}{question.question_type === "multiple_choice" ? <div className="projector-options">{question.options.map((option, optionIndex) => <div className="projector-option" key={option.id}><span>{String.fromCharCode(65 + optionIndex)}</span><p>{option.option_text}</p></div>)}</div> : <div className="projector-written">คำถามอัตนัย · ให้นักเรียนเขียนคำตอบในอุปกรณ์ของตนเอง</div>}</div> : <div className="projector-cover projector-finish"><div className="projector-logo"><MonitorPlay size={22}/> ASSESSLY</div><p className="projector-eyebrow">เสร็จสิ้น</p><h1>ครบทุกคำถามแล้ว</h1><p className="projector-description">ผู้เข้าสอบสามารถส่งคำตอบได้จากอุปกรณ์ของตนเอง</p><button className="projector-start" onClick={() => setIndex(-1)}>กลับหน้าแรก <ArrowLeft size={18}/></button></div>}</section>
      <footer className="projector-controls"><button disabled={index <= -1} onClick={() => move(-1)}><ArrowLeft size={18}/><span>ก่อนหน้า</span></button><div className="projector-dots">{quiz.questions.map((item, dotIndex) => <button key={item.id} aria-label={`ไปคำถาม ${dotIndex + 1}`} aria-current={dotIndex === index} className={dotIndex === index ? "active" : ""} onClick={() => setIndex(dotIndex)}/>)}</div><button disabled={index >= quiz.questions.length} onClick={() => move(1)}><span>{index === -1 ? "เริ่ม" : index === quiz.questions.length - 1 ? "จบ" : "ถัดไป"}</span><ArrowRight size={18}/></button></footer>
      <p className="projector-shortcuts">ใช้ปุ่ม ← → เพื่อเปลี่ยนคำถาม · กด F เพื่อเต็มจอ</p>
    </>}
  </main>;
}
