# CougarAI

## App Summary

There isn’t a clear process for freshmen incoming to BYU to find all the information in one place
on the BYU website. Many times, they need to click one link, redirect to another site, refer to
another, and only then have they completed one step of their freshman checklist. Why is
information vague and not all in the same place where everybody can access what they need in
the most efficient way possible? This is a problem for not only freshman coming straight out of
high school, but also for current missionaries trying to prepare with limited time and resources.

This is the probelem that our app solves. CougarAI has a built in chatbot that is trained on everything a freshman needs to prepare for and get through their first year at BYU. It also includes a FAQ page for freshman who don't even know where to start in their preparation, which is generated based on questions other users are asking the chatbot.

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

### November 10 — Shared layout and metrics dashboard

- Replaced repeated page headers and footers on the main pages with `partials/header.html` and `partials/footer.html`, loaded by `layout.js`. The shared navigation includes a link to `metrics.html`.
- Fixed a duplicated block and unmatched `catch` in `app.js` that caused a JavaScript syntax error and prevented that script from running.
- Added a styled metrics dashboard with live tables for `chatbot_answer_validity_summary` and `chat_feedback_summary`, plus one **Refresh all metrics** button.
- Added two visual placeholders for planned session activity metrics and monthly repeat chatbot use. These placeholders do not collect or query data yet.
- Both Supabase summary views use `security_invoker=on`. Their Data API results therefore follow the signed-in user's RLS access to the underlying tables. In a diagnostic query, the answer view returned 6 valid answers for the current user, while the SQL export showed 58 valid answers project-wide. The metrics page is not admin-restricted, and no admin-only Edge Function has been added yet.


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

### 9. Chat feedback summary — Partially implemented; global admin access is pending

The metrics dashboard reads `chat_feedback_summary`, which provides total responses, average rating, and one- through five-star counts. The view runs with `security_invoker=on`, so the result follows the signed-in user's RLS access to `chat_feedback`; global admin-only access is not implemented yet.

### 10. Chatbot answer validity summary — Partially implemented; global admin access is pending

The metrics dashboard reads `chatbot_answer_validity_summary`, which provides valid/no-answer counts and percentages. The view runs with `security_invoker=on` and reads `chat_messages`, so its output is scoped by the user's RLS access. The dashboard does not yet provide project-wide metrics through an admin-only Edge Function.

### 11. Engagement and returning users — Planned; placeholders only

The metrics page has visual placeholders for session activity (FAQ time on page, popular chatbot questions, and external link clicks) and monthly repeat chatbot use. Session data collection, monthly aggregation, and admin-only access are not implemented.

## ERD

<img width="1677" height="1026" alt="Cougar AI ERD-2" src="https://github.com/user-attachments/assets/dbedbe00-b875-41ca-9a49-28a5e3e22043" />

## Demo

[Vertical slice demo video](https://drive.google.com/file/d/1BjYv-1bu54aDe3vI3Q5nayR7s9FfJUaN/view?usp=sharing)
