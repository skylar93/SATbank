/**
 * Spaced Repetition System (SRS) Configuration
 * 
 * These constants define the behavior of the SRS algorithm used for vocabulary learning.
 * Adjusting these values will affect how the system schedules reviews and tracks mastery.
 */
export const srsConfig = {
  /**
   * The initial interval (in days) for reviewing a new word
   */
  INITIAL_INTERVAL_DAYS: 1,

  /**
   * Multiplier applied to the review interval when a word is answered correctly
   */
  INTERVAL_MULTIPLIER: 2,

  /**
   * Maximum mastery level a word can reach
   */
  MASTERY_LEVEL_MAX: 5,

  /**
   * Minimum mastery level (starting point for new words)
   */
  MASTERY_LEVEL_MIN: 0,

  /**
   * Review interval (in days) when a word is answered incorrectly
   */
  INCORRECT_RESET_INTERVAL_DAYS: 1,

  /**
   * Time delay (in minutes) before showing an incorrectly answered word again in the same session
   */
  INCORRECT_NEXT_REVIEW_MINUTES: 10,

  /**
   * Maximum review interval (in days) to prevent words from being scheduled too far in the future
   */
  MAX_REVIEW_INTERVAL_DAYS: 365,
} as const

/**
 * Quiz configuration
 */
export const quizConfig = {
  /**
   * Default number of questions in a quiz session
   */
  DEFAULT_QUESTION_COUNT: 20,

  /**
   * Maximum number of questions allowed in a single quiz
   */
  MAX_QUESTION_COUNT: 100,

  /**
   * Minimum number of questions required for a valid quiz
   */
  MIN_QUESTION_COUNT: 5,
} as const

/**
 * Database configuration
 */
export const dbConfig = {
  /**
   * Maximum number of items to process in a single batch operation
   */
  MAX_BATCH_SIZE: 1000,

  /**
   * Default page size for paginated queries
   */
  DEFAULT_PAGE_SIZE: 50,
} as const