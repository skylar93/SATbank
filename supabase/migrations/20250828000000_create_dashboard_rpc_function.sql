-- Create RPC function to consolidate student dashboard data
CREATE OR REPLACE FUNCTION get_student_dashboard_data(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result_data JSON;
  overall_stats JSON;
  score_history JSON;
  recent_attempts JSON;
  previous_month_stats JSON;
  activity_days JSON;
  weekly_activity JSON;
  subject_scores JSON;
BEGIN
  -- Get overall stats (examsTaken, bestScore, averageScore)
  WITH completed_attempts AS (
    SELECT 
      ta.final_scores,
      ta.total_score,
      ta.completed_at
    FROM test_attempts ta
    WHERE ta.user_id = p_user_id 
      AND ta.status = 'completed'
  )
  SELECT json_build_object(
    'examsTaken', COALESCE(COUNT(*), 0),
    'bestScore', COALESCE(MAX(
      CASE 
        WHEN final_scores ? 'overall' THEN (final_scores->>'overall')::integer
        ELSE total_score
      END
    ), NULL),
    'averageScore', COALESCE(ROUND(AVG(
      CASE 
        WHEN final_scores ? 'overall' THEN (final_scores->>'overall')::integer
        ELSE total_score
      END
    )), NULL)
  ) INTO overall_stats
  FROM completed_attempts;

  -- Get score history (last 10 scores with dates)
  WITH score_data AS (
    SELECT 
      ta.completed_at::date as date,
      CASE 
        WHEN ta.final_scores ? 'overall' THEN (ta.final_scores->>'overall')::integer
        ELSE ta.total_score
      END as score
    FROM test_attempts ta
    WHERE ta.user_id = p_user_id 
      AND ta.status = 'completed'
      AND ta.completed_at IS NOT NULL
    ORDER BY ta.completed_at DESC
    LIMIT 10
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'date', date::text,
      'score', score
    ) ORDER BY date
  ), '[]'::json) INTO score_history
  FROM score_data;

  -- Get recent attempts (last 5)
  WITH recent_data AS (
    SELECT 
      ta.id,
      ta.exam_id,
      ta.status,
      ta.created_at,
      ta.started_at,
      ta.completed_at,
      ta.final_scores,
      ta.total_score
    FROM test_attempts ta
    WHERE ta.user_id = p_user_id 
      AND ta.status IN ('completed', 'in_progress')
    ORDER BY 
      CASE WHEN ta.status = 'completed' THEN 0 ELSE 1 END,
      ta.created_at DESC
    LIMIT 5
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', id,
      'exam_id', exam_id,
      'status', status,
      'created_at', created_at,
      'started_at', started_at,
      'completed_at', completed_at,
      'final_scores', final_scores,
      'total_score', total_score
    ) ORDER BY 
      CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
      created_at DESC
  ), '[]'::json) INTO recent_attempts
  FROM recent_data;

  -- Get previous month stats
  WITH prev_month_data AS (
    SELECT 
      ta.final_scores,
      ta.total_score
    FROM test_attempts ta
    WHERE ta.user_id = p_user_id 
      AND ta.status = 'completed'
      AND ta.completed_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      AND ta.completed_at < DATE_TRUNC('month', CURRENT_DATE)
  )
  SELECT json_build_object(
    'examsTaken', COALESCE(COUNT(*), 0),
    'bestScore', COALESCE(MAX(
      CASE 
        WHEN final_scores ? 'overall' THEN (final_scores->>'overall')::integer
        ELSE total_score
      END
    ), NULL),
    'averageScore', COALESCE(ROUND(AVG(
      CASE 
        WHEN final_scores ? 'overall' THEN (final_scores->>'overall')::integer
        ELSE total_score
      END
    )), NULL)
  ) INTO previous_month_stats
  FROM prev_month_data;

  -- Get activity days (last 30 days)
  WITH activity_data AS (
    SELECT DISTINCT ta.completed_at::date as activity_date
    FROM test_attempts ta
    WHERE ta.user_id = p_user_id
      AND (ta.completed_at IS NOT NULL OR ta.started_at IS NOT NULL)
      AND COALESCE(ta.completed_at, ta.started_at) >= CURRENT_DATE - INTERVAL '30 days'
    UNION
    SELECT DISTINCT ta.started_at::date as activity_date
    FROM test_attempts ta
    WHERE ta.user_id = p_user_id
      AND ta.started_at IS NOT NULL
      AND ta.started_at >= CURRENT_DATE - INTERVAL '30 days'
  )
  SELECT COALESCE(json_agg(activity_date::text ORDER BY activity_date), '[]'::json) 
  INTO activity_days
  FROM activity_data;

  -- Get weekly activity data (mock data for now - can be enhanced later)
  SELECT json_build_object(
    'days', json_build_array('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'),
    'studyTime', json_build_array(0, 0, 0, 0, 0, 0, 0),
    'practiceTests', json_build_array(0, 0, 0, 0, 0, 0, 0)
  ) INTO weekly_activity;

  -- Get subject scores from most recent completed attempt
  WITH latest_attempt AS (
    SELECT ta.id, ta.final_scores
    FROM test_attempts ta
    WHERE ta.user_id = p_user_id 
      AND ta.status = 'completed'
      AND ta.final_scores IS NOT NULL
    ORDER BY ta.completed_at DESC
    LIMIT 1
  )
  SELECT 
    CASE 
      WHEN la.final_scores ? 'english' AND la.final_scores ? 'math' THEN
        json_build_object(
          'reading', ROUND((la.final_scores->>'english')::numeric / 2),
          'writing', ROUND((la.final_scores->>'english')::numeric / 2),
          'math', (la.final_scores->>'math')::integer
        )
      ELSE
        json_build_object(
          'reading', 0,
          'writing', 0,
          'math', 0
        )
    END INTO subject_scores
  FROM latest_attempt la;

  -- If no subject scores found, default to zeros
  IF subject_scores IS NULL THEN
    SELECT json_build_object(
      'reading', 0,
      'writing', 0,
      'math', 0
    ) INTO subject_scores;
  END IF;

  -- Combine all data into final result
  SELECT json_build_object(
    'overallStats', overall_stats,
    'scoreHistory', score_history,
    'recentAttempts', recent_attempts,
    'previousMonthStats', previous_month_stats,
    'activityDays', activity_days,
    'weeklyActivity', weekly_activity,
    'subjectScores', subject_scores
  ) INTO result_data;

  RETURN result_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_student_dashboard_data(UUID) TO authenticated;