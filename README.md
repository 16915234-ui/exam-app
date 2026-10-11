# Assessly — Online Examination Platform

A responsive Next.js App Router interface for assessment administration and candidate exams. Includes quiz management UI, candidate registration and answer flow, CSV export, Supabase submission endpoints, and a normalized Postgres schema with RLS.

## Run locally

1. npm install
2. Copy .env.example to .env.local and set the Supabase project URL, anon key, and service role key.
3. Run supabase/schema.sql in the Supabase SQL Editor.
4. Create an admin through Supabase Auth. Create quizzes/questions in the database (the dashboard currently uses local browser storage as its interactive starter data source).
5. npm run dev

The service role key must remain server-only. Candidate API responses intentionally omit options.is_correct. Keep RLS enabled and never expose the service role key to browser code.

## Structure

- src/app/page.tsx — responsive admin dashboard, quiz CRUD starter, question and participant-field builder, submission view and CSV export.
- src/app/exam/[quizId]/page.tsx — dynamic candidate registration, exam, answer review and completion.
- src/app/api/exam/[quizId]/route.ts — public active-exam payload without answer keys.
- src/app/api/submissions/route.ts — server-side validation, automatic multiple-choice scoring, and submission persistence.
- src/lib-supabase.ts — server-only Supabase service client.
- supabase/schema.sql — schema, indexes, RLS and question-image bucket policies.

For admin production use, connect the quiz builder to Supabase Auth and owner-scoped server actions; enforce admin authorization for quiz writes and add rate limiting / bot protection to public submission endpoints.

- src/app/api/question-image/route.ts — authenticated, size-limited question-image uploads to Supabase Storage.
