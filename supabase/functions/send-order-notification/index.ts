import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface OrderNotificationRequest {
  phone: string;
  email?: string;
  order_id: string;
  items: OrderItem[];
  total_amount: number;
  shipping_address: string;
}

const sendSMS = async (phone: string, message: string) => {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !twilioPhone) {
    console.log("Twilio credentials not configured, skipping SMS");
    return null;
  }

  // Format phone number to E.164
  let formattedPhone = phone.replace(/\D/g, "");
  if (!formattedPhone.startsWith("91")) {
    formattedPhone = "91" + formattedPhone;
  }
  formattedPhone = "+" + formattedPhone;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = btoa(`${accountSid}:${authToken}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: twilioPhone,
        Body: message,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error("Twilio error:", result);
      return { error: result.message };
    }

    console.log("SMS sent successfully:", result.sid);
    return { success: true, sid: result.sid };
  } catch (err: unknown) {
    const error = err as Error;
    console.error("SMS send error:", error);
    return { error: error.message };
  }
};

const sendEmail = async (
  email: string,
  orderId: string,
  items: OrderItem[],
  totalAmount: number,
  shippingAddress: string
) => {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendApiKey) {
    console.log("Resend API key not configured, skipping email");
    return null;
  }

  const resend = new Resend(resendApiKey);

  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price.toLocaleString()}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `
    )
    .join("");

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #f97316; margin: 0;">꧁•श्री•SANATAN•꧂</h1>
          <p style="color: #666; margin-top: 8px;">Puja Samagri Store</p>
        </div>
        
        <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
          <h2 style="color: #16a34a; margin: 0 0 8px 0; font-size: 18px;">✓ Order Confirmed!</h2>
          <p style="margin: 0; color: #333;">Thank you for your order. We're preparing it for shipment.</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <p style="margin: 0 0 8px 0;"><strong>Order ID:</strong> #${orderId.slice(0, 8).toUpperCase()}</p>
          <p style="margin: 0;"><strong>Order Date:</strong> ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f97316; color: white;">
              <th style="padding: 12px; text-align: left;">Item</th>
              <th style="padding: 12px; text-align: center;">Qty</th>
              <th style="padding: 12px; text-align: right;">Price</th>
              <th style="padding: 12px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold;">Grand Total:</td>
              <td style="padding: 12px; text-align: right; font-weight: bold; color: #f97316;">₹${totalAmount.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
        
        <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
          <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 14px;">Shipping Address</h3>
          <p style="margin: 0; color: #333;">${shippingAddress}</p>
        </div>
        
        <div style="text-align: center; color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="margin: 0 0 8px 0;">Questions about your order?</p>
          <p style="margin: 0;">Contact us at support@shrisanatan.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const emailResponse = await resend.emails.send({
      from: "श्री Sanatan <onboarding@resend.dev>",
      to: [email],
      subject: `Order Confirmed! #${orderId.slice(0, 8).toUpperCase()}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);
    return { success: true, response: emailResponse };
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Email send error:", error);
    return { error: error.message };
  }
};

serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      phone,
      email,
      order_id,
      items,
      total_amount,
      shipping_address,
    }: OrderNotificationRequest = await req.json();

    console.log("Sending order notifications for:", order_id);

    const results: { sms?: any; email?: any } = {};

    // Send SMS notification
    const smsMessage = `🙏 नमस्ते! Your order #${order_id.slice(0, 8).toUpperCase()} has been confirmed! Total: ₹${total_amount.toLocaleString()}. Thank you for shopping with श्री Sanatan.`;
    results.sms = await sendSMS(phone, smsMessage);

    // Send email notification if email is provided
    if (email) {
      results.email = await sendEmail(email, order_id, items, total_amount, shipping_address);
    }

    console.log("Notification results:", results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Notification error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
