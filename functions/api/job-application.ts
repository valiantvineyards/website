import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface Env {
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

const EMAIL_CONFIG = {
  from: "Valiant Vineyards Winery & Distillery <noreply@valiantvineyards.us>",
  to: [
    // TODO: Uncomment after beta testing is complete
    // "sherry@valiantvineyards.us",
    "valiantvineyards@proton.me",
  ],
  subject: "New Job Application",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const formData = await request.formData();

    // Honeypot check
    const honeypot = formData.get("website") as string;
    if (honeypot) {
      return Response.json(
        { success: true, message: "Application submitted successfully!" },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Extract required fields
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const position = formData.get("position") as string;
    const certification = formData.get("certification") as string;

    // Validate required fields
    if (!fullName || !email || !phone || !position || certification !== "yes") {
      return Response.json(
        { success: false, error: "Please fill in all required fields and accept the certification." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate file upload if present
    const resumeFile = formData.get("resume") as File | null;
    if (resumeFile && resumeFile.size > 0) {
      if (resumeFile.type !== "application/pdf") {
        return Response.json(
          { success: false, error: "Resume must be a PDF file." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      if (resumeFile.size > 5 * 1024 * 1024) {
        return Response.json(
          { success: false, error: "Resume must be under 5MB." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    // Verify Turnstile
    const turnstileToken = formData.get("cf-turnstile-response") as string;
    if (!turnstileToken) {
      return Response.json(
        { success: false, error: "Please complete the security check." },
        { status: 400, headers: CORS_HEADERS }
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
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Collect all form data
    const applicationData = {
      position,
      fullName,
      email,
      phone,
      streetAddress: (formData.get("streetAddress") as string) || "",
      city: (formData.get("city") as string) || "",
      state: (formData.get("state") as string) || "",
      zip: (formData.get("zip") as string) || "",
      startDate: (formData.get("startDate") as string) || "",
      schedule: formData.getAll("schedule") as string[],
      ageConfirmation: (formData.get("ageConfirmation") as string) || "",
      // Employment history
      employer1: (formData.get("employer1") as string) || "",
      jobTitle1: (formData.get("jobTitle1") as string) || "",
      jobCityState1: (formData.get("jobCityState1") as string) || "",
      jobStart1: (formData.get("jobStart1") as string) || "",
      jobEnd1: (formData.get("jobEnd1") as string) || "",
      jobResponsibilities1: (formData.get("jobResponsibilities1") as string) || "",
      employer2: (formData.get("employer2") as string) || "",
      jobTitle2: (formData.get("jobTitle2") as string) || "",
      jobCityState2: (formData.get("jobCityState2") as string) || "",
      jobStart2: (formData.get("jobStart2") as string) || "",
      jobEnd2: (formData.get("jobEnd2") as string) || "",
      jobResponsibilities2: (formData.get("jobResponsibilities2") as string) || "",
      // Education
      schoolName: (formData.get("schoolName") as string) || "",
      schoolCityState: (formData.get("schoolCityState") as string) || "",
      educationLevel: (formData.get("educationLevel") as string) || "",
      certifications: (formData.get("certifications") as string) || "",
      // Skills
      skills: formData.getAll("skills") as string[],
      otherSkills: (formData.get("otherSkills") as string) || "",
      // References
      refName1: (formData.get("refName1") as string) || "",
      refPhone1: (formData.get("refPhone1") as string) || "",
      refRelationship1: (formData.get("refRelationship1") as string) || "",
      refName2: (formData.get("refName2") as string) || "",
      refPhone2: (formData.get("refPhone2") as string) || "",
      refRelationship2: (formData.get("refRelationship2") as string) || "",
    };

    // Generate PDF
    const pdfBytes = await generateApplicationPDF(applicationData);

    // Build attachments
    const attachments: Array<{ filename: string; content: string }> = [
      {
        filename: `application-${fullName.replace(/\s+/g, "-").toLowerCase()}.pdf`,
        content: uint8ArrayToBase64(pdfBytes),
      },
    ];

    if (resumeFile && resumeFile.size > 0) {
      const resumeBuffer = await resumeFile.arrayBuffer();
      attachments.push({
        filename: `resume-${fullName.replace(/\s+/g, "-").toLowerCase()}.pdf`,
        content: uint8ArrayToBase64(new Uint8Array(resumeBuffer)),
      });
    }

    // Format position name for display
    const positionTitle = position
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    // Send notification email to owners
    const emailResult = await sendNotificationEmail(
      applicationData,
      positionTitle,
      attachments,
      env.RESEND_API_KEY
    );

    if (!emailResult.success) {
      console.error("Failed to send notification email:", emailResult.error);
      return Response.json(
        { success: false, error: "Failed to submit application. Please try again later." },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // Send confirmation email to applicant
    await sendConfirmationEmail(fullName, email, positionTitle, env.RESEND_API_KEY);

    return Response.json(
      { success: true, message: "Application submitted successfully!" },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("Job application error:", error);
    return Response.json(
      { success: false, error: "An unexpected error occurred. Please try again." },
      { status: 500, headers: CORS_HEADERS }
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

interface ApplicationData {
  position: string;
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  startDate: string;
  schedule: string[];
  ageConfirmation: string;
  employer1: string;
  jobTitle1: string;
  jobCityState1: string;
  jobStart1: string;
  jobEnd1: string;
  jobResponsibilities1: string;
  employer2: string;
  jobTitle2: string;
  jobCityState2: string;
  jobStart2: string;
  jobEnd2: string;
  jobResponsibilities2: string;
  schoolName: string;
  schoolCityState: string;
  educationLevel: string;
  certifications: string;
  skills: string[];
  otherSkills: string;
  refName1: string;
  refPhone1: string;
  refRelationship1: string;
  refName2: string;
  refPhone2: string;
  refRelationship2: string;
}

async function generateApplicationPDF(data: ApplicationData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612; // Letter size
  const pageHeight = 792;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const gold = rgb(0.72, 0.53, 0.04);

  function checkPage(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawSectionHeader(title: string) {
    checkPage(40);
    y -= 20;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: gray,
    });
    y -= 18;
    page.drawText(title, { x: margin, y, size: 13, font: boldFont, color: gold });
    y -= 18;
  }

  function drawField(label: string, value: string) {
    if (!value) return;
    checkPage(20);
    page.drawText(label + ":", { x: margin, y, size: 9, font: boldFont, color: gray });
    // Wrap long values
    const maxLineWidth = contentWidth - 130;
    const words = value.split(" ");
    let line = "";
    let xStart = margin + 130;
    for (const word of words) {
      const testLine = line ? line + " " + word : word;
      const testWidth = font.widthOfTextAtSize(testLine, 10);
      if (testWidth > maxLineWidth && line) {
        page.drawText(line, { x: xStart, y, size: 10, font, color: black });
        y -= 14;
        checkPage(14);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: xStart, y, size: 10, font, color: black });
    }
    y -= 16;
  }

  // Header
  page.drawText("Valiant Vineyards", { x: margin, y, size: 20, font: boldFont, color: gold });
  y -= 20;
  page.drawText("Employment Application", { x: margin, y, size: 14, font, color: gray });
  y -= 12;

  const positionTitle = data.position
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  // Position
  drawSectionHeader("Position");
  drawField("Position", positionTitle);
  if (data.ageConfirmation === "yes") {
    drawField("Age Verified", "Yes — confirmed meets age requirement");
  }

  // Personal Info
  drawSectionHeader("Personal Information");
  drawField("Full Name", data.fullName);
  drawField("Email", data.email);
  drawField("Phone", data.phone);
  const addressParts = [data.streetAddress, data.city, data.state, data.zip].filter(Boolean);
  if (addressParts.length > 0) {
    drawField("Address", addressParts.join(", "));
  }

  // Availability
  drawSectionHeader("Availability");
  if (data.startDate) drawField("Start Date", data.startDate);
  if (data.schedule.length > 0) drawField("Schedule", data.schedule.join(", "));

  // Employment History
  const hasJob1 = data.employer1 || data.jobTitle1;
  const hasJob2 = data.employer2 || data.jobTitle2;
  if (hasJob1 || hasJob2) {
    drawSectionHeader("Employment History");
    if (hasJob1) {
      drawField("Employer", data.employer1);
      drawField("Position", data.jobTitle1);
      if (data.jobCityState1) drawField("Location", data.jobCityState1);
      const dates1 = [data.jobStart1, data.jobEnd1].filter(Boolean).join(" — ");
      if (dates1) drawField("Dates", dates1);
      if (data.jobResponsibilities1) drawField("Responsibilities", data.jobResponsibilities1);
      if (hasJob2) y -= 8;
    }
    if (hasJob2) {
      drawField("Employer", data.employer2);
      drawField("Position", data.jobTitle2);
      if (data.jobCityState2) drawField("Location", data.jobCityState2);
      const dates2 = [data.jobStart2, data.jobEnd2].filter(Boolean).join(" — ");
      if (dates2) drawField("Dates", dates2);
      if (data.jobResponsibilities2) drawField("Responsibilities", data.jobResponsibilities2);
    }
  }

  // Education
  if (data.schoolName || data.educationLevel) {
    drawSectionHeader("Education");
    if (data.schoolName) drawField("School", data.schoolName);
    if (data.schoolCityState) drawField("Location", data.schoolCityState);
    if (data.educationLevel) drawField("Level", data.educationLevel);
    if (data.certifications) drawField("Certifications", data.certifications);
  }

  // Skills
  const allSkills = [...data.skills];
  if (data.otherSkills) allSkills.push(data.otherSkills);
  if (allSkills.length > 0) {
    drawSectionHeader("Skills");
    drawField("Skills", allSkills.join(", "));
  }

  // References
  const hasRef1 = data.refName1 || data.refPhone1;
  const hasRef2 = data.refName2 || data.refPhone2;
  if (hasRef1 || hasRef2) {
    drawSectionHeader("References");
    if (hasRef1) {
      drawField("Name", data.refName1);
      if (data.refPhone1) drawField("Phone", data.refPhone1);
      if (data.refRelationship1) drawField("Relationship", data.refRelationship1);
      if (hasRef2) y -= 8;
    }
    if (hasRef2) {
      drawField("Name", data.refName2);
      if (data.refPhone2) drawField("Phone", data.refPhone2);
      if (data.refRelationship2) drawField("Relationship", data.refRelationship2);
    }
  }

  // Footer
  checkPage(40);
  y -= 20;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: gray,
  });
  y -= 16;
  page.drawText(`Submitted: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, {
    x: margin, y, size: 9, font, color: gray,
  });

  return doc.save();
}

async function sendNotificationEmail(
  data: ApplicationData,
  positionTitle: string,
  attachments: Array<{ filename: string; content: string }>,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  const scheduleText = data.schedule.length > 0 ? data.schedule.join(", ") : "Not specified";
  const addressParts = [data.streetAddress, data.city, data.state, data.zip].filter(Boolean);
  const addressText = addressParts.length > 0 ? addressParts.join(", ") : "Not provided";

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b8860b; border-bottom: 2px solid #b8860b; padding-bottom: 8px;">
        New Job Application: ${positionTitle}
      </h2>

      <h3 style="color: #333;">Applicant Information</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 4px 8px; font-weight: bold; color: #666; width: 120px;">Name</td><td style="padding: 4px 8px;">${data.fullName}</td></tr>
        <tr><td style="padding: 4px 8px; font-weight: bold; color: #666;">Email</td><td style="padding: 4px 8px;"><a href="mailto:${data.email}">${data.email}</a></td></tr>
        <tr><td style="padding: 4px 8px; font-weight: bold; color: #666;">Phone</td><td style="padding: 4px 8px;"><a href="tel:${data.phone}">${data.phone}</a></td></tr>
        <tr><td style="padding: 4px 8px; font-weight: bold; color: #666;">Address</td><td style="padding: 4px 8px;">${addressText}</td></tr>
        <tr><td style="padding: 4px 8px; font-weight: bold; color: #666;">Start Date</td><td style="padding: 4px 8px;">${data.startDate || "Not specified"}</td></tr>
        <tr><td style="padding: 4px 8px; font-weight: bold; color: #666;">Schedule</td><td style="padding: 4px 8px;">${scheduleText}</td></tr>
        ${data.ageConfirmation === "yes" ? '<tr><td style="padding: 4px 8px; font-weight: bold; color: #666;">Age Verified</td><td style="padding: 4px 8px;">Yes</td></tr>' : ""}
      </table>

      <p style="color: #666; font-size: 14px;">
        Full application details are attached as a PDF.
        ${attachments.length > 1 ? "The applicant's resume is also attached." : ""}
      </p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.to,
      reply_to: data.email,
      subject: `${EMAIL_CONFIG.subject}: ${data.fullName} — ${positionTitle}`,
      html: htmlBody,
      attachments,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    return { success: false, error: JSON.stringify(errorData) };
  }

  return { success: true };
}

async function sendConfirmationEmail(
  name: string,
  email: string,
  positionTitle: string,
  apiKey: string
): Promise<void> {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b8860b;">Thank You for Your Application</h2>
      <p>Dear ${name},</p>
      <p>Thank you for applying for the <strong>${positionTitle}</strong> position at Valiant Vineyards Winery & Distillery. We have received your application and will review it shortly.</p>
      <p>If your qualifications match our needs, we will be in touch to schedule an interview. In the meantime, feel free to reach out if you have any questions.</p>
      <p>Best regards,<br />Valiant Vineyards Winery & Distillery</p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_CONFIG.from,
      to: [email],
      subject: `Application Received — ${positionTitle} at Valiant Vineyards`,
      html: htmlBody,
    }),
  });
}
