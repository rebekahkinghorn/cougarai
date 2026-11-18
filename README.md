export SUPABASE_SERVICE_ROLE_KEYread -s 'GEMINI_API_KEY?Paste the actual Gemini API key: '

# CougarAI

## App Summary

There isn’t a clear process for freshmen incoming to BYU to find all the information in one place
on the BYU website. Many times, they need to click one link, redirect to another site, refer to
another, and only then have they completed one step of their freshman checklist. Why is
information vague and not all in the same place where everybody can access what they need in
the most efficient way possible? This is a problem for not only freshman coming straight out of
high school, but also for current missionaries trying to prepare with limited time and resources.

This is the problem that our app solves. CougarAI has a built-in chatbot that answers questions using a curated set of public BYU information and the current conversation. Its source collection can grow as the team reviews and adds more BYU pages. It also includes a FAQ page for freshmen who don't know where to start in their preparation, which is generated based on questions other users are asking the chatbot.

The FAQ page lets students browse common questions by topic, search by keyword, expand an answer, or continue to the chatbot if they need help with a question that is not covered. FAQ drafts are created from valid chatbot question-and-answer pairs from the previous 30 days: the existing `dynamic-function` Edge Function uses Gemini to group recurring questions, compare them with published FAQs and prior suggestions, and save new drafts to `faq_suggestions`. An administrator can run this process from the **Approvals & Reports** page, review each pending draft, choose an existing category or propose a new one, and approve or reject it. Approval publishes the reviewed question and answer through the `approve_faq_suggestion` database function; questions already covered by published FAQs are tracked separately instead of being added as duplicate drafts.

We also realize that BYU freshman struggle not only with figuring out the academic side of BYU, but the social side as well. For this purpose our app also has a calendar page which will include events happening on and off campus. Users will be able to filter this calendar to show them events that they are most interested in.

## Tech Stack

Front end: HTML, CSS, Javascript
Database, Backend & Authentication: Supabase
AI app builder: CODEX

## Recent Work (November 9–17, 2026)

### November 9 — Chat persistence and history

- Fixed the chatbot request so a signed-in user's Supabase access token is sent to the `chatbot` Edge Function. The earlier diagnostic showed the function was treating the request as unauthenticated; after the fix, the user ID was available and saved conversations appeared in history.
- Chat conversations are listed from `chat_conversations`; selecting one loads its messages from `chat_messages`. The active conversation ID is kept in session storage so the chat can resume after navigating away and returning in the same tab.
- Starting a new chat clears the visible conversation and starts the next submitted prompt without the previous conversation ID. A conversation is saved when the first message is sent.
- Signed-in users can sign back in with email and password. The header restores the signed-in greeting and sign-out action from the Supabase session.

### November 10 — Admin metrics sign-in

- Reused the site's shared sign-in form for the admin pages. The Metrics and Approvals & Reports links appear only for accounts with trusted `app_metadata.role = admin`; direct visits to either page prompt for sign-in and keep the admin content hidden unless the account has that role.
- Admin status must be assigned to the approved Supabase Auth account by a trusted administrator using the Auth Admin API or dashboard `app_metadata`; users cannot grant themselves access. The login checks the trusted `app_metadata.role` claim, never editable `user_metadata`.
- The page gate controls the dashboard UI, and the `admin-metrics` Edge Function independently verifies the signed-in user's trusted `app_metadata.role` before returning project-wide aggregate results. It reads only the two summary views with the server-side service-role key; that key is never sent to the browser.
- The admin **Approvals & Reports** page includes a **Generate FAQ drafts** button that runs the existing `dynamic-function`. It analyzes valid chatbot question-and-answer pairs from the last 30 days with Gemini, compares suggestions against published FAQs and existing suggestions, and saves new drafts to `faq_suggestions` for review. Admins can assign or create a category, approve or reject each draft, and see questions already covered by an existing FAQ. The calendar suggestion form writes pending submissions to `User_Submitted_Events`; the admin-only `admin-event-submissions` Edge Function lists those submissions and, on approval, copies the event into `Event` and marks the submission published. Approved event display on the calendar is a separate task. FAQ approval publishes through the `approve_faq_suggestion` database function.

#### Deploying `admin-issue-reports`

