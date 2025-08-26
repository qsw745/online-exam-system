-- Add knowledge_points column to questions table
ALTER TABLE questions ADD COLUMN knowledge_points JSON AFTER explanation;