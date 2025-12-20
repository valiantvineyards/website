interface Env {
  MAILCHIMP_API_KEY: string;
}

// Mailchimp configuration (same as contact.ts)
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
    const email = formData.get("email") as string;

    // Validate email
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

    // Subscribe to Mailchimp
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

    // "Member Exists" is not an error - user is already subscribed
    if (errorData.title === "Member Exists") {
      return { success: true };
    }

    // Provide user-friendly error messages
    if (errorData.title === "Invalid Resource") {
      return { success: false, error: "Please enter a valid email address." };
    }

    return { success: false, error: "Unable to subscribe. Please try again later." };
  }

  return { success: true };
}
