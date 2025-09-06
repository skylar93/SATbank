-- First, let's see what auto-imported exams we have
SELECT id, title, description 
FROM public.exams 
WHERE description ILIKE '%auto import%'
ORDER BY created_at DESC;

-- Create a function to delete all auto-imported exams and their related data
CREATE OR REPLACE FUNCTION public.delete_auto_imported_exams()
RETURNS TABLE(deleted_exam_id UUID, exam_title TEXT) AS $$
DECLARE
    exam_record RECORD;
    deleted_count INT := 0;
BEGIN
    -- For safety and feedback, we will log what we are doing.
    RAISE NOTICE 'Starting deletion process for all auto-imported exams...';

    -- Loop through each auto-imported exam
    FOR exam_record IN 
        SELECT id, title 
        FROM public.exams 
        WHERE description ILIKE '%auto import%'
    LOOP
        RAISE NOTICE 'Deleting exam: % (ID: %)', exam_record.title, exam_record.id;

        -- Step 1 & 5: Delete mistake bank entries and user answers for questions in this exam.
        -- This must be done before deleting the questions themselves.
        DELETE FROM public.mistake_bank 
        WHERE question_id IN (
            SELECT question_id 
            FROM public.exam_questions 
            WHERE exam_id = exam_record.id
        );
        
        DELETE FROM public.user_answers 
        WHERE question_id IN (
            SELECT question_id 
            FROM public.exam_questions 
            WHERE exam_id = exam_record.id
        );

        -- Step 2: Delete test attempts associated with this exam.
        DELETE FROM public.test_attempts 
        WHERE exam_id = exam_record.id;

        -- Step 3: Delete exam assignments associated with this exam.
        DELETE FROM public.exam_assignments 
        WHERE exam_id = exam_record.id;

        -- Step 6: Delete the questions themselves that are part of this exam.
        DELETE FROM public.questions 
        WHERE id IN (
            SELECT question_id 
            FROM public.exam_questions 
            WHERE exam_id = exam_record.id
        );

        -- Step 4: Delete the links in the junction table.
        DELETE FROM public.exam_questions 
        WHERE exam_id = exam_record.id;

        -- Step 7: Finally, delete the exam itself.
        DELETE FROM public.exams 
        WHERE id = exam_record.id;

        -- Return the deleted exam info
        deleted_exam_id := exam_record.id;
        exam_title := exam_record.title;
        deleted_count := deleted_count + 1;
        
        RETURN NEXT;
    END LOOP;

    RAISE NOTICE 'Deletion process completed. Total exams deleted: %', deleted_count;
END;
$$ LANGUAGE plpgsql;

-- To execute the deletion, run:
-- SELECT * FROM public.delete_auto_imported_exams();