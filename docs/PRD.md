### **Product Requirements Document (PRD) - v2.0**

| Version | Date | Author | Summary of Changes |
| :--- | :--- | :--- | :--- |
| 1.0 | (Initial Date) | Project Lead | Initial draft outlining the core concept and MVP features. |
| **2.0** | **August 1, 2025** | **Gemini AI** | **Major update post-MVP. Focus on replacing all mock data with a data-driven, authentic scoring system. Completes partially-built features and establishes a long-term vision for AI-powered components.** |

### **1. Introduction**

This document outlines the product requirements for a web-based SAT mock exam and problem bank platform. The primary goal is to provide a realistic, data-driven, and personalized practice environment for SAT students.

#### **1.1. PRD v2.0: From Prototype to Product**

The initial version (v1.0) successfully established the core infrastructure and a polished user interface. This v2.0 document outlines the critical next phase: **transforming the platform from a "beautiful facade" into a truly functional, intelligent system.**

The key objective is to eliminate all placeholder ("mock" or "hardcoded") data and replace it with real, dynamically calculated analytics. We will implement a sophisticated, defensible scoring system based on official SAT data and ensure all features are fully functional and database-integrated to provide genuine value and trustworthy feedback to our users.

### **2. User Personas**
*(User goals are updated to reflect the new focus on authenticity.)*

*   **Student:** A high school student preparing for the SAT.
    *   **Goals:**
        *   Take a full-length mock SAT to gauge their current performance with **accurate, transparent scoring.**
        *   Receive a detailed, **data-driven analysis** of their results to identify strengths and weaknesses.
        *   Practice specific question types or topics based on **personalized recommendations.**
        *   Review questions they answered incorrectly, with their progress **saved reliably.**
    *   **Needs:**
        *   An intuitive interface that mimics the real digital SAT experience.
        *   **Trustworthy and immediate feedback** after exams.
        *   The ability to **accurately track their progress** over time.

*   **Admin:**
    *   **Goals:**
        *   Monitor the **actual performance** of all students through aggregated data.
        *   Access detailed, **authentic reports** for each student to provide targeted support.
        *   **Efficiently manage and create** exam content with confidence in the underlying system.
    *   **Needs:**
        *   A centralized dashboard to view **real student data** and analytics.
        *   An intuitive interface for creating and editing questions.

### **3. Features & Functional Requirements (v2.0)**

#### **3.1. Intelligent Scoring & Analytics (Critical Priority)**

This is the central pillar of v2.0. All user-facing scores and statistics must be authentic and defensible.

*   **Intelligent Scoring Engine:** The current simplified scoring must be replaced with a system that leverages the 10 official SAT scoring curves.
    *   **Scoring Curve Database:** The 10 official SAT Raw Score → Scaled Score conversion tables will be stored in the database.
    *   **Difficulty-Based Curve Matching:** The system will automatically select the most appropriate scoring curve for any given exam.
        1.  Each exam will have a calculated **'Average Difficulty Index'** based on the `difficulty` values of its constituent questions.
        2.  The system will match this index to the most similar official SAT exam's scoring curve. (e.g., "This exam's difficulty is 6.5, which is closest to the 'harsh' curve of official test #8, so we will apply that curve.")
    *   **Transparency:** The results page will inform the user which scoring model was applied and why (e.g., "This exam's difficulty was judged to be 'High', so the official 'Harsh' scoring curve was applied.").

*   **Data-Driven Dashboards:** All static modules on student and admin dashboards must be connected to live database queries.
    *   **Progress Charts:** Visualize actual score trends over time from the `test_attempts` table.
    *   **Performance Analysis:** Generate charts for subject and topic performance from `user_answers`.
    *   **Learning Streaks:** Dynamically calculate activity streaks from `test_attempts` timestamps.

#### **3.2. Core Feature Completion (High Priority)**

*   **Persistent "Mark for Review":** The feature must be fully functional.
    *   A student's choice to "Mark for Review" must be saved immediately to the database and persist across sessions.

*   **Live WYSIWYG Exam Editor for Admins:**
    *   The admin's content creation experience will be enhanced with a real-time WYSIWYG editor (e.g., Tiptap), showing a live preview as they type Markdown/KaTeX.

*   **Functional Settings Page:**
    *   User preferences (Dark Mode, etc.) must be saved to the database and applied correctly.
    *   The "Export Data" feature must allow users to download their results as CSV/JSON.

*   **Rule-Based Recommendation Engine:**
    *   The "AI" feature will be renamed "Personalized Recommendations."
    *   It will analyze a student's `user_answers` data to find the top 3 topics with the lowest scores and recommend relevant questions from the `Problem Bank`.

#### **3.3. Long-Term Vision & Future-Proofing (Low Priority Implementation)**

While implementation is deferred, the system architecture will be designed to support these future enhancements.

*   **AI-Powered Difficulty Assessment:**
    *   **Goal:** Replace the manually-set `difficulty` of a question with a predicted value from a machine learning model.
    *   **Method:** A classification model (e.g., Random Forest, XGBoost) will be trained on the 1443 official SAT questions and their known difficulties. The model will learn the relationship between text characteristics (word count, sentence complexity, etc.) and difficulty.
    *   **Outcome:** When a new question is added, its difficulty will be assessed automatically, removing all subjectivity from the scoring system.

*   **Dynamic Difficulty Recalibration:**
    *   **Goal:** Allow the platform's user data to refine and override the initial difficulty assessment.
    *   **Method:** As user data accumulates, the system will calculate the 'actual' difficulty of each question based on real-world 정답률 (P-value) and average solve time.

### **4. Non-Functional Requirements (v2.0)**

*   **Data Integrity & Authenticity (New Core Requirement):** This is the central tenet of v2.0. All user-facing scores, statistics, and analytics **must** be derived from real user data and the Intelligent Scoring Engine.
*   **Scalability & Interoperability:** The original requirement to export question data in the **QTI** standard format must be implemented.
*   *(Usability, Performance, Security requirements remain as in v1.0)*

---
