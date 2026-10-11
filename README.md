# Assessly — Online Examination Platform

Responsive Next.js App Router application with a Supabase-backed admin quiz workflow and candidate exam/submission flow.

## Supabase and deployment setup

1. In Supabase SQL Editor, run the complete supabase/schema.sql. It includes a backward-compatible legacy_id column used to keep imported EX-... share links working.
2. In Supabase Authentication, create the administrator user with email and password. Public sign-up is not enabled in the app.
3. Configure these environment variables in Vercel for Production (and Preview if needed): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. The two NEXT_PUBLIC values are safe for browser use; never expose SUPABASE_SECRET_KEY to client code.
4. Redeploy after setting variables. Open the site root, sign in using the Supabase Auth account, then manage quizzes. New quizzes are saved in PostgreSQL and receive UUID share links.
5. On the same browser that has old EX-... quizzes in local storage, signing in imports those quizzes and stores the old link as an alias. Copy a fresh UUID link from the Admin dashboard after import.

For local development, copy .env.example to .env.local, fill in the same values, then run npm install and npm run dev.

## Project structure

- src/app/page.tsx — authenticated admin dashboard, dynamic fields/questions builder, quiz list and CSV export.
- src/app/api/admin/quizzes/ — bearer-token-verified, owner-scoped quiz CRUD.
- src/app/exam/[quizId]/page.tsx — candidate registration, examination, answer review and completion.
- src/app/api/exam/[quizId]/route.ts — public active-exam payload without answer keys; accepts UUIDs and imported legacy aliases.
- src/app/api/submissions/route.ts — server-side validation, multiple-choice scoring, and persistence.
- src/app/api/question-image/route.ts — authenticated, size-limited question-image upload.
- supabase/schema.sql — PostgreSQL schema, indexes, RLS and storage policies.

Written responses are stored for manual grading. Keep RLS enabled and the service secret server-only. Add rate limiting/bot protection before a high-volume public launch.
