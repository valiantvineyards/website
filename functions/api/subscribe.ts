interface Env {
  EMAILOCTOPUS_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

const EMAILOCTOPUS_CONFIG = {
  listId: "4c4ea9b4-c4e5-11f1-97cb-8de3487a8a77",
};

// Maps the form's "source" field to an EmailOctopus tag (tags must exist on the list)
const SOURCE_TAGS: Record<string, string> = {
  footer: "website-footer",
  "tasting-room": "tasting-room",
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

    const source = formData.get("source") as string;
    const tag = SOURCE_TAGS[source] ?? SOURCE_TAGS.footer;

    const result = await subscribeToEmailOctopus(email, tag, env.EMAILOCTOPUS_API_KEY);

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

async function subscribeToEmailOctopus(
  email: string,
  tag: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  const url = `https://api.emailoctopus.com/lists/${EMAILOCTOPUS_CONFIG.listId}/contacts`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      tags: [tag],
      status: "subscribed",
    }),
  });

  if (!response.ok) {
    // 409 means the contact already exists - leave their status alone
    if (response.status === 409) {
      return { success: true };
    }

    const errorData = (await response.json().catch(() => ({}))) as {
      errors?: { pointer?: string }[];
    };

    if (
      response.status === 422 &&
      errorData.errors?.some((e) => e.pointer === "/email_address")
    ) {
      return { success: false, error: "Please enter a valid email address." };
    }

    console.error("EmailOctopus error:", response.status, JSON.stringify(errorData));
    return { success: false, error: "Unable to subscribe. Please try again later." };
  }

  return { success: true };
}
