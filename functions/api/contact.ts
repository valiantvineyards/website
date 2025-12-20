import { francAll } from "franc-min";

interface Env {
  RESEND_API_KEY: string;
  MAILCHIMP_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

interface ResendResponse {
  id?: string;
  message?: string;
}

interface FormData {
  name: string;
  email: string;
  phone?: string;
  message: string;
  subscribe?: string;
  "cf-turnstile-response"?: string;
}

// Email configuration
const EMAIL_CONFIG = {
  from: "Valiant Vineyards Winery & Distillery <noreply@valiantvineyards.us>",
  to: ["wine@valiantvineyards.us"],
  cc: ["sherry@valiantvineyards.us", "adrienne@valiantvineyards.us", "valiantvineyards@proton.me"],
  subject: "Valiant Vineyards website message",
};

// Mailchimp configuration
const MAILCHIMP_CONFIG = {
  listId: "b25550092c",
  dataCenter: "us21",
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // CORS headers for the response
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse form data
    const formData = await request.formData();
    const data: FormData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string | undefined,
      message: formData.get("message") as string,
      subscribe: formData.get("subscribe") as string | undefined,
      "cf-turnstile-response": formData.get("cf-turnstile-response") as string,
    };

    // Validate required fields
    if (!data.name || !data.email || !data.message) {
      return Response.json(
        { success: false, error: "Please fill in all required fields." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return Response.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate Turnstile token
    const turnstileToken = data["cf-turnstile-response"];
    if (!turnstileToken) {
      return Response.json(
        { success: false, error: "Please complete the security check." },
        { status: 400, headers: corsHeaders }
      );
    }

    const turnstileVerification = await verifyTurnstile(
      turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      request.headers.get("CF-Connecting-IP") || ""
    );

    if (!turnstileVerification.success) {
      return Response.json(
        { success: false, error: "Security verification failed. Please try again." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Language detection - filter non-English submissions
    const langResult = detectLanguage(data.message);

    if (!langResult.isEnglish) {
      console.log(JSON.stringify({
        event: "non_english_filtered",
        detected_language: langResult.detectedLang,
        message_length: data.message.length,
      }));

      // Send to owner only for review (not staff), skip Mailchimp
      await sendEmailToOwner(data, env.RESEND_API_KEY, langResult.detectedLang);

      return Response.json(
        { success: true, message: "Message sent successfully!" },
        { status: 200, headers: corsHeaders }
      );
    }

    // Send email via Resend
    const emailResult = await sendEmail(data, env.RESEND_API_KEY);
    if (!emailResult.success) {
      console.error("Resend error:", emailResult.error);
      return Response.json(
        { success: false, error: "Failed to send message. Please try again later." },
        { status: 500, headers: corsHeaders }
      );
    }

    // Subscribe to Mailchimp if requested
    if (data.subscribe === "yes") {
      const mailchimpResult = await subscribeToMailchimp(
        data.email,
        env.MAILCHIMP_API_KEY
      );
      if (!mailchimpResult.success) {
        // Log but don't fail the request - email was already sent
        console.error("Mailchimp error:", mailchimpResult.error);
      }
    }

    // Success response
    return Response.json(
      { success: true, message: "Message sent successfully!" },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return Response.json(
      { success: false, error: "An unexpected error occurred. Please try again." },
      { status: 500, headers: corsHeaders }
    );
  }
};

async function verifyTurnstile(
  token: string,
  secretKey: string,
  remoteIp: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: remoteIp,
      }),
    }
  );

  const result = (await response.json()) as TurnstileResponse;
  return { success: result.success };
}

async function sendEmail(
  data: FormData,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.to,
      cc: EMAIL_CONFIG.cc,
      reply_to: data.email,
      subject: EMAIL_CONFIG.subject,
      template: {
        id: "contact-form-submission",
        variables: {
          name: data.name,
          email: data.email,
          phone: data.phone || "Not provided",
          message: data.message,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as ResendResponse;
    return { success: false, error: errorData.message || "Failed to send email" };
  }

  return { success: true };
}

async function subscribeToMailchimp(
  email: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  const url = `https://${MAILCHIMP_CONFIG.dataCenter}.api.mailchimp.com/3.0/lists/${MAILCHIMP_CONFIG.listId}/members`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`anystring:${apiKey}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      status: "subscribed",
    }),
  });

  if (!response.ok) {
    // 400 with "Member Exists" is not an error - user is already subscribed
    const errorData = await response.json() as { title?: string };
    if (errorData.title === "Member Exists") {
      return { success: true };
    }
    return { success: false, error: JSON.stringify(errorData) };
  }

  return { success: true };
}

function detectLanguage(text: string): { isEnglish: boolean; detectedLang: string } {
  // Skip detection for very short messages (< 50 chars)
  if (text.length < 50) {
    return { isEnglish: true, detectedLang: "und" };
  }

  try {
    const results = francAll(text, { minLength: 10 });
    if (!results.length || results[0][0] === "und") {
      return { isEnglish: true, detectedLang: "und" };
    }

    const [topLang, topDistance] = results[0];
    const isEnglish = topLang === "eng" && topDistance > 0.5;

    // Also check if English is in top 3 (handles mixed language)
    const englishInTop3 = results.slice(0, 3).some(
      ([lang, dist]) => lang === "eng" && dist > 0.5
    );

    return { isEnglish: isEnglish || englishInTop3, detectedLang: topLang };
  } catch {
    return { isEnglish: true, detectedLang: "error" }; // Fail open
  }
}

async function sendEmailToOwner(
  data: FormData,
  apiKey: string,
  detectedLang: string
): Promise<void> {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_CONFIG.from,
      to: ["valiantvineyards@proton.me"],
      reply_to: data.email,
      subject: `[Filtered: ${detectedLang}] ${EMAIL_CONFIG.subject}`,
      text: `This message was filtered as non-English (detected: ${detectedLang}).\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || "Not provided"}\n\nMessage:\n${data.message}`,
    }),
  });
}

