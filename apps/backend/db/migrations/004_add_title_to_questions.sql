-- Add title column to questions table
ALTER TABLE questions ADD COLUMN title VARCHAR(255) NOT NULL AFTER id;