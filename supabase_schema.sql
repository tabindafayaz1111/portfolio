-- SQL Schema for Portfolio Analytics System
-- Run this script in the Supabase SQL Editor to set up your tables and policies.

-- 1. Create visitors table to track active sessions
CREATE TABLE IF NOT EXISTS public.visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR UNIQUE NOT NULL,
    ip_address VARCHAR,
    country VARCHAR,
    city VARCHAR,
    region VARCHAR,
    latitude NUMERIC,
    longitude NUMERIC,
    browser VARCHAR,
    browser_version VARCHAR,
    operating_system VARCHAR,
    device_type VARCHAR,
    screen_resolution VARCHAR,
    language VARCHAR,
    timezone VARCHAR,
    referrer TEXT,
    current_page TEXT,
    landing_page TEXT,
    visit_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    session_duration INTEGER DEFAULT 0,
    pages_visited JSONB DEFAULT '[]'::jsonb,
    resume_downloaded INTEGER DEFAULT 0,
    contact_form_submitted BOOLEAN DEFAULT false,
    project_clicked JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create visitor_events table for granular visitor timelines
CREATE TABLE IF NOT EXISTS public.visitor_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR REFERENCES public.visitors(session_id) ON DELETE CASCADE,
    event_type VARCHAR NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;

-- 4. Set up security policies for dashboard reading
-- Allow authenticated administrators (logged in via Supabase Auth) to view records
CREATE POLICY "Allow authenticated users select access on visitors" 
ON public.visitors 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users select access on visitor_events" 
ON public.visitor_events 
FOR SELECT 
TO authenticated 
USING (true);

-- Note: The serverless tracking API route uses the Supabase Service Role key,
-- which automatically bypasses RLS rules to write and update visitor records securely.

-- 5. Enable Supabase Realtime for live dashboard updates
-- This allows the admin panel to listen to postgres insert and update notifications instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.visitors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_events;

-- 6. Add performance indexes for smooth sorting and querying
CREATE INDEX IF NOT EXISTS idx_visitors_visit_time ON public.visitors(visit_time);
CREATE INDEX IF NOT EXISTS idx_visitor_events_session_id ON public.visitor_events(session_id);
