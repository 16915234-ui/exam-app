import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: "Sign in with your admin account to continue." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const quizId = searchParams.get("quizId");
  const { data: quizzes, error: quizError } = await auth.db
    .from("quizzes")
    .select("id,title,questions(id,question_text,question_type,points,order_index,options(id,option_text,is_correct,order_index))")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (quizError) return NextResponse.json({ error: quizError.message }, { status: 500 });

  const owned = (quizzes ?? []).filter((quiz: any) => !quizId || quiz.id === quizId);
  if (quizId && !owned.length) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  if (!owned.length) return NextResponse.json({ quizzes: [], submissions: [] });

  const { data: submissions, error: submissionError } = await auth.db
    .from("submissions")
    .select("id,quiz_id,participant_data,total_score,submitted_at,answers(id,question_id,selected_option_id,written_answer,score_awarded)")
    .in("quiz_id", owned.map((quiz: any) => quiz.id));
  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 500 });

  return NextResponse.json({
    quizzes: owned.map((quiz: any) => ({ ...quiz, questions: (quiz.questions ?? []).sort((a: any, b: any) => a.order_index - b.order_index) })),
    submissions: submissions ?? [],
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: "Sign in with your admin account to continue." }, { status: 401 });
  try {
    const { submissionId, answerId, scoreAwarded } = await request.json();
    const score = Number(scoreAwarded);
    if (!submissionId || !answerId || !Number.isFinite(score) || score < 0) {
      return NextResponse.json({ error: "A valid submission, answer, and non-negative score are required." }, { status: 400 });
    }
    const { data: submission, error: submissionError } = await auth.db.from("submissions").select("id,quiz_id").eq("id", submissionId).single();
    if (submissionError || !submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    const { data: quiz } = await auth.db.from("quizzes").select("id").eq("id", submission.quiz_id).eq("user_id", auth.user.id).single();
    if (!quiz) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    const { data: answer, error: answerError } = await auth.db.from("answers").select("id,question_id").eq("id", answerId).eq("submission_id", submissionId).single();
    if (answerError || !answer) return NextResponse.json({ error: "Answer not found." }, { status: 404 });
    const { data: question, error: questionError } = await auth.db.from("questions").select("points").eq("id", answer.question_id).eq("quiz_id", submission.quiz_id).single();
    if (questionError || !question) return NextResponse.json({ error: "Question not found." }, { status: 404 });
    if (score > Number(question.points)) return NextResponse.json({ error: `Score cannot exceed ${question.points} points.` }, { status: 400 });

    const { error: updateError } = await auth.db.from("answers").update({ score_awarded: score }).eq("id", answerId);
    if (updateError) throw updateError;
    const { data: answers, error: answersError } = await auth.db.from("answers").select("score_awarded").eq("submission_id", submissionId);
    if (answersError) throw answersError;
    const total = (answers ?? []).reduce((sum: number, row: any) => sum + Number(row.score_awarded ?? 0), 0);
    const { error: totalError } = await auth.db.from("submissions").update({ total_score: total }).eq("id", submissionId);
    if (totalError) throw totalError;
    return NextResponse.json({ totalScore: total });
  } catch (error) {
    console.error("Admin grading update failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save score." }, { status: 500 });
  }
}