The **Approvals & Reports** page reads submitted issue descriptions, their status, and the submitter's user ID through this Edge Function. It verifies the signed-in user's trusted admin role before using the server-side service-role key to read or update `issue_report`; never put that key in browser code.

Before deploying the updated function, run the SQL in both `supabase/migrations/20261116000100_issue_report_resolution.sql` and `supabase/migrations/20261116000200_issue_report_submitted_at.sql` in the Supabase SQL Editor. They add the stable report ID, resolution timestamp and comment, and submission timestamp to `issue_report`. The submission migration backfills from an existing timestamp column when one is available and sets a default for new reports.

From the repository root, deploy it with:

```sh
npx supabase functions deploy admin-issue-reports --project-ref xyyhccpivxxgiatptwko
```

On the **Approvals & Reports** page, open reports appear under **Open reports**, including their submission date and time. Select **Mark as resolved**, optionally add a resolution comment, and confirm. The report moves to **Resolved**, where admins can see the comment and the saved resolution date/time. Refresh the page to confirm the status and resolution details persist.

### November 10 — Shared layout and metrics dashboard

- Replaced repeated page headers and footers on the main pages with `partials/header.html` and `partials/footer.html`, loaded by `layout.js`. The shared navigation includes a link to `metrics.html`.
- Fixed a duplicated block and unmatched `catch` in `app.js` that caused a JavaScript syntax error and prevented that script from running.
- Added a styled metrics dashboard with live tables for `chatbot_answer_validity_summary` and `chat_feedback_summary`, plus one **Refresh all metrics** button.

### November 16 — BYU information retrieval for the chatbot

- Added a retrieval-augmented generation (RAG) knowledge base. The `chatbot` Edge Function embeds the user's question with Gemini, searches relevant BYU passages in Supabase using pgvector, and gives those passages to Gemini alongside the current conversation history.
- Answers that cite retrieved material include links to the BYU pages. If the retrieved passages do not support an answer, the chatbot says it could not find enough information instead of presenting an unsupported answer as verified.
- The curated sources are listed in `supabase/knowledge/byu_sources.json`. The current 82-entry collection covers admissions, housing, financial aid, tuition, registration, deadlines, student resources, BYU history and leadership, events, academic departments, campus dining, and meal plans. This is a reviewed collection, not a crawl of every BYU website.
- `scripts/ingest_byu_sources.mjs` fetches those HTTPS pages, checks their robots.txt rules, extracts and chunks page text, creates Gemini embeddings, and upserts the results into Supabase. It skips unchanged chunks on later runs. The script accepts only `byu.edu` and its subdomains, reports pages disallowed by robots.txt, and exits with an error if a fetch or ingestion fails.

#### Set up and deploy the BYU knowledge base

