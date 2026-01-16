import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://lovable.dev',
  'https://id-preview--6dc8c866-cca7-465a-9585-42b4a59780b3.lovable.app',
  'https://havan-store.lovable.app',
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

// Input validation functions
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function isValidPhone(phone: string): boolean {
  // Indian phone format: +91XXXXXXXXXX or 10 digits
  const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
  return phoneRegex.test(phone);
}

function validateOrderData(order_data: any): { valid: boolean; error?: string } {
  if (!order_data) return { valid: true }; // order_data is optional

  // Validate user_id
  if (!order_data.user_id || !isValidUUID(order_data.user_id)) {
    return { valid: false, error: "Invalid user_id format" };
  }

  // Validate phone
  if (!order_data.phone || !isValidPhone(order_data.phone)) {
    return { valid: false, error: "Invalid phone number format" };
  }

  // Validate total_amount
  if (typeof order_data.total_amount !== 'number' || order_data.total_amount <= 0 || order_data.total_amount > 10000000) {
    return { valid: false, error: "Invalid total_amount (must be positive number up to 10,000,000)" };
  }

  // Validate shipping_address
  if (order_data.shipping_address && (typeof order_data.shipping_address !== 'string' || order_data.shipping_address.length > 500)) {
    return { valid: false, error: "Shipping address too long (max 500 characters)" };
  }

  // Validate items array
  if (!Array.isArray(order_data.items) || order_data.items.length === 0 || order_data.items.length > 50) {
    return { valid: false, error: "Invalid items array (1-50 items required)" };
  }

  for (let i = 0; i < order_data.items.length; i++) {
    const item = order_data.items[i];
    if (!item.name || typeof item.name !== 'string' || item.name.length > 200) {
      return { valid: false, error: `Item ${i + 1}: name must be string (max 200 chars)` };
    }
    if (typeof item.price !== 'number' || item.price <= 0 || item.price > 10000000) {
      return { valid: false, error: `Item ${i + 1}: invalid price` };
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
      return { valid: false, error: `Item ${i + 1}: quantity must be integer 1-100` };
    }
  }

  return { valid: true };
}

// HMAC SHA256 verification
async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const message = `${orderId}|${paymentId}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const generatedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return generatedSignature === signature;
}

serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client for auth verification
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      order_data 
    } = await req.json();

    console.log("Verifying payment:", { razorpay_order_id, razorpay_payment_id });

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error("Missing required payment fields");
      return new Response(
        JSON.stringify({ error: "Missing payment details" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate order_data if provided
    const orderValidation = validateOrderData(order_data);
    if (!orderValidation.valid) {
      console.error("Order data validation failed:", orderValidation.error);
      return new Response(
        JSON.stringify({ error: orderValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CRITICAL: Verify the user_id in order_data matches the authenticated user
    if (order_data && order_data.user_id !== user.id) {
      console.error("User ID mismatch - authenticated:", user.id, "order:", order_data.user_id);
      return new Response(
        JSON.stringify({ error: "User ID mismatch - cannot create order for another user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_SECRET || !RAZORPAY_KEY_ID) {
      console.error("Razorpay credentials not configured");
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify signature
    const isValid = await verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      console.error("Invalid payment signature");
      return new Response(
        JSON.stringify({ error: "Payment verification failed", verified: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Payment signature verified:", razorpay_payment_id);

    // If order_data is provided, verify amount and save the order
    if (order_data) {
      // Fetch Razorpay order to verify amount matches
      const razorpayOrderResponse = await fetch(
        `https://api.razorpay.com/v1/orders/${razorpay_order_id}`,
        {
          headers: {
            "Authorization": `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
          },
        }
      );

      if (!razorpayOrderResponse.ok) {
        console.error("Failed to fetch Razorpay order details");
        return new Response(
          JSON.stringify({ error: "Failed to verify payment amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const razorpayOrder = await razorpayOrderResponse.json();
      const expectedAmountPaise = Math.round(order_data.total_amount * 100);

      if (razorpayOrder.amount !== expectedAmountPaise) {
        console.error("Amount mismatch - Razorpay:", razorpayOrder.amount, "Order:", expectedAmountPaise);
        return new Response(
          JSON.stringify({ error: "Payment amount does not match order total" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Amount verified:", razorpayOrder.amount, "paise");

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Sanitize items before storing
      const sanitizedItems = order_data.items.map((item: any) => ({
        id: item.id,
        name: String(item.name).substring(0, 200),
        price: Number(item.price),
        quantity: Math.min(100, Math.max(1, Math.floor(Number(item.quantity)))),
        image: item.image,
      }));

      const { data: orderResult, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id, // Use authenticated user's ID, not from request
          phone: order_data.phone,
          shipping_address: String(order_data.shipping_address || "").substring(0, 500),
          items: sanitizedItems,
          total_amount: order_data.total_amount,
          status: "confirmed",
        })
        .select()
        .single();

      if (orderError) {
        console.error("Error saving order:", orderError);
        return new Response(
          JSON.stringify({ 
            verified: true, 
            error: "Payment verified but order save failed",
            payment_id: razorpay_payment_id 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Order saved:", orderResult.id);

      // Send order notifications (email + SMS) - fire and forget
      const notificationUrl = `${supabaseUrl}/functions/v1/send-order-notification`;
      fetch(notificationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          order_id: orderResult.id,
        }),
      }).then((res) => {
        console.log("Notification sent, status:", res.status);
      }).catch((err) => {
        console.error("Notification error:", err);
      });

      return new Response(
        JSON.stringify({ 
          verified: true, 
          order_id: orderResult.id,
          payment_id: razorpay_payment_id 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ verified: true, payment_id: razorpay_payment_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifying payment:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
