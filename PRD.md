### **Product Requirements Document (PRD)**

**1. Introduction**

This document outlines the product requirements for a web-based SAT mock exam and problem bank platform. The primary goal is to provide a realistic practice environment for SAT students. The platform will initially serve 2 students, 1 admin, delivering a high-quality mock tests and personalized practices.

**2. User Personas**

*   **Student:** A high school student preparing for the SAT.
    *   **Goals:**
        *   Take a full-length mock SAT to gauge their current performance.
        *   Receive a detailed analysis of their results to identify strengths and weaknesses.
        *   Practice specific question types or topics.
        *   Review questions they answered incorrectly.
    *   **Needs:**
        *   An intuitive and easy-to-use interface that mimics the real SAT experience.
        *   Clear and immediate feedback after the exams.
        *   The ability to track their progress over time.

*   **Admin:**
    *   **Goals:**
        *   Monitor the performance of all students.
        *   Access detailed reports for each student to provide targeted support.
    *   **Needs:**
        *   A centralized dashboard to view all student data.
        *   The ability to easily compare student performance.

**3. Features & Functional Requirements**

**3.1. Mock Exam Module**

*   **Test Structure:**
    *   The platform will host a full-length digital SAT mock exam (initially, College Board SAT Exam 1).
    *   The exam will be divided into four modules:
        *   **English Module 1:** 27 questions, 32 minutes
        *   **English Module 2:** 27 questions, 32 minutes
        *   **Math Module 1:** 22 questions, 35 minutes
        *   **Math Module 2:** 22 questions, 35 minutes
    
*   **Test Experience:**
    *   The user interface will replicate the look and feel of the actual digital SAT, including the split-screen view for passages and the single-screen view for other questions.
    *   A countdown timer for each section will be prominently displayed.
    *   Once a student completes a module or the time expires, the module will automatically close, and they will not be able to return to it.
    *   The order of questions within each module will be fixed and not shuffled.
*   **User Authentication & Access:**
    *   Students and the admin will have separate login credentials.
    *   Students can only access their own tests and results.
    *   The admin can view the results of all students.

**3.2. Problem Bank**

*   **Question Database:**
    *   All questions from the mock exam will be stored in a problem bank.
    *   Questions can be filtered by:
        *   Subject (Math/English)
        *   Question Type (e.g., Inference, Evidence-based, etc.)
        *   Difficulty Level (1-10)
*   **Practice Mode:**
    *   Students can generate practice quizzes from the problem bank.
    *   Questions in practice mode will be shuffled.
    *   Students will have access to a special "Incorrectly Answered" section, which will contain all the questions they have previously gotten wrong.

**3.3. Reporting & Analysis**

*   **Student Reports:**
    *   Upon completion of a mock exam, students will receive a detailed performance report.
    *   The report will include:
        *   Overall score.
        *   Score for each section (English and Math).
        *   A question-by-question breakdown showing their answer, the correct answer, and the difficulty level of the question.
*   **Admin Dashboard:**
    *   The admin will have a dashboard to view the performance of all students.
    *   The dashboard will provide an overview of each student's mock exam scores and progress.

**4. Non-Functional Requirements**

*   **Usability:** The platform should be intuitive and easy to navigate for both students and the admin.
*   **Performance:** The application should be responsive and load quickly, even with users in different geographical locations.
*   **Scalability:** While the initial user base is small, the architecture should allow for future expansion to accommodate more users and tests. The question data format must be exportable to ensure compatibility with other systems like Moodle or QTI.
*   **Security:** User data, especially personal information and test results, must be kept secure.