1. Apply `supabase/migrations/20261116000300_byu_knowledge_base.sql` in the Supabase SQL Editor. This creates the vector table and a service-role-only similarity-search function. The browser cannot read the knowledge table directly.
2. Confirm the chatbot's Gemini secret is set in **Supabase Dashboard → Edge Functions → Secrets**. The secret name must be exactly `gemini_api_key`; the value is the actual Gemini API key. The dashboard will not reveal a saved secret value ([Supabase secrets guide](https://supabase.com/docs/guides/functions/secrets)). If the original key is unavailable, create a key in the team's [Google AI Studio project](https://aistudio.google.com/app/apikey), then set that value as `gemini_api_key`. Supabase makes changed function secrets available without redeploying.
3. From the repository root, sign the Supabase CLI in once:

   ```sh
   npx supabase login
   ```

   Use a Supabase **personal access token** from [Account → Access Tokens](https://supabase.com/dashboard/account/tokens) if prompted. This is only for the CLI to manage the project; it is different from the user's login token, the project API key, and the service-role key. The CLI stores it in your computer's credential storage. [Supabase CLI login guide](https://supabase.com/docs/reference/cli/supabase-login)
4. Deploy the updated function from the repository root:

   ```sh
   npx supabase functions deploy chatbot --project-ref xyyhccpivxxgiatptwko
   ```

   If the CLI asks **“Deploy 1 Function on project …?”**, check that the project reference is `xyyhccpivxxgiatptwko`, then confirm. This deploys the function code; it does not apply the SQL migration or load the BYU pages.
5. In a trusted local terminal at the repository root, set the environment variables for the ingestion script. It reads them from the current shell process; it does not read a `.env` file. They last only for that terminal session. Use the following in macOS zsh, entering each command separately:

   - Set the project URL. It is also shown in `auth.js`:

     ```sh
     export SUPABASE_URL='https://xyyhccpivxxgiatptwko.supabase.co'
     ```
   - Find the legacy `service_role` key in **Supabase Dashboard → Project Settings → API Keys → Legacy API Keys**. This version of the ingestion script expects that legacy key (a long JWT, often beginning with `eyJ`), not the `sb_publishable_...` key, an `sb_secret_...` key, the CLI personal access token, or a user's login token. It bypasses row-level security, so never put it in browser code, source control, or a checked-in file.

     Type this command and press Enter. When the prompt appears, paste the key and press Enter; the key will not display. Then run the `export` command at the next shell prompt:

     ```sh
     read -s 'SUPABASE_SERVICE_ROLE_KEY?Paste the legacy service_role key: '
     ```

     ```sh
     export SUPABASE_SERVICE_ROLE_KEY
     ```
   - Get the actual Gemini API key from the team's Google AI Studio project ([key guide](https://ai.google.dev/gemini-api/docs/api-key)). It may be the same key used by the deployed chatbot or another valid key for the team's project. If you use a new key and want the chatbot to use it too, update the Supabase secret `gemini_api_key` as described above. The secret's name alone is not the key value.

     Enter the prompt command by itself, paste the actual Gemini key when prompted, and press Enter. Then export it at the next shell prompt:

     ```sh
     read -s 'GEMINI_API_KEY?Paste the actual Gemini API key: '
     ```

     ```sh
     export GEMINI_API_KEY
     ```

   Run each `read` command separately so it waits for the key you intend to enter. Confirm variables are set without printing their values:

   ```sh
   [[ -n "$SUPABASE_URL" ]] && echo "SUPABASE_URL set" || echo "SUPABASE_URL missing"
   [[ -n "$SUPABASE_SERVICE_ROLE_KEY" ]] && echo "SUPABASE_SERVICE_ROLE_KEY set" || echo "SUPABASE_SERVICE_ROLE_KEY missing"
   [[ -n "$GEMINI_API_KEY" ]] && echo "GEMINI_API_KEY set" || echo "GEMINI_API_KEY missing"
   ```

   All three must say **set**. If the terminal is closed, set them again in the new terminal. Do not paste the keys into chat or print them to check them.
6. Preview the source fetch and extraction without writing to Supabase or calling Gemini embeddings:

   ```sh
   node scripts/ingest_byu_sources.mjs --dry-run
   ```
7. After reviewing the listed sources, run the ingestion from the same terminal, without `--dry-run` or a trailing backslash:

   ```sh
   node scripts/ingest_byu_sources.mjs
   ```

   It fetches allowed pages, creates embeddings for new or changed chunks, and writes them to Supabase. A successful run ends with `Ingestion complete with 0 failed source(s).` Warnings may report pages disallowed by a site's `robots.txt`; those are skipped. If the script says the environment variables are missing, set/export all three in that same terminal and retry. Re-run ingestion when approved pages change; unchanged chunks are not re-embedded.
8. Confirm rows were added to `public.byu_knowledge_chunks` in the Supabase Table Editor. Then ask the chatbot a question about one of the indexed topics and check that a supported answer includes BYU source links.

The chatbot now makes an embedding request and a text-generation request for each question, so Gemini usage can increase. Supabase stores the chunk text and 768-dimensional vectors. The source list is intentionally curated and the extractor handles public HTML pages; it does not crawl an entire BYU domain, process authenticated pages, or extract PDF contents.

### November 17 — Profiles, readable replies, and expanded sources

- Expanded signup metadata to collect first name, last name, school year, expected graduation year, and major. Supabase Auth stores these values in `raw_user_meta_data`, and the signed-in greeting uses the saved first and last name.
- Removed the separate username field because email is the Supabase login identifier. Existing accounts without saved names fall back to the email prefix in the greeting.
- Added safe Markdown-style rendering for assistant replies, including short headings, paragraphs, bold and italic text, inline code, lists, and validated BYU links. The chatbot prompt asks for short paragraphs and compact lists when they improve readability.
- Added friendly handling for standalone gratitude and acknowledgment messages. These replies bypass knowledge retrieval and are excluded from factual answer-validity metrics.
- Expanded the knowledge-source list to 82 reviewed BYU pages, including history, leadership, events, academic departments, campus dining locations, and meal-plan rates.
- Improved the mobile welcome-page mock phone so its input and conversation stay inside the phone frame.

## Project Setup

1. Clone the repository
   Clone a fresh copy of the code from GitHub to your local machine
2. Configure Supabase (Backend & Database)
   The project connects to a Supabase backend for user authentication and database storage.

- Go to Supabase and sign in or create an account.

  - Click New Project, select your organization, and fill out your project details (name, database password, and region).
  - Wait a couple of minutes for Supabase to provision your database and project resources.
- Retrieve Your API Credentials

  - Once your project is ready, navigate to the Project Settings (gear icon on the left sidebar).
  - Click on API under the project settings menu.
  - Copy your unique Project URL and your anon / public API key.
  - Open auth.js in your project codebase and paste these values into the configuration constants. Example below:
    - const SUPABASE_URL = "YOUR_SUPABASE_URL_HERE";
    - const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";
- Lanching the project locally

  - Open the project folder in your code editor (e.g., VS Code), if it isn't already
  - If you are using VS Code, right-click on index.html and select "Open with Live Server".
- Test the Vertical Slice (Sign Up & Dynamic Greeting)

  - Click the "Sign up" button in the top right navigation bar of the app.
  - Fill out the modal form with your name, school year, expected graduation year, major, email, and password, then submit.
  - Supabase stores the profile values in Auth user metadata. After sign-in, the header greets the user by first and last name.
  - Refresh the browser to confirm the greeting is restored from the Supabase session.

  Link to the video that shows our vertical slice!

  https://drive.google.com/file/d/1BjYv-1bu54aDe3vI3Q5nayR7s9FfJUaN/view?usp=sharing

## Sprint Vertical Slices

The sprint list contains **11 vertical slices** (although it was introduced as 10). Status below reflects the code currently in this repository. Supabase-backed slices also require the matching deployed tables, policies, and functions; those live services have not been independently smoke-tested as part of this README update.

### 1. Report an issue — Implemented in the front end; requires sign-in and Supabase

A signed-in user can submit a description through the “Report an issue” form. The app inserts the report into the `issue_report` table with the user's ID, a `Pending` status, and a timestamp in Mountain Time. Signed-out users are asked to sign in.

**Verifying the vertical slice:** Sign in, open “Report an issue,” enter a description, and submit. Confirm the success toast. Refresh the page, then check the Supabase Table Editor for the new row in `issue_report`; the report is stored in the database and does not need to remain visible in the form after refresh. Confirm the row has the expected user, status, description, and timestamp.

### 2. Sign in — Implemented; requires Supabase Auth

The sign-in form calls Supabase Auth with the user's email and password. The header restores the active session on page load and provides a sign-out action.

### 3. Sign up — Implemented in the front end; requires Supabase Auth

The sign-up forms create a Supabase Auth account with first name, last name, school year, expected graduation year, and major saved in Auth user metadata. Supabase stores these values in `auth.users.raw_user_meta_data` as JSON keys (`first_name`, `last_name`, `school_year`, `graduation_year`, and `major`); they are not separate columns on `auth.users`, so no Auth table schema change is needed. Depending on email-confirmation settings, the user may need to confirm their email before a session is created. When signed in, the header greets them by first and last name, with an email-based fallback for existing accounts without saved names.

**Verifying the vertical slice:** Use a new email address in the “Sign up” form, submit your name, school year, expected graduation year, major, email, and password, and complete any email-confirmation step required by Supabase. Once signed in, confirm the greeting appears. Refresh the page and confirm the greeting remains, showing that the Supabase session is restored. If the project requires email confirmation, account creation alone may not sign the user in.

### 4. Chatbot history saves — Implemented; requires the deployed chatbot Edge Function and Supabase policies

The browser sends the signed-in user's access token and conversation ID to the Supabase `chatbot` Edge Function. The function verifies conversation ownership, loads up to the 20 most recent saved messages in chronological order, and sends those turns with the new prompt to Gemini so follow-up questions can use the current chat's context. New conversations begin with only the first prompt. The browser keeps the active conversation ID in per-user session storage, and prior saved conversations can be reloaded from Supabase.

The Edge Function recognizes standalone expressions of gratitude and acknowledgment, including “thank you,” “thanks so much,” and “that was helpful,” and returns a friendly conversational reply without running a BYU knowledge search. The detector only handles messages that consist entirely of an acknowledgment, so a message such as “Thanks—when does registration open?” still follows the normal source-grounded question flow. Conversational replies are saved to `chat_messages` with a null database `response_code`, which keeps them out of the valid-answer and no-answer metrics.

Assistant replies support safe Markdown-style formatting for paragraphs, short headings, bold and italic text, inline code, numbered lists, bulleted lists, and validated links to BYU domains. User messages remain plain text. The Edge Function asks Gemini to keep paragraphs short and use compact lists for multi-part answers.

**Verifying the vertical slice:** Sign in, send a question, and confirm a conversation appears in the sidebar and in `chat_conversations` with the signed-in user's ID. Send “Thank you!” and confirm the chatbot responds conversationally rather than showing the insufficient-sources message. Navigate away and return, select the conversation, and confirm its saved messages load. The browser also stores the active conversation ID in session storage for the current tab.

### 5. Chat history — Implemented for signed-in users

The chatbot sidebar lists the signed-in user's saved conversations as soon as they log in, including when they sign in through the modal without reloading the page. Selecting a conversation reloads its messages. Supabase RLS policies on `chat_conversations` and `chat_messages` determine which rows the user can read. Guest chats are not listed as saved user history.

### 6. New chat — Implemented as “Clear chat”; requires the deployed chatbot Edge Function to save the next conversation

“Clear chat” resets the visible chat and stores a blank-chat marker so the prior conversation is not reopened on reload. The next submitted prompt is sent without the previous conversation ID, allowing the chatbot function to create a new conversation. The new conversation appears in saved history after the function creates it.

**Verifying the vertical slice:** Send a question and note the conversation in the sidebar. Select “Clear chat,” send another question, and confirm a new conversation appears while the old conversation remains available in history.

### 7. Feedback star rating — Implemented in the front end; requires Supabase

The chatbot shows a one-time five-star helpfulness survey after the second chatbot answer, or after 30 seconds from the first question. Selecting a star inserts the rating and conversation ID into `chat_feedback`.

**Verifying the vertical slice:** Send chatbot questions until the survey appears (or wait 30 seconds after the first question). Select a star and confirm the “Thanks for your feedback!” status. Refresh the page and check the Supabase Table Editor for the saved row in `chat_feedback`, including its rating and conversation ID. The survey is one-time per page load/conversation flow; the persisted rating is confirmed in the table.

### 8. Admin — Suggested event shows up for approval — Implemented locally; Edge Function deployment required

The calendar suggestion form saves submissions in `User_Submitted_Events` with `is_published = false`. The Approvals & Reports page lists those pending submissions. An admin can approve a submission; the `admin-event-submissions` Edge Function marks it as handled and copies its event details into `Event` with `is_published = true`. Calendar display for rows in `Event` is being handled separately.

Deploy the admin endpoint from the repository root:

```sh
npx supabase functions deploy admin-event-submissions --project-ref xyyhccpivxxgiatptwko
```

**Verifying the vertical slice:** Submit an event through the calendar form while signed in. Confirm it appears in `User_Submitted_Events` with `is_published = false`. On **Approvals & Reports**, click **Refresh submissions**, approve it, and confirm it disappears from the pending list and appears in `Event` with `is_published = true`. Refresh the admin page to confirm it stays out of the pending list. This does not connect `Event` to calendar display.

### 9. Chat feedback summary — Implemented for admins; requires the deployed `admin-metrics` Edge Function

The metrics dashboard gets `chat_feedback_summary` through the `admin-metrics` Edge Function. The function checks the trusted admin role and uses a server-side key to read only the summary view, returning total responses, average rating, and one- through five-star counts. The function must be deployed to the linked Supabase project.

### 10. Chatbot answer validity summary — Implemented for admins; requires the deployed `admin-metrics` Edge Function

The metrics dashboard gets `chatbot_answer_validity_summary` through the `admin-metrics` Edge Function. The function checks the trusted admin role and uses a server-side key to read the aggregate view, returning valid/no-answer counts and percentages. The function must be deployed to the linked Supabase project.

### 11. Engagement and returning users — Partially implemented; page timing and repeat-use metrics are live

Anonymous engaged-time tracking is implemented for the FAQ, chatbot, and calendar pages. `page-activity.js` counts time only while the page is visible and the visitor has interacted within the previous 30 seconds. It sends anonymous visitor, visit, page, and elapsed-time values to the `track-page-activity` Edge Function; it does not send account IDs or page content. The function upserts visits into `page_session_activity`, and the admin dashboard reads the `page_engagement_weekly_summary` view through `admin-metrics` to show visits, unique visitors, and median and average engaged time. Apply `supabase/migrations/20261116000300_page_session_activity.sql`, deploy `track-page-activity`, and redeploy `admin-metrics` before expecting live page-engagement data.

The monthly repeat-use panel reads the admin-only `chatbot_monthly_repeat_usage_summary` view. It lists 13 prior calendar months plus the current month to date, then the rolling last 30 days; months display oldest to newest. At each month change, the oldest month rolls off. It counts signed-in users who sent chatbot messages on at least two distinct UTC dates in each period. The repeat-use percentage is light green at or above the 50% goal and light red below it. Popular chatbot-question and external-link-click metrics remain placeholders.

### How admin login works

- The browser invokes `supabase/functions/admin-metrics/index.ts` with its current Supabase session; the function verifies the user's account and admin role, then returns the answer-validity, chat-feedback, monthly repeat-use, and weekly page-engagement summaries. Deploy it with `supabase functions deploy admin-metrics --project-ref xyyhccpivxxgiatptwko` before expecting live metrics in the hosted app.
- The `chatbot_monthly_repeat_usage_summary` view supplies 14 calendar-month rows (13 prior months plus the current month to date), followed by a rolling last-30-days row. The repeat-use percentage is highlighted light green when it meets the 50% target and light red when it does not.
- Both Supabase summary views use `security_invoker=on`. Direct browser queries therefore follow the signed-in user's RLS access to the underlying tables. Project-wide aggregate access is now routed through the admin-only `admin-metrics` Edge Function.

#### Add another admin account

1. In the Supabase Dashboard, open **Authentication → Users** and find the account by email. If the person does not have an account yet, select **Add user → Send invitation** and have them finish setting it up.
2. Open **SQL Editor → New query**. Replace `admin@example.com` in this read-only query with the account's email, run it, and confirm it returns the intended user:

   ```sql
   select
     id,
     email,
     role as supabase_role,
     raw_app_meta_data ->> 'role' as cougarai_role
   from auth.users
   where lower(email) = lower('admin@example.com');
   ```
3. To grant the CougarAI admin role, replace the example email in this query and run it:

   ```sql
   update auth.users
   set raw_app_meta_data =
     coalesce(raw_app_meta_data, '{}'::jsonb)
     || jsonb_build_object('role', 'admin')
   where lower(email) = lower('admin@example.com')
   returning
     email,
     role as supabase_role,
     raw_app_meta_data ->> 'role' as cougarai_role;
   ```

   Confirm one row is returned with `cougarai_role` equal to `admin` and `supabase_role` still equal to `authenticated`. Do not change the top-level `auth.users.role`; that is Supabase's database role, not CougarAI's admin role.

   Have the admin sign out and sign back in, then open **Metrics**. The Metrics links appear only for accounts whose `app_metadata.role` is `admin`; the dashboard also checks the role when opened directly.

   This is a one-off change in the Supabase SQL Editor. For production user provisioning, use Supabase's Auth Admin API from a trusted server; never put a Supabase secret/service-role key in browser code. [Supabase `updateUserById` guidance](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)

#### How the admin metrics Edge Function works

The browser calls `supabase/functions/admin-metrics/index.ts` through `client.functions.invoke("admin-metrics")` and sends the current Supabase login session. The function verifies that session with Supabase Auth, then checks the trusted `app_metadata.role` value. Requests from users without `role: "admin"` receive HTTP 403. The browser-side page check controls navigation and visibility; the Edge Function performs the server-side authorization that protects the data.

After the role check, the function uses its server-side service-role key to query only the summary views and returns aggregate fields to the admin page. The key is provided as a server environment secret and must never be added to browser code, committed to the repository, or shared in chat. The function does not expose the underlying activity, chat, or feedback tables. The Supabase project configuration keeps JWT verification enabled for this admin-only function.

#### Greg Project admin site

The signed-in Cougar AI **Admin → Approvals & Reports** page includes a link to the [Greg Project admin site](https://403project.vercel.app/). The link opens in the same tab. Greg Project is a companion full-stack admin app for the IS 403 project. It can maintain Supabase Authentication users and create, read, update, and delete rows in public.greg_table.

Both apps use the same Supabase project and administrator account. Greg Project has its own site session, so an administrator signs in again when moving from Cougar AI to Greg Project. Greg Project checks admin access on its server and keeps the Supabase secret key server-side.

#### Deno and editing Edge Functions

Supabase Edge Functions are TypeScript functions that run in Supabase's Deno-compatible Edge Runtime. Deno is the runtime and toolchain behind APIs used here, such as `Deno.serve()` and `Deno.env.get()`. The Deno VS Code extension provides editor support (including type information and diagnostics); `.vscode/settings.json` enables it for `supabase/functions` only, so the regular website files continue using VS Code's normal JavaScript/TypeScript support.

Teammates can use the site without installing Deno. Teammates who edit Edge Function code should install the Deno VS Code extension. The separate Deno command-line executable is useful for Deno-specific CLI tools; Supabase CLI uses its own Edge Runtime to serve functions locally. If VS Code reports that it cannot resolve the Deno executable, the extension needs the Deno CLI available on PATH or configured with its `deno.path` setting. To deploy this function to the linked Supabase project, use `supabase functions deploy admin-metrics --project-ref xyyhccpivxxgiatptwko` from the repository root.

## 📅 Cougar AI Interactive Calendar

The Cougar AI Calendar helps BYU students discover upcoming events and activities happening on campus and throughout the Provo community. The calendar provides an easy-to-use interface for exploring campus activities, sporting events, concerts, community gatherings, and wellness opportunities.

### How to Use the Calendar

1. **Browse Events:** The calendar automatically displays the current month. Use the left and right arrows to navigate between available months or click "Today" to return to the current month.
2. **Filter by Category:** Select BYU (Blue), Community (Gold), Arts & Culture (Coral), or Wellness (Green) to display events that match your interests. Select "All Events" to view everything.
3. **View Event Details:** Click any event on the calendar to open a popup displaying its date, time, location, category, and description.
4. **Explore Upcoming Events:** Scroll below the calendar to view event cards that automatically update based on the selected month and category. Click a card for additional details.

### Key Features

- Automatically displays the current month.
- Color-coded events with an easy-to-read legend.
- Interactive category filtering.
- Clickable event details.
- Dynamically updated event cards.
- Responsive design for desktop and mobile devices.

The Cougar AI Calendar is designed to help students stay connected, discover new experiences, and make the most of their time at BYU.

## ERD

<img width="1677" height="1026" alt="Cougar AI ERD-2" src="https://github.com/user-attachments/assets/dbedbe00-b875-41ca-9a49-28a5e3e22043" />

## Demo

[Vertical slice demo video](https://drive.google.com/file/d/1BjYv-1bu54aDe3vI3Q5nayR7s9FfJUaN/view?usp=sharing)

## Data Flow Diagrams

<img width="590" height="162" alt="image" src="https://github.com/user-attachments/assets/ed13cffb-3386-4696-ba91-1ef80282e13d" />
<img width="685" height="309" alt="image" src="https://github.com/user-attachments/assets/75e3da83-265a-447c-8b55-e61f32a825fb" />

## Greg Project Admin Site

The Cougar AI **Approvals & Reports** page includes a **Greg Project** link for administrators. It opens the separate Greg Project site, where an admin signs in again with the shared Supabase Auth account and can maintain user accounts and project records. The second sign-in is required because the Greg Project site can also be opened directly.

The Greg Project site uses the same Supabase project as Cougar AI. Its admin pages call Supabase Edge Functions for protected operations; sensitive service-role credentials stay on the server side. The deployed site is available at [Greg Project](https://403project.vercel.app/).
