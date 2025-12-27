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
    const generatedEmail = `${phone.replace("+", "")}@phone.auth`;
    
    // Get all users
    const { data: userList, error: listError } = await supabase.auth.admin.listUsers({
      perPage: 1000
    });
    
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Authentication failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Searching for user with phone: ${phone} or email: ${generatedEmail}`);
    console.log(`Total users found: ${userList?.users?.length || 0}`);
    
    // Find user by phone (exact match or with/without +) or by generated email
    const existingUser = userList?.users?.find(u => {
      const phoneMatch = u.phone === phone || 
                         u.phone === phone.replace("+", "") ||
                         `+${u.phone}` === phone;
      const emailMatch = u.email === generatedEmail;
      
      if (phoneMatch || emailMatch) {
        console.log(`Found user match: ${u.id}, phone: ${u.phone}, email: ${u.email}`);
      }
      
      return phoneMatch || emailMatch;
    });

    if (existingUser) {
      console.log(`Found existing user: ${existingUser.id}`);
      const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: existingUser.email || generatedEmail,
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
      console.log(`Creating new user with phone: ${phone}`);
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        phone,
        email: generatedEmail,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          full_name: fullName || "",
          phone,
        },
      });

      if (createError) {
        console.error("Create user error:", createError);
        
        // If phone exists error, try to find user again and sign in
        if (createError.message?.includes('phone_exists') || createError.message?.includes('Phone number already') || (createError as any).code === 'phone_exists') {
          console.log("Phone exists, trying to find and sign in user...");
          const { data: retryUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          
          // More flexible matching
          const retryUser = retryUsers?.users.find(u => {
            const phoneMatch = u.phone === phone || 
                               u.phone === phone.replace("+", "") ||
                               `+${u.phone}` === phone;
            const emailMatch = u.email === generatedEmail;
            return phoneMatch || emailMatch;
          });
          
          console.log(`Retry found user: ${retryUser?.id || 'not found'}`);
          
          if (retryUser) {
            const { data: signInData } = await supabase.auth.admin.generateLink({
              type: "magiclink",
              email: retryUser.email || generatedEmail,
            });
            
            return new Response(
              JSON.stringify({ 
                success: true, 
                userId: retryUser.id,
                token: signInData?.properties?.hashed_token,
                actionLink: signInData?.properties?.action_link,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to create account. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: generatedEmail,
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
