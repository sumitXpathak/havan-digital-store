import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory OTP store (shared with send-otp in production, use Redis or database)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const storedData = otpStore.get(phone);

    if (!storedData) {
      return new Response(
        JSON.stringify({ error: "OTP expired or not found. Please request a new OTP." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(phone);
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new OTP." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (storedData.otp !== otp) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // OTP is valid, clear it
    otpStore.delete(phone);

    // Create or sign in user using Supabase Admin
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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
      // User exists, generate magic link token for sign in
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

      // Return user session info
      return new Response(
        JSON.stringify({ 
          success: true, 
          isNewUser: false,
          userId: existingUser.id,
          token: signInData.properties?.hashed_token,
          actionLink: signInData.properties?.action_link,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Create new user
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

      // Generate sign in link for new user
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
          isNewUser: true,
          userId: newUser.user.id,
          token: signInData.properties?.hashed_token,
          actionLink: signInData.properties?.action_link,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Error in verify-otp function:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Export for send-otp to share store
export { otpStore };
