
### **Technical Specification Document (TSD)**

### **1. System Architecture**

For this project, we will adopt a modern, decoupled architecture using a Backend-as-a-Service (BaaS) provider.

*   **Frontend:** A Single-Page Application (SPA) built with **React**. The SPA will be responsible for all user interface elements, providing a dynamic and responsive experience that mimics the official digital SAT platform.

*   **Backend (BaaS):** We will use **Supabase** as our all-in-one backend. The frontend application will communicate directly with Supabase's auto-generated APIs. Supabase will provide:
    *   **A managed PostgreSQL Database** for structured, relational data storage.
    *   **Built-in User Authentication** to manage student and admin accounts securely.
    *   **Instant APIs** that allow the frontend to interact with the database.
    *   **Row-Level Security (RLS)** to enforce strict data access rules (e.g., students can only see their own results) directly at the database level.

### **2. Technology Stack**

*   **Frontend:** **React** 
*   **Backend-as-a-Service (BaaS):** **Supabase**.
    *   This single platform provides the **PostgreSQL Database**, **Authentication**, and **APIs** needed for the application.
*   **Hosting:**
    *   **Frontend:** **Vercel** or **Netlify**. 
    *   **Backend & Database:** **Supabase**. The entire backend infrastructure, including the PostgreSQL database, is hosted within the Supabase platform, which also has a generous free tier suitable for this project's initial phase.


**3. Data Model/Schema**

**3.1. `Questions` Collection**

```json
{
  "_id": "ObjectId",
  "exam": "SAT College Board Exam 1",
  "section": "English Module 1",
  "questionNumber": 1,
  "questionType": "Evidence",
  "passage": "The text of the passage...",
  "question": "Which choice completes the text...",
  "options": {
    "A": "preventable",
    "B": "undeniable",
    "C": "common",
    "D": "concerning"
  },
  "answerType": "Multiple Choice", // or "Short Answer"
  "correctAnswer": "A", // or the numerical answer for short answer questions
  "difficulty": 5 // Scale of 1-10
}
```

**3.2. `Users` Collection**

```json
{
  "_id": "ObjectId",
  "username": "student1",
  "password": "hashed_password",
  "role": "student" // or "admin"
}
```

**3.3. `TestResults` Collection**

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "examId": "ObjectId",
  "dateTaken": "ISODate",
  "overallScore": 1400,
  "englishScore": 700,
  "mathScore": 700,
  "answers": [
    {
      "questionId": "ObjectId",
      "userAnswer": "B",
      "isCorrect": false
    }
  ]
}
```

**4. Key API Endpoints**

*   `POST /api/users/register` - Register a new user.
*   `POST /api/users/login` - Authenticate a user and return a JWT.
*   `GET /api/exams/:examId` - Fetch all questions for a given exam.
*   `POST /api/exams/submit` - Submit a user's answers for a mock exam.
*   `GET /api/results/user/:userId` - Get all test results for a specific user.
*   `GET /api/results/:resultId` - Get a detailed report for a specific test result.
*   `GET /api/questions/practice` - Get a set of practice questions based on filters.

**5. Data Export Strategy**

To ensure data portability, a feature should be implemented to export the `Questions` collection to standard formats like:

*   **JSON:** The native format of the database.
*   **CSV:** A universally compatible format.
*   **QTI (Question & Test Interoperability):** An XML-based format that is the standard for assessment content and can be imported into many learning management systems. A dedicated library (e.g., a Node.js package for QTI) should be used to handle the conversion.

We will use `pnpm` as the package manager, as it's excellent for managing monorepos.
### Monorepo Project Structure

Here is the high-level folder layout. 

```
sat-mock-exam/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   │   └── page.tsx
│       │   │   └── signup/
│       │   │       └── page.tsx
│       │   ├── (platform)/
│       │   │   ├── dashboard/
│       │   │   │   └── page.tsx
│       │   │   ├── exam/
│       │   │   │   └── [examId]/
│       │   │   │       └── page.tsx
│       │   │   ├── problem-bank/
│       │   │   │   └── page.tsx
│       │   │   └── layout.tsx
│       │   ├── api/
│       │   └── layout.tsx
│       │   └── page.tsx
│       ├── components/
│       │   ├── exam/
│       │   │   ├── ExamTimer.tsx
│       │   │   ├── QuestionView.tsx
│       │   │   └── SplitScreenLayout.tsx
│       │   ├── reporting/
│       │   │   └── ScoreChart.tsx
│       │   └── ui/
│       │       ├── Button.tsx
│       │       └── Modal.tsx
│       ├── lib/
│       │   ├── actions.ts
│       │   └── supabase.ts
│       ├── public/
│       ├── next.config.mjs
│       └── tsconfig.json
│
├── packages/
│   └── database/
│       └── supabase/
│           ├── migrations/
│           │   └── 20240101000000_initial_schema.sql
│           ├── functions/
│           │   └── submit-exam/
│           │       └── index.ts
│           └── config.toml
│
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

---

### Explanation of Key Directories

#### `apps/`
This directory contains the actual applications that can be run and deployed.

*   **`apps/web/`**: This is your entire Next.js frontend application.
    *   **`app/`**: The core of the Next.js App Router.
        *   `(auth)/` & `(platform)/`: These are "route groups." They organize your pages without affecting the URL. It's a clean way to apply different layouts—for instance, `(auth)` pages have a simple layout for login/signup, while `(platform)` pages have the main navigation sidebar and header for logged-in users.
        *   `exam/[examId]/`: A dynamic route that will display the exam interface for a given exam ID.
        *   `api/`: For any server-side API routes you might need that aren't handled directly by Supabase.
    *   **`components/`**: All your React components.
        *   `exam/`, `reporting/`: Organizing components by feature (e.g., everything related to the exam experience goes in `exam/`). This is much more scalable than having one giant list of components.
        *   `ui/`: Generic, reusable UI elements like buttons, inputs, and modals. These should be simple and un-opinionated.
    *   **`lib/`**: Contains helper functions and client-side logic.
        *   `supabase.ts`: Initializes the Supabase client for use in the browser.
        *   `actions.ts`: For Next.js Server Actions—secure, server-side functions you can call directly from your React components to mutate data (e.g., submitting an answer).

#### `packages/`
This directory contains shared code and configurations used by different apps in the monorepo.

*   **`packages/database/`**: This is the "source of truth" for your entire backend. It is **not** a running server; it's the definition of your database.
    *   **`supabase/migrations/`**: This is the most critical folder. Each file here is a SQL script that defines a change to your database schema. You would create a new migration to add a table, add a column, or set up Row-Level Security policies. This allows you to version control your database just like code.
    *   **`supabase/functions/`**: If you need more complex backend logic (e.g., processing a test submission to calculate a score), you can write serverless **Edge Functions** here. The code (`index.ts`) for these functions lives in this directory.
    *   **`supabase/config.toml`**: The main configuration file for your Supabase project.