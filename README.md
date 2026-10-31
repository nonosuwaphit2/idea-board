# Idea Board

A minimal, responsive web application for sharing and voting on ideas, built with Next.js App Router and TypeScript. Target deployment: Vercel Hobby with Supabase PostgreSQL.

## Step 2: application foundation

Prerequisites: Node.js 22 or newer and npm. Node.js 24 is recommended.

```sh
npm ci
npm run dev
```

Open the development server on port 3000. The page displays live ideas and supports idea submission and voting through server-side API routes.

Validation:

```sh
npm run typecheck
npm run build
npm start
```

`npm start` serves the production build on port 3000. Stop the development server first or use a different port.

## Step 3: Supabase database

1. Open your **idea-board** project in the Supabase dashboard.
2. Select **SQL Editor**, then **New query**. Keep the default `postgres` role.
3. Copy the entire contents of `supabase/migrations/001_idea_board.sql`, paste them into the query, and click **Run**.
4. Expect success with no rows returned. Run this migration **once**; do not rerun it after success. If it fails, the transaction prevents partial installation. Save the exact error before making changes.
5. Open another **New query**, paste the entire contents of `supabase/verify.sql`, and click **Run**. This tests the anonymous role, submits a temporary idea, checks duplicate votes and counts, checks RLS and permissions, then rolls back all test data. Expect success with no rows returned and a PASS notice if the editor displays notices. Any failed assertion produces an error.
6. In **Table Editor**, confirm `ideas` and `votes` exist with RLS enabled. Both should remain empty after verification.

The schema stores a UUID, title (1–120 characters), description (1–2000 characters), author nickname (1–50 characters), and creation time for each idea. Inputs are trimmed on submission. Votes reference an existing idea; `(idea_id, voter_id)` is unique, including under concurrent requests. Counts are computed from votes rather than stored separately.

Anonymous visitors can read ideas and call only three application RPCs: `submit_idea`, `cast_vote`, and `list_ideas`. They cannot directly insert, update, or delete rows, or read voter identifiers. No `authenticated` role access is granted in this version. The security-definer RPCs intentionally bypass table RLS using fixed search paths and fully qualified tables; their public EXECUTE defaults are revoked. No service-role key is required for this design.

Without login, a voter ID identifies a browser, not a verified person. The database prevents duplicate votes **for the same ID**; it cannot prevent a visitor from creating another ID or calling the public voting RPC with it. The app keeps a browser identity in an HTTP-only cookie. This version does not provide authentication, strong abuse prevention, vote removal, editing, or deletion.

No Supabase password or key is needed in chat or in these SQL files. Never commit `.env.local`, database passwords, or secret keys. After verifying this step in your project, the next step is server-side Supabase integration. Environment-variable and Vercel deployment instructions will accompany that implementation.

## Step 4: server-side Supabase connection

1. In the Supabase project dashboard, find the **Project URL** in the **Connect** dialog or **Settings → Data API**. Copy the HTTPS project URL, not the PostgreSQL connection string.
2. Under **Settings → API Keys**, copy the **publishable** key (`sb_publishable_...`). Do not use a secret key, a service-role key, or the database password.
3. For local development, create `.env.local` (preserve any existing settings) with `SUPABASE_URL` set to your project URL and `SUPABASE_PUBLISHABLE_KEY` set to your full publishable key. Enter each as `NAME=value` on its own line. This file is ignored by Git. For the managed cloud environment, configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in environment settings instead. Use the same names in Vercel environment variables later. Never paste secret values into chat.
4. Restart the server so it loads the new variables: stop the current server, run `npm run dev`, and request `/api/health/supabase` on that server.
5. Expect HTTP 200 with `{"ok":true,"message":"Supabase connection verified."}`. This executes `list_ideas` with anonymous permissions, without returning any ideas or voter data. A 503 means configuration, database access, or network access still needs attention; it is not a verified connection. In a restricted cloud environment, allow your exact project hostname (`YOUR_PROJECT_REF.supabase.co`) in network settings.

