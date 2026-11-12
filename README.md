# CougarAI

## App Summary

There isn’t a clear process for freshmen incoming to BYU to find all the information in one place
on the BYU website. Many times, they need to click one link, redirect to another site, refer to
another, and only then have they completed one step of their freshman checklist. Why is
information vague and not all in the same place where everybody can access what they need in
the most efficient way possible? This is a problem for not only freshman coming straight out of
high school, but also for current missionaries trying to prepare with limited time and resources.

This is the probelem that our app solves. CougarAI has a built in chatbot that is trained on everything a freshman needs to prepare for and get through their first year at BYU. It also includes a FAQ page for freshman who don't even know where to start in their preparation, which is generated based on questions other users are asking the chatbot.

The FAQ page lets students browse common questions by topic, search by keyword, expand an answer, or continue to the chatbot if they need help with a question that is not covered. FAQ drafts are created from valid chatbot question-and-answer pairs from the previous 30 days: the existing `dynamic-function` Edge Function uses Gemini to group recurring questions, compare them with published FAQs and prior suggestions, and save new drafts to `faq_suggestions`. An administrator can run this process from the metrics dashboard, review each pending draft, choose an existing category or propose a new one, and approve or reject it. Approval publishes the reviewed question and answer through the `approve_faq_suggestion` database function; questions already covered by published FAQs are tracked separately instead of being added as duplicate drafts.

We also realize that BYU freshman struggle not only with figuring out the academic side of BYU, but the social side as well. For this purpose our app also has a calendar page which will include events happening on and off campus. Users will be able to filter this calendar to show them events that they are most interested in.

## Tech Stack

Front end: HTML, CSS, Javascript 
Database, Backend & Autentication: Supabase 
AI app builder: CODEX 

## Recent Work (November 9–10, 2026)

### November 9 — Chat persistence and history

- Fixed the chatbot request so a signed-in user's Supabase access token is sent to the `chatbot` Edge Function. The earlier diagnostic showed the function was treating the request as unauthenticated; after the fix, the user ID was available and saved conversations appeared in history.
- Chat conversations are listed from `chat_conversations`; selecting one loads its messages from `chat_messages`. The active conversation ID is kept in session storage so the chat can resume after navigating away and returning in the same tab.
- Starting a new chat clears the visible conversation and starts the next submitted prompt without the previous conversation ID. A conversation is saved when the first message is sent.
- Signed-in users can sign back in with email and password. The header restores the signed-in greeting and sign-out action from the Supabase session.

### November 10 — Admin metrics sign-in

- Reused the site's shared sign-in form for the metrics page. The Metrics link appears only for accounts with trusted `app_metadata.role = admin`; direct visits to `metrics.html` prompt for sign-in and keep the dashboard hidden unless the account has that role.
- Admin status must be assigned to the approved Supabase Auth account by a trusted administrator using the Auth Admin API or dashboard `app_metadata`; users cannot grant themselves access. The login checks the trusted `app_metadata.role` claim, never editable `user_metadata`.
- The page gate controls the dashboard UI, and the `admin-metrics` Edge Function independently verifies the signed-in user's trusted `app_metadata.role` before returning project-wide aggregate results. It reads only the two summary views with the server-side service-role key; that key is never sent to the browser.
- The admin metrics dashboard includes a **Generate FAQ drafts** button that runs the existing `dynamic-function`. It analyzes valid chatbot question-and-answer pairs from the last 30 days with Gemini, compares its suggestions against published FAQs and existing suggestions, and saves new drafts to `faq_suggestions` for admin review. The dashboard lets admins assign or create a category, approve or reject each draft, and see questions already covered by an existing FAQ. Approval publishes the FAQ through the `approve_faq_suggestion` database function.


4.

### November 10 — Shared layout and metrics dashboard

- Replaced repeated page headers and footers on the main pages with `partials/header.html` and `partials/footer.html`, loaded by `layout.js`. The shared navigation includes a link to `metrics.html`.
- Fixed a duplicated block and unmatched `catch` in `app.js` that caused a JavaScript syntax error and prevented that script from running.
- Added a styled metrics dashboard with live tables for `chatbot_answer_validity_summary` and `chat_feedback_summary`, plus one **Refresh all metrics** button.





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
  - Fill out the modal form with a Username, Email, and Password, then submit.
  - Supabase will process the registration, create the account in your database, and automatically swap the top-right header buttons from "Sign up / Sign in" to a dynamic greeting reading: "Hello, 'username'!" (along with a Sign out button).
  - Hit refresh in the browser to confirm that it still says "Hello, 'username'!" in the top right corner. If it does then your database and backend is sucessfully working!


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

The sign-up form creates a Supabase Auth account with a username saved as user metadata. Depending on the project's email-confirmation settings, the user may need to confirm their email before a session is created. When a session is returned, the header changes to a greeting and sign-out control.

