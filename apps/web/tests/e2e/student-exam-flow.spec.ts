import { test, expect } from '@playwright/test'

test.describe('Student Exam Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/')
  })

  test('student can complete full exam flow from login to results', async ({
    page,
  }) => {
    // This test requires a seeded database with:
    // - A test student account (student@test.com / password123)
    // - An active exam assigned to the student

    // --- 1. Login Flow ---
    await page.goto('/login')

    // Fill login form
    await page.getByLabel(/email/i).fill('student@test.com')
    await page.getByLabel(/password/i).fill('password123')

    // Submit login
    await page.getByRole('button', { name: /log in/i }).click()

    // Wait for dashboard to load
    await expect(
      page.getByRole('heading', { name: /dashboard/i })
    ).toBeVisible()

    // --- 2. Navigate to Exams ---
    await page.getByRole('link', { name: /exams/i }).click()
    await expect(
      page.getByRole('heading', { name: /available exams/i })
    ).toBeVisible()

    // --- 3. Start Exam ---
    // Look for the first available exam and start it
    const examCard = page.locator('[data-testid="exam-card"]').first()
    await expect(examCard).toBeVisible()

    await examCard.getByRole('button', { name: /start exam/i }).click()

    // Confirm exam start on the exam start screen
    await expect(
      page.getByRole('heading', { name: /mock test/i })
    ).toBeVisible()
    await page.getByRole('button', { name: /start exam/i }).click()

    // --- 4. Answer Questions in First Module (English 1) ---
    await expect(page.getByText(/english reading and writing/i)).toBeVisible()

    // Answer questions in the first module
    const firstModuleQuestions = 27 // Typical SAT English 1 module

    for (
      let questionNum = 1;
      questionNum <= firstModuleQuestions;
      questionNum++
    ) {
      // Wait for question to load
      await expect(page.locator('[data-testid="question-text"]')).toBeVisible()

      // Select the first answer choice (for testing purposes)
      const firstOption = page.locator('input[type="radio"]').first()
      await firstOption.check()

      // Navigate to next question or module
      if (questionNum === firstModuleQuestions) {
        // Last question of module - click "Next Module"
        await page.getByRole('button', { name: /next module/i }).click()
        break
      } else {
        // Regular question - click "Next"
        await page.getByRole('button', { name: /next/i }).click()
      }
    }

    // --- 5. Continue with English 2 Module ---
    await expect(page.getByText(/english reading and writing/i)).toBeVisible()

    // Answer questions in the second English module
    for (
      let questionNum = 1;
      questionNum <= firstModuleQuestions;
      questionNum++
    ) {
      await expect(page.locator('[data-testid="question-text"]')).toBeVisible()

      const firstOption = page.locator('input[type="radio"]').first()
      await firstOption.check()

      if (questionNum === firstModuleQuestions) {
        await page.getByRole('button', { name: /next module/i }).click()
        break
      } else {
        await page.getByRole('button', { name: /next/i }).click()
      }
    }

    // --- 6. Continue with Math 1 Module ---
    await expect(page.getByText(/math/i)).toBeVisible()

    const mathQuestions = 22 // Typical SAT Math module

    for (let questionNum = 1; questionNum <= mathQuestions; questionNum++) {
      await expect(page.locator('[data-testid="question-text"]')).toBeVisible()

      // Handle both multiple choice and grid-in questions
      const multipleChoice = page.locator('input[type="radio"]').first()
      const gridInInput = page.locator('input[data-testid="grid-in-answer"]')

      if (await multipleChoice.isVisible()) {
        // Multiple choice question
        await multipleChoice.check()
      } else if (await gridInInput.isVisible()) {
        // Grid-in question
        await gridInInput.fill('42')
      }

      if (questionNum === mathQuestions) {
        await page.getByRole('button', { name: /next module/i }).click()
        break
      } else {
        await page.getByRole('button', { name: /next/i }).click()
      }
    }

    // --- 7. Complete Math 2 Module ---
    await expect(page.getByText(/math/i)).toBeVisible()

    for (let questionNum = 1; questionNum <= mathQuestions; questionNum++) {
      await expect(page.locator('[data-testid="question-text"]')).toBeVisible()

      const multipleChoice = page.locator('input[type="radio"]').first()
      const gridInInput = page.locator('input[data-testid="grid-in-answer"]')

      if (await multipleChoice.isVisible()) {
        await multipleChoice.check()
      } else if (await gridInInput.isVisible()) {
        await gridInInput.fill('42')
      }

      if (questionNum === mathQuestions) {
        // Final question - submit exam
        await page.getByRole('button', { name: /submit exam/i }).click()

        // Confirm submission in modal if present
        const confirmButton = page.getByRole('button', {
          name: /confirm|submit/i,
        })
        if (await confirmButton.isVisible()) {
          await confirmButton.click()
        }
        break
      } else {
        await page.getByRole('button', { name: /next/i }).click()
      }
    }

    // --- 8. Verify Results Page ---
    // Wait for results to be calculated and displayed
    await expect(page.getByRole('heading', { name: /results/i })).toBeVisible({
      timeout: 15000,
    })

    // Verify score components are displayed
    await expect(page.getByText(/total score/i)).toBeVisible()
    await expect(page.getByText(/english/i)).toBeVisible()
    await expect(page.getByText(/math/i)).toBeVisible()

    // Verify score values are present (scores should be numbers)
    const totalScore = page.locator('[data-testid="total-score"]')
    const englishScore = page.locator('[data-testid="english-score"]')
    const mathScore = page.locator('[data-testid="math-score"]')

    await expect(totalScore).toBeVisible()
    await expect(englishScore).toBeVisible()
    await expect(mathScore).toBeVisible()

    // Verify scores are reasonable (between 200-800 for each section, 400-1600 total)
    const totalScoreText = await totalScore.textContent()
    const totalScoreNumber = parseInt(totalScoreText?.match(/\d+/)?.[0] || '0')
    expect(totalScoreNumber).toBeGreaterThanOrEqual(400)
    expect(totalScoreNumber).toBeLessThanOrEqual(1600)

    // --- 9. Navigate to Detailed Review (Optional) ---
    const reviewButton = page.getByRole('button', { name: /review answers/i })
    if (await reviewButton.isVisible()) {
      await reviewButton.click()

      // Verify review page loads
      await expect(page.getByRole('heading', { name: /review/i })).toBeVisible()

      // Verify questions are displayed with answers
      await expect(
        page.locator('[data-testid="question-review"]').first()
      ).toBeVisible()
    }
  })

  test('student can pause and resume exam', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('student@test.com')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /log in/i }).click()

    // Start exam
    await page.getByRole('link', { name: /exams/i }).click()
    const examCard = page.locator('[data-testid="exam-card"]').first()
    await examCard.getByRole('button', { name: /start exam/i }).click()
    await page.getByRole('button', { name: /start exam/i }).click()

    // Answer a few questions
    for (let i = 1; i <= 3; i++) {
      await expect(page.locator('[data-testid="question-text"]')).toBeVisible()
      const firstOption = page.locator('input[type="radio"]').first()
      await firstOption.check()

      if (i < 3) {
        await page.getByRole('button', { name: /next/i }).click()
      }
    }

    // Navigate away (simulating browser close/navigation)
    await page.goto('/student/dashboard')

    // Return to exam - should show continuation option
    await page.getByRole('link', { name: /exams/i }).click()

    // Should see option to continue existing attempt
    const continueButton = page.getByRole('button', { name: /continue/i })
    if (await continueButton.isVisible()) {
      await continueButton.click()

      // Should be back in the exam at question 3
      await expect(page.locator('[data-testid="question-text"]')).toBeVisible()

      // Verify the previously selected answer is still there
      const selectedOption = page.locator('input[type="radio"]:checked')
      await expect(selectedOption).toBeVisible()
    }
  })

  test('exam timer functionality works correctly', async ({ page }) => {
    // This test verifies that the timer displays and counts down
    // Note: We won't test actual time expiration as it would take too long

    await page.goto('/login')
    await page.getByLabel(/email/i).fill('student@test.com')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /log in/i }).click()

    await page.getByRole('link', { name: /exams/i }).click()
    const examCard = page.locator('[data-testid="exam-card"]').first()
    await examCard.getByRole('button', { name: /start exam/i }).click()
    await page.getByRole('button', { name: /start exam/i }).click()

    // Verify timer is visible and showing time
    const timer = page.locator('[data-testid="exam-timer"]')
    await expect(timer).toBeVisible()

    // Timer should show a reasonable time (e.g., 35:00 for 35-minute module)
    const timerText = await timer.textContent()
    expect(timerText).toMatch(/\d{1,2}:\d{2}/)

    // Wait a few seconds and verify timer is counting down
    await page.waitForTimeout(3000)
    const updatedTimerText = await timer.textContent()
    expect(updatedTimerText).not.toBe(timerText) // Should have changed
  })
})
