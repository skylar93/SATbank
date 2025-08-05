-- Add show_results column to exam_assignments table (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exam_assignments' 
        AND column_name = 'show_results'
    ) THEN
        ALTER TABLE exam_assignments 
        ADD COLUMN show_results BOOLEAN DEFAULT true;
        
        -- Add comment for the new column
        COMMENT ON COLUMN exam_assignments.show_results IS 'Controls whether students can see their results after completing the exam. Defaults to true for backward compatibility.';
    END IF;
END $$;