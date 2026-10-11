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

Front end: HTML/CSS/Javascript 
Database & Backend: Supabase 
AI app builder: CODEX 



## ERD

<img width="1677" height="1026" alt="Cougar AI ERD-2" src="https://github.com/user-attachments/assets/dbedbe00-b875-41ca-9a49-28a5e3e22043" />

## Step-by-Step Instructions

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

  https://drive.google.com/file/d/1ZJ5SMiYKdshsCJ5elqJUNJtQgBcxx98J/view?usp=sharing
