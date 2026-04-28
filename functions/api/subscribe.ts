interface Env {
  MAILCHIMP_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

const MAILCHIMP_CONFIG = {
  listId: "b25550092c",
  dataCenter: "us21",
};

const ALLOWED_ORIGINS = [
  "https://www.valiantvineyards.us",
  "https://valiantvineyards.us",
];

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { headers: getCorsHeaders(context.request) });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    const formData = await request.formData();

    // Honeypot — silently succeed for bots that filled it
    const honeypot = formData.get("website") as string;
    if (honeypot) {
      return Response.json(
        { success: true, message: "Thanks for subscribing!" },
        { status: 200, headers: corsHeaders }
      );
    }

    const email = (formData.get("email") || formData.get("EMAIL")) as string;

    if (!email) {
      return Response.json(
        { success: false, error: "Please enter your email address." },
        { status: 400, headers: corsHeaders }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify Turnstile
    const turnstileToken = formData.get("cf-turnstile-response") as string;
    if (!turnstileToken) {
      return Response.json(
        { success: false, error: "Please complete the security check." },
        { status: 400, headers: corsHeaders }
      );
    }

    const turnstileResult = await verifyTurnstile(
      turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      request.headers.get("CF-Connecting-IP") || ""
    );

    if (!turnstileResult.success) {
      return Response.json(
        { success: false, error: "Security verification failed. Please try again." },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await subscribeToMailchimp(email, env.MAILCHIMP_API_KEY);

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: 400, headers: corsHeaders }
      );
    }

    return Response.json(
      { success: true, message: "Thanks for subscribing!" },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Subscribe error:", error);
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

  try {
    const result = (await response.json()) as TurnstileResponse;
    return { success: result.success };
  } catch {
    console.error("Turnstile response parsing failed:", response.status, response.statusText);
    return { success: false };
  }
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
    const errorData = (await response.json()) as { title?: string; detail?: string };

    if (errorData.title === "Member Exists") {
      return { success: true };
    }

    if (errorData.title === "Invalid Resource") {
      return { success: false, error: "Please enter a valid email address." };
    }

    return { success: false, error: "Unable to subscribe. Please try again later." };
  }

  return { success: true };
}
