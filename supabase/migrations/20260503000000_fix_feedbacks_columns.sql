
-- Add missing columns to feedbacks table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feedbacks' AND column_name='message') THEN
        ALTER TABLE public.feedbacks ADD COLUMN message TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feedbacks' AND column_name='name') THEN
        ALTER TABLE public.feedbacks ADD COLUMN name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feedbacks' AND column_name='phone') THEN
        ALTER TABLE public.feedbacks ADD COLUMN phone TEXT;
    END IF;
END $$;
