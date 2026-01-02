import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://lovable.dev',
  'https://id-preview--jxbgvwvsbamxfeekofjz.lovable.app',
  'https://jxbgvwvsbamxfeekofjz.lovable.app',
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

// Validation constants
const MIN_AMOUNT = 1; // Minimum ₹1
const MAX_AMOUNT = 10000000; // Maximum ₹1 crore

serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("Invalid authentication:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    const { amount, currency = "INR", receipt, notes } = await req.json();

    console.log("Creating Razorpay order:", { amount, currency, receipt, userId: user.id });

    // Validate amount - must be a number within range
    if (typeof amount !== 'number' || isNaN(amount)) {
      console.error("Amount is not a valid number:", amount);
      return new Response(
        JSON.stringify({ error: "Amount must be a valid number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (amount < MIN_AMOUNT) {
      console.error("Amount below minimum:", amount);
      return new Response(
        JSON.stringify({ error: `Minimum order amount is ₹${MIN_AMOUNT}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (amount > MAX_AMOUNT) {
      console.error("Amount exceeds maximum:", amount);
      return new Response(
        JSON.stringify({ error: `Maximum order amount is ₹${MAX_AMOUNT.toLocaleString()}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("Razorpay credentials not configured");
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Razorpay order
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    
    // Sanitize receipt to prevent injection
    const sanitizedReceipt = receipt 
      ? String(receipt).substring(0, 40).replace(/[^a-zA-Z0-9_-]/g, '')
      : `receipt_${Date.now()}`;
    
    const orderData = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency === "INR" ? "INR" : "INR", // Only allow INR
      receipt: sanitizedReceipt,
      notes: { 
        user_id: user.id,
        // Sanitize notes if provided
        ...(notes?.phone ? { phone: String(notes.phone).substring(0, 15) } : {}),
      },
    };

    console.log("Sending to Razorpay:", orderData);

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });

    const order = await response.json();

    if (!response.ok) {
      console.error("Razorpay API error:", order);
      return new Response(
        JSON.stringify({ error: order.error?.description || "Failed to create order" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Razorpay order created:", order.id);

    return new Response(
      JSON.stringify({ 
        orderId: order.id, 
        amount: order.amount,
        currency: order.currency,
        keyId: RAZORPAY_KEY_ID 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
