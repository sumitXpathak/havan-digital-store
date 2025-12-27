import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rate limiting config
const MAX_VERIFY_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, otp, fullName } = await req.json();

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: "Phone number and OTP are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verifying OTP for ${phone}`);

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check rate limits first
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
        JSON.stringify({ error: `Too many failed attempts. Please try again in ${minutesLeft} minutes.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get stored OTP from database
    const { data: storedData, error: fetchError } = await supabase
      .from('otp_store')
      .select('*')
      .eq('phone', phone)
      .single();

    if (fetchError || !storedData) {
      return new Response(
        JSON.stringify({ error: "OTP expired or not found. Please request a new OTP." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if OTP expired
    if (new Date() > new Date(storedData.expires_at)) {
      await supabase.from('otp_store').delete().eq('phone', phone);
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new OTP." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max attempts on this OTP
    if (storedData.attempts >= MAX_VERIFY_ATTEMPTS) {
      await supabase
        .from('rate_limits')
        .upsert({
          phone,
          locked_until: new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString(),
          verify_attempts: storedData.attempts,
          verify_window_start: new Date().toISOString(),
          send_attempts: rateLimit?.send_attempts || 0,
          send_window_start: rateLimit?.send_window_start || new Date().toISOString(),
        });
      
      await supabase.from('otp_store').delete().eq('phone', phone);

      return new Response(
        JSON.stringify({ error: "Too many failed attempts. Please try again in 15 minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if OTP matches
    if (storedData.otp !== otp) {
      await supabase
        .from('otp_store')
        .update({ attempts: storedData.attempts + 1 })
        .eq('phone', phone);

      const remainingAttempts = MAX_VERIFY_ATTEMPTS - storedData.attempts - 1;
      return new Response(
        JSON.stringify({ error: `Invalid OTP. ${remainingAttempts} attempts remaining.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // OTP is valid, delete it and clear rate limits
    await supabase.from('otp_store').delete().eq('phone', phone);
    await supabase
      .from('rate_limits')
      .update({ 
        verify_attempts: 0, 
        send_attempts: 0,
        locked_until: null 
      })
      .eq('phone', phone);

    // Check if user exists with this phone
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Authentication failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existingUser = existingUsers.users.find(u => u.phone === phone);

    if (existingUser) {
      const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: existingUser.email || `${phone.replace("+", "")}@phone.auth`,
      });

      if (signInError) {
        console.error("Sign in error:", signInError);
        return new Response(
          JSON.stringify({ error: "Failed to sign in. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: existingUser.id,
          token: signInData.properties?.hashed_token,
          actionLink: signInData.properties?.action_link,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const email = `${phone.replace("+", "")}@phone.auth`;
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        phone,
        email,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          full_name: fullName || "",
          phone,
        },
      });

      if (createError) {
        console.error("Create user error:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create account. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (signInError) {
        console.error("Sign in new user error:", signInError);
        return new Response(
          JSON.stringify({ error: "Account created but failed to sign in." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: newUser.user.id,
          token: signInData.properties?.hashed_token,
          actionLink: signInData.properties?.action_link,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
