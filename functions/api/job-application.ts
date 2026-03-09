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
    "sherry@valiantvineyards.us",
    "valiantvineyards@proton.me",
  ],
  subject: "New Job Application",
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 4096;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    let binary = "";
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
    parts.push(binary);
  }
  return btoa(parts.join(""));
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, { headers: getCorsHeaders(context.request) });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const formData = await request.formData();

    // Honeypot check
    const honeypot = formData.get("website") as string;
    if (honeypot) {
      return Response.json(
        { success: true, message: "Application submitted successfully!" },
        { status: 200, headers: getCorsHeaders(request) }
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
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // Validate file upload if present
    const resumeFile = formData.get("resume") as File | null;
    if (resumeFile && resumeFile.size > 0) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      const allowedExtensions = [".pdf", ".doc", ".docx"];
      const fileName = (resumeFile.name || "").toLowerCase();
      const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
      if (!allowedTypes.includes(resumeFile.type) || !hasValidExtension) {
        return Response.json(
          { success: false, error: "Resume must be a PDF, DOC, or DOCX file." },
          { status: 400, headers: getCorsHeaders(request) }
        );
      }
      if (resumeFile.size > 5 * 1024 * 1024) {
        return Response.json(
          { success: false, error: "Resume must be under 5MB." },
          { status: 400, headers: getCorsHeaders(request) }
        );
      }
    }

    // Verify Turnstile
    const turnstileToken = formData.get("cf-turnstile-response") as string;
    if (!turnstileToken) {
      return Response.json(
        { success: false, error: "Please complete the security check." },
        { status: 400, headers: getCorsHeaders(request) }
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
        { status: 400, headers: getCorsHeaders(request) }
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
      // Employment history (dynamic 1–4 entries)
      jobs: (() => {
        const jobs: JobEntryData[] = [];
        for (let i = 1; i <= 4; i++) {
          const employer = (formData.get(`employer${i}`) as string) || "";
          const jobTitle = (formData.get(`jobTitle${i}`) as string) || "";
          if (employer || jobTitle) {
            jobs.push({
              employer,
              jobTitle,
              jobCityState: (formData.get(`jobCityState${i}`) as string) || "",
              jobStart: (formData.get(`jobStart${i}`) as string) || "",
              jobEnd: (formData.get(`jobEnd${i}`) as string) || "",
              jobResponsibilities: (formData.get(`jobResponsibilities${i}`) as string) || "",
            });
          }
        }
        return jobs;
      })(),
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

    // Format position name for display
    const positionTitle = position
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    // Generate PDF and read resume in parallel
    const [pdfBytes, resumeBuffer] = await Promise.all([
      generateApplicationPDF(applicationData, positionTitle),
      resumeFile && resumeFile.size > 0 ? resumeFile.arrayBuffer() : Promise.resolve(null),
    ]);

    // Build attachments
    const safeName = fullName.replace(/\s+/g, "-").toLowerCase();
    const attachments: Array<{ filename: string; content: string }> = [
      {
        filename: `application-${safeName}.pdf`,
        content: uint8ArrayToBase64(pdfBytes),
      },
    ];

    if (resumeBuffer) {
      const ext = resumeFile!.name.substring(resumeFile!.name.lastIndexOf(".")) || ".pdf";
      attachments.push({
        filename: `resume-${safeName}${ext}`,
        content: uint8ArrayToBase64(new Uint8Array(resumeBuffer)),
      });
    }

    // Send notification and confirmation emails in parallel
    const [emailResult] = await Promise.all([
      sendNotificationEmail(applicationData, positionTitle, attachments, env.RESEND_API_KEY),
      sendConfirmationEmail(fullName, email, positionTitle, env.RESEND_API_KEY),
    ]);

    if (!emailResult.success) {
      console.error("Failed to send notification email:", emailResult.error);
      return Response.json(
        { success: false, error: "Failed to submit application. Please try again later." },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    return Response.json(
      { success: true, message: "Application submitted successfully!" },
      { status: 200, headers: getCorsHeaders(request) }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error("Job application error:", errMsg);
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
    return Response.json(
      { success: false, error: "An unexpected error occurred. Please try again." },
      { status: 500, headers: getCorsHeaders(request) }
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

interface JobEntryData {
  employer: string;
  jobTitle: string;
  jobCityState: string;
  jobStart: string;
  jobEnd: string;
  jobResponsibilities: string;
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
  jobs: JobEntryData[];
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

function formatDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${month}-${day}-${year}`;
  }
  if (parts.length === 2) {
    const [year, month] = parts;
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
  }
  return dateStr;
}

async function generateApplicationPDF(data: ApplicationData, positionTitle: string): Promise<Uint8Array> {
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
  const charcoal = rgb(0.2, 0.2, 0.2);

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
    page.drawText(title, { x: margin, y, size: 13, font: boldFont, color: charcoal });
    y -= 18;
  }

  function drawField(label: string, rawValue: string) {
    if (!rawValue) return;
    // pdf-lib's WinAnsi encoding cannot handle control characters;
    // replace newlines with spaces so they act as word breaks for wrapping
    const value = rawValue.replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7E]/g, "");
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
  page.drawText("Valiant Vineyards", { x: margin, y, size: 20, font: boldFont, color: charcoal });
  y -= 20;
  page.drawText("Employment Application", { x: margin, y, size: 14, font, color: gray });
  y -= 12;

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
  if (data.startDate) drawField("Start Date", formatDate(data.startDate));
  if (data.schedule.length > 0) drawField("Schedule", data.schedule.join(", "));

  // Employment History
  if (data.jobs.length > 0) {
    drawSectionHeader("Employment History");
    for (let i = 0; i < data.jobs.length; i++) {
      const job = data.jobs[i];
      drawField("Employer", job.employer);
      drawField("Position", job.jobTitle);
      if (job.jobCityState) drawField("Location", job.jobCityState);
      const dates = [job.jobStart, job.jobEnd].filter(Boolean).map(formatDate).join(" — ");
      if (dates) drawField("Dates", dates);
      if (job.jobResponsibilities) drawField("Responsibilities", job.jobResponsibilities);
      if (i < data.jobs.length - 1) y -= 8;
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
  const scheduleText = data.schedule.length > 0 ? escapeHtml(data.schedule.join(", ")) : "Not specified";
  const addressParts = [data.streetAddress, data.city, data.state, data.zip].filter(Boolean);
  const addressText = addressParts.length > 0 ? escapeHtml(addressParts.join(", ")) : "Not provided";
  const safeName = escapeHtml(data.fullName);
  const safeEmail = escapeHtml(data.email);
  const safePhone = escapeHtml(data.phone);
  const safePosition = escapeHtml(positionTitle);

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 8px;">
        New Job Application: ${safePosition}
      </h2>

      <h3 style="color: #333;">Applicant Information</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 4px 8px; font-weight: bold; color: #666; width: 120px;">Name</td><td style="padding: 4px 8px;">${safeName}</td></tr>
        <tr><td style="padding: 4px 8px; font-weight: bold; color: #666;">Email</td><td style="padding: 4px 8px;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
        <tr><td style="padding: 4px 8px; font-weight: bold; color: #666;">Phone</td><td style="padding: 4px 8px;"><a href="tel:${safePhone}">${safePhone}</a></td></tr>
        <tr><td style="padding: 4px 8px; font-weight: bold; color: #666;">Address</td><td style="padding: 4px 8px;">${addressText}</td></tr>
        <tr><td style="padding: 4px 8px; font-weight: bold; color: #666;">Start Date</td><td style="padding: 4px 8px;">${escapeHtml(data.startDate) || "Not specified"}</td></tr>
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
      subject: `${EMAIL_CONFIG.subject}: ${data.fullName} — ${positionTitle}`,  // plain text subject, no HTML escaping needed
      html: htmlBody,
      attachments,
    }),
  });

  if (!response.ok) {
    try {
      const errorData = await response.json();
      return { success: false, error: JSON.stringify(errorData) };
    } catch {
      return { success: false, error: `Resend API error: ${response.status} ${response.statusText}` };
    }
  }

  return { success: true };
}

async function sendConfirmationEmail(
  name: string,
  email: string,
  positionTitle: string,
  apiKey: string
): Promise<void> {
  try {
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Thank You for Your Application</h2>
        <p>Dear ${escapeHtml(name)},</p>
        <p>Thank you for applying for the <strong>${escapeHtml(positionTitle)}</strong> position at Valiant Vineyards Winery & Distillery. We have received your application and will review it shortly.</p>
        <p>If your qualifications match our needs, we will be in touch to schedule an interview. In the meantime, feel free to reach out if you have any questions.</p>
        <p style="margin-top: 16px; padding: 12px; background-color: #f5f5f5; border-radius: 4px; font-size: 14px; color: #555;">
          <strong>Contact Us</strong><br />
          Phone: <a href="tel:+16056244500" style="color: #333;">(605) 624-4500</a><br />
          Email: <a href="mailto:wine@valiantvineyards.us" style="color: #333;">wine@valiantvineyards.us</a>
        </p>
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
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
  }
}