**Verifying the vertical slice:** Use a new email address in the “Sign up” form, submit a username, email, and password, and complete any email-confirmation step required by Supabase. Once signed in, confirm the greeting appears. Refresh the page and confirm the greeting remains, showing that the Supabase session is restored. If the project requires email confirmation, account creation alone may not sign the user in.

### 4. Chatbot history saves — Implemented; requires the deployed chatbot Edge Function and Supabase policies

The browser sends the signed-in user's access token and conversation ID to the Supabase `chatbot` Edge Function. The function can associate a conversation with the authenticated user. The browser keeps the active conversation ID in per-user session storage, and prior saved conversations can be reloaded from Supabase.

**Verifying the vertical slice:** Sign in, send a question, and confirm a conversation appears in the sidebar and in `chat_conversations` with the signed-in user's ID. Navigate away and return, select the conversation, and confirm its saved messages load. The browser also stores the active conversation ID in session storage for the current tab.

### 5. Chat history — Implemented for signed-in users

The chatbot sidebar lists the signed-in user's saved conversations. Selecting a conversation reloads its messages. Supabase RLS policies on `chat_conversations` and `chat_messages` determine which rows the user can read. Guest chats are not listed as saved user history.

### 6. New chat — Implemented as “Clear chat”; requires the deployed chatbot Edge Function to save the next conversation

“Clear chat” resets the visible chat and stores a blank-chat marker so the prior conversation is not reopened on reload. The next submitted prompt is sent without the previous conversation ID, allowing the chatbot function to create a new conversation. The new conversation appears in saved history after the function creates it.

**Verifying the vertical slice:** Send a question and note the conversation in the sidebar. Select “Clear chat,” send another question, and confirm a new conversation appears while the old conversation remains available in history.

### 7. Feedback star rating — Implemented in the front end; requires Supabase

The chatbot shows a one-time five-star helpfulness survey after the second chatbot answer, or after 30 seconds from the first question. Selecting a star inserts the rating and conversation ID into `chat_feedback`.

**Verifying the vertical slice:** Send chatbot questions until the survey appears (or wait 30 seconds after the first question). Select a star and confirm the “Thanks for your feedback!” status. Refresh the page and check the Supabase Table Editor for the saved row in `chat_feedback`, including its rating and conversation ID. The survey is one-time per page load/conversation flow; the persisted rating is confirmed in the table.

### 8. Admin — Suggested event shows up for approval — Not implemented

The calendar’s “Suggest an Event” button currently displays a prototype message. There is no event submission form, approval queue, or admin review workflow.

### 9. Chat feedback summary — Implemented for admins; requires the deployed `admin-metrics` Edge Function

The metrics dashboard gets `chat_feedback_summary` through the `admin-metrics` Edge Function. The function checks the trusted admin role and uses a server-side key to read only the summary view, returning total responses, average rating, and one- through five-star counts. The function must be deployed to the linked Supabase project.

### 10. Chatbot answer validity summary — Implemented for admins; requires the deployed `admin-metrics` Edge Function

The metrics dashboard gets `chatbot_answer_validity_summary` through the `admin-metrics` Edge Function. The function checks the trusted admin role and uses a server-side key to read the aggregate view, returning valid/no-answer counts and percentages. The function must be deployed to the linked Supabase project.

### 11. Engagement and returning users — Partially implemented

The metrics page has a placeholder for session activity (FAQ time on page, popular chatbot questions, and external link clicks). The monthly repeat-use panel reads the admin-only `chatbot_monthly_repeat_usage_summary` view. It lists 13 prior calendar months plus the current month to date, then the rolling last 30 days; months display oldest to newest. At each month change, the oldest month rolls off. It counts signed-in users who sent chatbot messages on at least two distinct UTC dates in each period. The repeat-use percentage is light green at or above the 50% goal and light red below it. Session activity collection and aggregation are not implemented.


### How admin login works
- The browser invokes `supabase/functions/admin-metrics/index.ts` with its current Supabase session; the function verifies the user's account and admin role, then returns the answer-validity, chat-feedback, and monthly repeat-use summaries. Deploy it with `supabase functions deploy admin-metrics --project-ref xyyhccpivxxgiatptwko` before expecting live metrics in the hosted app. 
- Session activity remains a visual placeholder. The `chatbot_monthly_repeat_usage_summary` view supplies 14 calendar-month rows (13 prior months plus the current month to date), followed by a rolling last-30-days row. The repeat-use percentage is highlighted light green when it meets the 50% target and light red when it does not.
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

After the role check, the function uses its server-side service-role key to query only the summary views, and returns their aggregate fields to the admin page. The key is provided as a server environment secret and must never be added to browser code, committed to the repository, or shared in chat. The function does not expose the underlying chat or feedback tables. The Supabase project configuration keeps JWT verification enabled for this function.

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


