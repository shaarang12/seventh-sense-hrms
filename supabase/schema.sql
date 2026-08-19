-- Create laborers table
CREATE TABLE public.laborers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    wage_type TEXT CHECK (wage_type IN ('daily', 'hourly', 'monthly')) NOT NULL,
    rate_value NUMERIC NOT NULL,
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sl_balance NUMERIC NOT NULL DEFAULT 12,
    cl_balance NUMERIC NOT NULL DEFAULT 8,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create attendance table
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    laborer_id UUID REFERENCES public.laborers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT CHECK (status IN ('present', 'absent', 'half_day', 'sl', 'cl', 'holiday')) NOT NULL,
    overtime_hours NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(laborer_id, date)
);

-- Create holidays table
CREATE TABLE public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create allowances table
CREATE TABLE public.allowances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    laborer_id UUID REFERENCES public.laborers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Setup Row Level Security (RLS)
-- Since this is an internal admin app, we can either disable RLS or write simple policies allowing authenticated users.
-- For simplicity, we'll allow all operations to authenticated users.

ALTER TABLE public.laborers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to authenticated users on laborers"
    ON public.laborers
    FOR ALL
    TO authenticated
    USING (true);

CREATE POLICY "Allow full access to authenticated users on attendance"
    ON public.attendance
    FOR ALL
    TO authenticated
    USING (true);

CREATE POLICY "Allow full access to authenticated users on holidays"
    ON public.holidays
    FOR ALL
    TO authenticated
    USING (true);

CREATE POLICY "Allow full access to authenticated users on allowances"
    ON public.allowances
    FOR ALL
    TO authenticated
    USING (true);
