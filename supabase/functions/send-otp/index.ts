import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://lovable.dev',
  'https://id-preview--jxbgvwvsbamxfeekofjz.lovable.app',
  'https://jxbgvwvsbamxfeekofjz.lovable.app',
  'https://havan-store.site',
  'https://www.havan-store.site',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(origin: string) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rate limiting config
const MAX_SEND_ATTEMPTS = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone number format (Indian format: +91XXXXXXXXXX)
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid Indian phone number (+91XXXXXXXXXX)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check rate limits
    const { data: rateLimit } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('phone', phone)
      .single();

    // Check if locked
    if (rateLimit?.locked_until && new Date(rateLimit.locked_until) > new Date()) {
      const lockedUntil = new Date(rateLimit.locked_until);
      const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      return new Response(
        JSON.stringify({ error: `Too many attempts. Please try again in ${minutesLeft} minutes.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check send rate limit
    if (rateLimit?.send_attempts >= MAX_SEND_ATTEMPTS) {
      const windowAge = Date.now() - new Date(rateLimit.send_window_start).getTime();
      if (windowAge < SEND_WINDOW_MS) {
        const minutesLeft = Math.ceil((SEND_WINDOW_MS - windowAge) / 60000);
        return new Response(
          JSON.stringify({ error: `Too many OTP requests. Please wait ${minutesLeft} minutes.` }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Reset window
      await supabase
        .from('rate_limits')
        .update({ send_attempts: 0, send_window_start: new Date().toISOString() })
        .eq('phone', phone);
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Store OTP in database (upsert to handle existing entries)
    const { error: otpError } = await supabase
      .from('otp_store')
      .upsert({
        phone,
        otp,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        created_at: new Date().toISOString(),
      });

    if (otpError) {
      console.error("Error storing OTP:", otpError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update rate limit counter
    const { error: rateLimitError } = await supabase
      .from('rate_limits')
      .upsert({
        phone,
        send_attempts: (rateLimit?.send_attempts || 0) + 1,
        send_window_start: rateLimit?.send_window_start || new Date().toISOString(),
        verify_attempts: rateLimit?.verify_attempts || 0,
        verify_window_start: rateLimit?.verify_window_start || new Date().toISOString(),
      });

    if (rateLimitError) {
      console.error("Error updating rate limit:", rateLimitError);
    }

    console.log(`Sending OTP to ${phone}`);

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: TWILIO_PHONE_NUMBER!,
        Body: `Your Sanatan Puja Path verification code is: ${otp}. Valid for 5 minutes.`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Twilio error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to send OTP. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`OTP sent successfully to ${phone}`);

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
