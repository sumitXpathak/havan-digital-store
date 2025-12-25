-- Create OTP store table (replaces in-memory store)
CREATE TABLE public.otp_store (
  phone TEXT PRIMARY KEY,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create rate limits table
CREATE TABLE public.rate_limits (
  phone TEXT PRIMARY KEY,
  send_attempts INT DEFAULT 0,
  send_window_start TIMESTAMPTZ DEFAULT NOW(),
  verify_attempts INT DEFAULT 0,
  verify_window_start TIMESTAMPTZ DEFAULT NOW(),
  locked_until TIMESTAMPTZ
);

-- Create index for expired OTP cleanup
CREATE INDEX idx_otp_expires ON public.otp_store(expires_at);

-- Create index for locked accounts cleanup
CREATE INDEX idx_rate_limits_locked ON public.rate_limits(locked_until);

-- Enable RLS on both tables
ALTER TABLE public.otp_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access these tables (edge functions use service role key)
-- No policies = no access for regular users, only service role can access