The Supabase client lives in `lib/supabase/server.ts` and uses `server-only` to prevent imports into client components. These variables have no `NEXT_PUBLIC_` prefix. Requests do not persist auth sessions and are not cached. The health endpoint provides a read-only connection check. The board uses server-side routes for listing ideas, submissions, and votes. No service-role credentials are needed.


## Step 5: preview and test the interactive board

No new SQL or environment variables are needed. The page displays titles, descriptions, nicknames, and vote counts from `list_ideas`. Submission calls `submit_idea`; voting calls `cast_vote`. Supabase credentials remain in the server environment. Write routes validate inputs and require a matching browser Origin and request Host.

From `/workspace/idea-board`, start the development workflow:

```sh
npm ci
npm run dev
```

For this managed cloud environment, Node.js must use its configured HTTPS proxy:

```sh
NODE_USE_ENV_PROXY=1 npm run dev -- --port 3002
```

The cloud onboarding interface does not provide a browser preview. To preview in a browser, run locally with `.env.local` configured as described above, start `npm run dev`, and open your local development server on port 3000. Do not run a second server on an occupied port. A production preview can be run after building with `NODE_USE_ENV_PROXY=1 npm start -- --port 3002` in the cloud, or `npm start` locally. These commands do not deploy anything.

Manual verification (submissions and votes here write real data to your Supabase project):

1. Verify ideas load, or that the empty state invites the first idea.
2. Submit an idea with a title, description, and nickname. Expect a sharing indicator, success message, cleared form, and the new idea in the list.
3. Try a blank or whitespace-only field and inputs beyond the displayed limits. Invalid entries must not create ideas; server validation also enforces the limits.
4. Vote for the idea. Expect the count to increase once and the button to show **Voted**.
5. Reload, then vote for that same idea again. Expect **You’ve already voted for this idea**, without an additional vote. The database constraint is authoritative, even when the page’s local voted state resets.
6. Use a narrow browser window to check the stacked form and cards. Check keyboard focus and submission using the keyboard.
7. To check error handling, use the browser developer tools to block `/api/ideas` and press **Refresh**. Expect an error and retry control. Unblock it and retry. Failed submissions preserve the form content. After an interrupted submission, refresh before retrying because the first request might have completed.

Voting uses a one-year HTTP-only, SameSite cookie named `idea_board_voter` (Secure on HTTPS). Browser cookies must be enabled. Votes are deduplicated per browser identity, not per verified person; clearing cookies or using another browser creates a different identity. There is no authentication or strong spam prevention. Vote confirmation is shown per card for the current page session; database checks handle duplicates after reload. Loading failures keep existing ideas visible and display an error. Use Refresh to retrieve updates from other visitors.

Automated checks:

```sh
npm run build
npm run typecheck
npm run test:integration
```

Run the integration checks after a successful build, with port 3102 free. They start a local application and fake Supabase HTTP service and check submission, field validation, origin restrictions, persistent voter cookies, duplicate votes, missing ideas, counts, and safe upstream errors. They never write to the live database and do not replace manual browser verification. Live read-only checks are available at `/api/health/supabase` and `/api/ideas`. Do not deploy until the interactive workflow is verified.


## Vercel Hobby deployment (when approved)

1. Review and merge the application pull request on GitHub.
2. In Vercel, choose **Add New → Project** and import `nonosuwaphit2/idea-board`. Select Next.js, repository root directory, the Hobby plan, and Node.js 24.x. Keep the default build settings.
3. Before deploying, add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` under the project's environment variables for Production (and Preview if you intend to use preview deployments). Use only your project URL and publishable key; no service-role key is needed. Never add these values to GitHub source files.
4. When ready, click **Deploy**. Do not set the cloud-specific `NODE_USE_ENV_PROXY` on Vercel. Cloud environment settings are not automatically copied to Vercel.
5. On the deployed site, verify `/api/health/supabase` returns HTTP 200, then submit an idea and test voting and a duplicate vote after reload. Vercel's Git integration normally deploys subsequent pushes automatically; use a separate Supabase project for previews if test data must stay separate.

These are future deployment instructions only; preparing or pushing this repository does not itself create a Vercel project.
