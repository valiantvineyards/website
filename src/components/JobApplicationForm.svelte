<script lang="ts">
  import { fly, slide } from "svelte/transition";
  import Button from "$lib/components/ui/button/button.svelte";

  interface JobOption {
    slug: string;
    title: string;
    ageRequirement: number | null;
  }

  interface Props {
    jobOptions: JobOption[];
    initialPosition?: string;
  }

  let { jobOptions, initialPosition = "" }: Props = $props();

  // Read position from URL query param client-side (static builds can't read it at SSR time)
  if (!initialPosition && typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    initialPosition = params.get("position") ?? "";
  }

  // ── Step Management ──────────────────────────────────────────────
  const STEPS = [
    { label: "Position & You" },
    { label: "Availability" },
    { label: "Experience" },
    { label: "References & Resume" },
    { label: "Review & Submit" },
  ];

  let currentStep = $state(0);
  let direction = $state(1); // 1 = forward, -1 = back
  let stepKey = $state(0); // for keying transitions

  // ── Form Data ────────────────────────────────────────────────────
  let position = $state(initialPosition);
  let ageConfirmation = $state(false);
  let fullName = $state("");
  let email = $state("");
  let phone = $state("");
  let streetAddress = $state("");
  let city = $state("");
  let formState = $state("");
  let zip = $state("");

  let startDate = $state("");
  let schedule = $state<string[]>([]);

  const MAX_JOBS = 4;

  interface JobEntry {
    employer: string;
    jobTitle: string;
    jobCityState: string;
    jobStart: string;
    jobEnd: string;
    currentlyEmployed: boolean;
    jobResponsibilities: string;
  }

  function emptyJob(): JobEntry {
    return { employer: "", jobTitle: "", jobCityState: "", jobStart: "", jobEnd: "", currentlyEmployed: false, jobResponsibilities: "" };
  }

  let jobs = $state<JobEntry[]>([emptyJob()]);

  let schoolName = $state("");
  let schoolCityState = $state("");
  let educationLevel = $state("");
  let certifications = $state("");
  let skills = $state<string[]>([]);
  let otherSkills = $state("");

  let refName1 = $state("");
  let refPhone1 = $state("");
  let refRelationship1 = $state("");
  let refName2 = $state("");
  let refPhone2 = $state("");
  let refRelationship2 = $state("");

  let resumeFile = $state<File | null>(null);
  let certification = $state(false);

  // ── Validation State ─────────────────────────────────────────────
  let errors = $state<Record<string, string>>({});
  let touched = $state<Record<string, boolean>>({});
  let submitting = $state(false);
  let submitResult = $state<{ success: boolean; message: string } | null>(null);

  // Drag-and-drop state
  let dragging = $state(false);

  const US_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
    "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  ];

  const SCHEDULE_OPTIONS = ["Full-Time", "Part-Time", "Weekends", "Morning", "Evening"];
  const SKILL_OPTIONS = ["Cooking", "Food Preparation", "Customer Service", "Kitchen Cleaning", "Time Management"];
  const EDUCATION_LEVELS: Record<string, string> = {
    "some-high-school": "Some High School",
    "high-school": "High School Diploma / GED",
    "some-college": "Some College",
    "associates": "Associate's Degree",
    "bachelors": "Bachelor's Degree",
    "masters": "Master's Degree or Higher",
  };

  // ── Derived State ────────────────────────────────────────────────
  let selectedJob = $derived(jobOptions.find((j) => j.slug === position));
  let needsAgeVerification = $derived(selectedJob?.ageRequirement != null);

  // ── Validation Rules ─────────────────────────────────────────────
  function validateField(name: string, value: string | boolean | File | null): string {
    switch (name) {
      case "position":
        return !value ? "Please select a position" : "";
      case "fullName":
        return !value ? "Full name is required" : (value as string).length < 2 ? "Name must be at least 2 characters" : "";
      case "email":
        if (!value) return "Email is required";
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string) ? "" : "Please enter a valid email address";
      case "phone":
        if (!value) return "Phone number is required";
        return (value as string).replace(/\D/g, "").length === 10 ? "" : "Please enter a 10-digit phone number";
      case "zip":
        if (!value) return "";
        return /^\d{5}(-\d{4})?$/.test(value as string) ? "" : "Please enter a valid ZIP code";
      case "ageConfirmation":
        return needsAgeVerification && !value ? "Age confirmation is required for this position" : "";
      case "certification":
        return !value ? "You must accept the certification" : "";
      case "resume":
        if (!value) return "";
        const file = value as File;
        if (file.type !== "application/pdf") return "Only PDF files are accepted";
        if (file.size > 5 * 1024 * 1024) return "File must be under 5MB";
        return "";
      default:
        return "";
    }
  }

  function validateStep(step: number): boolean {
    let fieldsToValidate: [string, string | boolean | File | null][] = [];

    switch (step) {
      case 0:
        fieldsToValidate = [
          ["position", position],
          ["fullName", fullName],
          ["email", email],
          ["phone", phone],
          ["zip", zip],
        ];
        if (needsAgeVerification) {
          fieldsToValidate.push(["ageConfirmation", ageConfirmation]);
        }
        break;
      case 1:
        // No required fields
        return true;
      case 2:
        // No required fields
        return true;
      case 3:
        fieldsToValidate = [["resume", resumeFile]];
        break;
      case 4:
        fieldsToValidate = [["certification", certification]];
        break;
    }

    let valid = true;
    const newErrors = { ...errors };
    const newTouched = { ...touched };

    for (const [name, value] of fieldsToValidate) {
      const error = validateField(name, value);
      newErrors[name] = error;
      newTouched[name] = true;
      if (error) valid = false;
    }

    errors = newErrors;
    touched = newTouched;
    return valid;
  }

  function handleBlur(name: string, value: string | boolean | File | null) {
    touched = { ...touched, [name]: true };
    errors = { ...errors, [name]: validateField(name, value) };
  }

  function handleInput(name: string, value: string | boolean | File | null) {
    if (touched[name]) {
      errors = { ...errors, [name]: validateField(name, value) };
    }
  }

  // ── Phone Auto-formatting ───────────────────────────────────────
  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length === 0) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function handlePhoneInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const cursorPos = input.selectionStart ?? 0;
    const prevLen = input.value.length;
    phone = formatPhone(input.value);
    handleInput("phone", phone);
    // Restore cursor position adjusted for formatting
    const newLen = phone.length;
    const diff = newLen - prevLen;
    requestAnimationFrame(() => {
      input.setSelectionRange(cursorPos + diff, cursorPos + diff);
    });
  }

  // ── File Handling ────────────────────────────────────────────────
  function handleFileSelect(file: File | null) {
    if (!file) return;
    const error = validateField("resume", file);
    if (error) {
      errors = { ...errors, resume: error };
      touched = { ...touched, resume: true };
      resumeFile = null;
    } else {
      resumeFile = file;
      errors = { ...errors, resume: "" };
      touched = { ...touched, resume: true };
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files[0] ?? null;
    handleFileSelect(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragging = true;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── Schedule / Skills Toggle ─────────────────────────────────────
  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
  }

  // ── Navigation ───────────────────────────────────────────────────
  function scrollToFirstError() {
    requestAnimationFrame(() => {
      const firstError = document.querySelector(".form-error") as HTMLElement | null;
      if (!firstError) return;
      // Scroll the parent container into view so the label is visible
      const container = firstError.closest("div") ?? firstError;
      container.scrollIntoView({ behavior: "smooth", block: "center" });
      firstError.focus();
    });
  }

  function nextStep() {
    if (!validateStep(currentStep)) {
      scrollToFirstError();
      return;
    }
    direction = 1;
    stepKey++;
    currentStep = Math.min(currentStep + 1, STEPS.length - 1);
    scrollToTop();
  }

  function prevStep() {
    direction = -1;
    stepKey++;
    currentStep = Math.max(currentStep - 1, 0);
    scrollToTop();
  }

  function goToStep(step: number) {
    direction = step > currentStep ? 1 : -1;
    stepKey++;
    currentStep = step;
    scrollToTop();
  }

  function scrollToTop() {
    window.scrollTo(0, 0);
  }

  // ── Submission ───────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validateStep(4)) {
      scrollToFirstError();
      return;
    }

    // Check Turnstile
    if (!turnstileToken) {
      submitResult = { success: false, message: "Please complete the security check before submitting." };
      return;
    }

    submitting = true;
    submitResult = null;

    try {
      const formData = new FormData();

      // Required fields
      formData.append("position", position);
      formData.append("fullName", fullName);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("certification", "yes");

      // Optional strings
      if (streetAddress) formData.append("streetAddress", streetAddress);
      if (city) formData.append("city", city);
      if (formState) formData.append("state", formState);
      if (zip) formData.append("zip", zip);
      if (startDate) formData.append("startDate", startDate);
      if (needsAgeVerification && ageConfirmation) formData.append("ageConfirmation", "yes");

      // Multi-value
      for (const s of schedule) formData.append("schedule", s);
      for (const s of skills) formData.append("skills", s);

      // Employment
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const n = i + 1;
        if (job.employer) formData.append(`employer${n}`, job.employer);
        if (job.jobTitle) formData.append(`jobTitle${n}`, job.jobTitle);
        if (job.jobCityState) formData.append(`jobCityState${n}`, job.jobCityState);
        if (job.jobStart) formData.append(`jobStart${n}`, job.jobStart);
        if (job.jobEnd) formData.append(`jobEnd${n}`, job.jobEnd);
        if (job.jobResponsibilities) formData.append(`jobResponsibilities${n}`, job.jobResponsibilities);
      }

      // Education
      if (schoolName) formData.append("schoolName", schoolName);
      if (schoolCityState) formData.append("schoolCityState", schoolCityState);
      if (educationLevel) formData.append("educationLevel", educationLevel);
      if (certifications) formData.append("certifications", certifications);
      if (otherSkills) formData.append("otherSkills", otherSkills);

      // References
      if (refName1) formData.append("refName1", refName1);
      if (refPhone1) formData.append("refPhone1", refPhone1);
      if (refRelationship1) formData.append("refRelationship1", refRelationship1);
      if (refName2) formData.append("refName2", refName2);
      if (refPhone2) formData.append("refPhone2", refPhone2);
      if (refRelationship2) formData.append("refRelationship2", refRelationship2);

      // File
      if (resumeFile) formData.append("resume", resumeFile);

      // Honeypot
      formData.append("website", "");

      // Turnstile
      formData.append("cf-turnstile-response", turnstileToken);

      const response = await fetch("/api/job-application", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        submitResult = { success: true, message: "Your application has been submitted successfully! We'll be in touch soon." };
        // Reset Turnstile
        turnstileToken = "";
        if (window.turnstile) {
          window.turnstile.reset();
        }
      } else {
        submitResult = { success: false, message: result.error || "Something went wrong. Please try again." };
      }
    } catch {
      submitResult = { success: false, message: "Failed to submit application. Please try again." };
    }

    submitting = false;
    document.getElementById("application-form-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Turnstile Rendering ──────────────────────────────────────────
  let turnstileToken = $state("");
  let turnstileRendered = $state(false);

  function renderTurnstile() {
    const container = document.querySelector(".cf-turnstile");
    if (!container || !window.turnstile) return;

    // Clear previous widget if re-rendering
    if (turnstileRendered) {
      while (container.firstChild) container.removeChild(container.firstChild);
      turnstileRendered = false;
      turnstileToken = "";
    }

    window.turnstile.render(container, {
      sitekey: "0x4AAAAAACHr1kbpPYRV4EtW",
      theme: "light",
      callback: (token: string) => { turnstileToken = token; },
      "error-callback": () => { turnstileToken = ""; },
      "expired-callback": () => { turnstileToken = ""; },
    });
    turnstileRendered = true;
  }

  // When entering review step, render Turnstile
  $effect(() => {
    if (currentStep === 4) {
      // Small delay to let DOM render
      setTimeout(renderTurnstile, 100);
    } else if (turnstileRendered) {
      // Reset when navigating away so it re-renders when returning
      turnstileRendered = false;
      turnstileToken = "";
    }
  });
</script>

<div id="application-form-container" class="mx-auto max-w-3xl">
  <!-- Progress Bar -->
  <nav aria-label="Application progress" class="mb-8">
    <ol class="flex w-full items-start">
      {#each STEPS as step, i}
        <li class="flex flex-1 flex-col items-center gap-2 relative">
          <div class="flex items-center w-full justify-center">
            {#if i > 0}
              <div class="hidden h-0.5 flex-1 sm:block {i <= currentStep ? 'bg-gold' : 'bg-stone-200'}" aria-hidden="true"></div>
            {/if}
            <button
              type="button"
              onclick={() => { if (i < currentStep) goToStep(i); }}
              disabled={i > currentStep}
              class="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-all
                {i < currentStep
                  ? 'border-gold bg-gold text-white cursor-pointer hover:bg-gold-dark'
                  : i === currentStep
                    ? 'border-gold bg-white text-gold'
                    : 'border-stone-300 bg-white text-stone-400 cursor-default'}"
              aria-current={i === currentStep ? "step" : undefined}
            >
              {#if i < currentStep}
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              {:else}
                {i + 1}
              {/if}
            </button>
            {#if i < STEPS.length - 1}
              <div class="hidden h-0.5 flex-1 sm:block {i < currentStep ? 'bg-gold' : 'bg-stone-200'}" aria-hidden="true"></div>
            {/if}
          </div>
          <span class="hidden text-xs font-medium text-center sm:block {i <= currentStep ? 'text-foreground' : 'text-stone-400'}">
            {step.label}
          </span>
        </li>
      {/each}
    </ol>
    <!-- Mobile step label -->
    <p class="mt-3 text-center text-sm font-medium text-foreground sm:hidden">
      Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].label}
    </p>
  </nav>

  <!-- Form Container -->
  <div class="rounded-xl border border-border/60 bg-stone-50/50 shadow-sm overflow-hidden">
    <!-- Step Content -->
    {#key stepKey}
      <div
        class="p-6 sm:p-8"
        in:fly={{ x: direction * 80, duration: 200, delay: 200 }}
        out:fly={{ x: direction * -80, duration: 200 }}
      >
        <!-- Step 1: Position & You -->
        {#if currentStep === 0}
          <div class="space-y-8">
            <!-- Position -->
            <section class="rounded-lg border border-border/40 bg-white p-6">
              <h2 class="font-serif text-xl font-semibold text-foreground">
                Position
                <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
              </h2>
              <div class="mt-5">
                <label for="position" class="block text-sm font-medium mb-2">
                  Position Applying For <span class="text-destructive" aria-hidden="true">*</span>
                </label>
                <select
                  id="position"
                  bind:value={position}
                  onblur={() => handleBlur("position", position)}
                  oninput={() => handleInput("position", position)}
                  aria-invalid={touched.position && errors.position ? "true" : undefined}
                  aria-describedby={errors.position ? "position-error" : undefined}
                  class="form-select"
                  class:form-error={touched.position && errors.position}
                  class:form-valid={touched.position && !errors.position && position}
                >
                  <option value="">Select a position...</option>
                  {#each jobOptions as job}
                    <option value={job.slug}>{job.title}</option>
                  {/each}
                </select>
                {#if touched.position && errors.position}
                  <p id="position-error" class="form-error-text" transition:slide={{ duration: 150 }}>{errors.position}</p>
                {/if}
              </div>
            </section>

            <!-- Age Verification -->
            {#if needsAgeVerification}
              <section class="rounded-lg border border-amber-200 bg-amber-50/50 p-6" transition:slide={{ duration: 200 }}>
                <h2 class="font-serif text-xl font-semibold text-foreground">
                  Age Verification
                  <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
                </h2>
                <div class="mt-5 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="ageConfirmation"
                    bind:checked={ageConfirmation}
                    onblur={() => handleBlur("ageConfirmation", ageConfirmation)}
                    onchange={() => handleInput("ageConfirmation", ageConfirmation)}
                    aria-invalid={touched.ageConfirmation && errors.ageConfirmation ? "true" : undefined}
                    aria-describedby={errors.ageConfirmation ? "age-error" : undefined}
                    class="custom-checkbox mt-0.5"
                  />
                  <label for="ageConfirmation" class="text-sm text-foreground">
                    I confirm that I am at least {selectedJob?.ageRequirement} years of age. <span class="text-destructive" aria-hidden="true">*</span>
                  </label>
                </div>
                {#if touched.ageConfirmation && errors.ageConfirmation}
                  <p id="age-error" class="form-error-text mt-2" transition:slide={{ duration: 150 }}>{errors.ageConfirmation}</p>
                {/if}
              </section>
            {/if}

            <!-- Personal Information -->
            <section class="rounded-lg border border-border/40 bg-white p-6">
              <h2 class="font-serif text-xl font-semibold text-foreground">
                Personal Information
                <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
              </h2>
              <div class="mt-5 space-y-5">
                <div>
                  <label for="fullName" class="block text-sm font-medium mb-2">
                    Full Name <span class="text-destructive" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    bind:value={fullName}
                    onblur={() => handleBlur("fullName", fullName)}
                    oninput={() => handleInput("fullName", fullName)}
                    aria-invalid={touched.fullName && errors.fullName ? "true" : undefined}
                    aria-describedby={errors.fullName ? "fullName-error" : undefined}
                    autocomplete="name"
                    placeholder="Your full name"
                    class="form-input"
                    class:form-error={touched.fullName && errors.fullName}
                    class:form-valid={touched.fullName && !errors.fullName && fullName}
                  />
                  {#if touched.fullName && errors.fullName}
                    <p id="fullName-error" class="form-error-text" transition:slide={{ duration: 150 }}>{errors.fullName}</p>
                  {/if}
                </div>

                <div class="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label for="phone" class="block text-sm font-medium mb-2">
                      Phone <span class="text-destructive" aria-hidden="true">*</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={phone}
                      oninput={handlePhoneInput}
                      onblur={() => handleBlur("phone", phone)}
                      aria-invalid={touched.phone && errors.phone ? "true" : undefined}
                      aria-describedby={errors.phone ? "phone-error" : undefined}
                      autocomplete="tel"
                      placeholder="(555) 123-4567"
                      class="form-input"
                      class:form-error={touched.phone && errors.phone}
                      class:form-valid={touched.phone && !errors.phone && phone}
                    />
                    {#if touched.phone && errors.phone}
                      <p id="phone-error" class="form-error-text" transition:slide={{ duration: 150 }}>{errors.phone}</p>
                    {/if}
                  </div>
                  <div>
                    <label for="email" class="block text-sm font-medium mb-2">
                      Email <span class="text-destructive" aria-hidden="true">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      bind:value={email}
                      onblur={() => handleBlur("email", email)}
                      oninput={() => handleInput("email", email)}
                      aria-invalid={touched.email && errors.email ? "true" : undefined}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      autocomplete="email"
                      placeholder="you@example.com"
                      class="form-input"
                      class:form-error={touched.email && errors.email}
                      class:form-valid={touched.email && !errors.email && email}
                    />
                    {#if touched.email && errors.email}
                      <p id="email-error" class="form-error-text" transition:slide={{ duration: 150 }}>{errors.email}</p>
                    {/if}
                  </div>
                </div>

                <div>
                  <label for="streetAddress" class="block text-sm font-medium mb-2">Street Address</label>
                  <input
                    type="text"
                    id="streetAddress"
                    bind:value={streetAddress}
                    autocomplete="street-address"
                    placeholder="123 Main St"
                    class="form-input"
                  />
                </div>

                <div class="grid gap-5 sm:grid-cols-3">
                  <div>
                    <label for="city" class="block text-sm font-medium mb-2">City</label>
                    <input
                      type="text"
                      id="city"
                      bind:value={city}
                      autocomplete="address-level2"
                      placeholder="City"
                      class="form-input"
                    />
                  </div>
                  <div>
                    <label for="state" class="block text-sm font-medium mb-2">State</label>
                    <select id="state" bind:value={formState} autocomplete="address-level1" class="form-select">
                      <option value="">Select...</option>
                      {#each US_STATES as s}
                        <option value={s}>{s}</option>
                      {/each}
                    </select>
                  </div>
                  <div>
                    <label for="zip" class="block text-sm font-medium mb-2">ZIP Code</label>
                    <input
                      type="text"
                      id="zip"
                      bind:value={zip}
                      onblur={() => handleBlur("zip", zip)}
                      oninput={() => handleInput("zip", zip)}
                      aria-invalid={touched.zip && errors.zip ? "true" : undefined}
                      aria-describedby={errors.zip ? "zip-error" : undefined}
                      autocomplete="postal-code"
                      placeholder="57001"
                      class="form-input"
                      class:form-error={touched.zip && errors.zip}
                      class:form-valid={touched.zip && !errors.zip && zip}
                    />
                    {#if touched.zip && errors.zip}
                      <p id="zip-error" class="form-error-text" transition:slide={{ duration: 150 }}>{errors.zip}</p>
                    {/if}
                  </div>
                </div>
              </div>
            </section>
          </div>

        <!-- Step 2: Availability -->
        {:else if currentStep === 1}
          <div class="space-y-8">
            <section class="rounded-lg border border-border/40 bg-white p-6">
              <h2 class="font-serif text-xl font-semibold text-foreground">
                Availability
                <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
              </h2>
              <div class="mt-5 space-y-6">
                <div>
                  <label for="startDate" class="block text-sm font-medium mb-2">Earliest Start Date</label>
                  <input type="date" id="startDate" bind:value={startDate} class="form-input" />
                </div>
                <div>
                  <p class="text-sm font-medium mb-3">Preferred Schedule</p>
                  <div class="flex flex-wrap gap-x-6 gap-y-3">
                    {#each SCHEDULE_OPTIONS as option}
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={schedule.includes(option)}
                          onchange={() => { schedule = toggleArrayItem(schedule, option); }}
                          class="custom-checkbox"
                        />
                        <span class="text-sm">{option}</span>
                      </label>
                    {/each}
                  </div>
                </div>
              </div>
            </section>
          </div>

        <!-- Step 3: Experience -->
        {:else if currentStep === 2}
          <div class="space-y-8">
            <!-- Employment History -->
            <section class="rounded-lg border border-border/40 bg-white p-6">
              <h2 class="font-serif text-xl font-semibold text-foreground">
                Employment History
                <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
              </h2>
              <p class="mt-2 text-sm text-muted-foreground">Optional — list up to {MAX_JOBS} previous positions.</p>

              <div class="mt-5 space-y-6">
                {#each jobs as job, i}
                  <div class="rounded-lg border border-border/30 bg-stone-50/50 p-5 space-y-4" transition:slide>
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-semibold text-muted-foreground">Position {i + 1}</p>
                      {#if i > 0}
                        <button type="button" onclick={() => { jobs = jobs.filter((_, idx) => idx !== i); }}
                          class="text-sm font-medium text-red-600 hover:text-red-700 transition-colors">
                          Remove
                        </button>
                      {/if}
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label for="employer{i+1}" class="block text-sm font-medium mb-2">Employer</label>
                        <input type="text" id="employer{i+1}" bind:value={job.employer} class="form-input" />
                      </div>
                      <div>
                        <label for="jobTitle{i+1}" class="block text-sm font-medium mb-2">Position/Title</label>
                        <input type="text" id="jobTitle{i+1}" bind:value={job.jobTitle} class="form-input" />
                      </div>
                    </div>
                    <div>
                      <label for="jobCityState{i+1}" class="block text-sm font-medium mb-2">City/State</label>
                      <input type="text" id="jobCityState{i+1}" bind:value={job.jobCityState} class="form-input" />
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label for="jobStart{i+1}" class="block text-sm font-medium mb-2">Start Date</label>
                        <input type="date" id="jobStart{i+1}" bind:value={job.jobStart} class="form-input" />
                      </div>
                      <div>
                        <label for="jobEnd{i+1}" class="block text-sm font-medium mb-2">End Date</label>
                        <input type="date" id="jobEnd{i+1}" bind:value={job.jobEnd} class="form-input" disabled={job.currentlyEmployed} />
                        <label class="mt-2 flex items-center gap-2 text-sm">
                          <input type="checkbox" bind:checked={job.currentlyEmployed}
                            onchange={() => { if (job.currentlyEmployed) job.jobEnd = ""; }}
                            class="custom-checkbox" />
                          Currently employed here
                        </label>
                      </div>
                    </div>
                    <div>
                      <label for="jobResponsibilities{i+1}" class="block text-sm font-medium mb-2">Responsibilities</label>
                      <textarea id="jobResponsibilities{i+1}" bind:value={job.jobResponsibilities} rows="3" class="form-input resize-y"></textarea>
                    </div>
                  </div>
                {/each}

                {#if jobs.length < MAX_JOBS}
                  <button type="button" onclick={() => { jobs = [...jobs, emptyJob()]; }}
                    class="w-full rounded-lg border-2 border-dashed border-border/40 py-3 text-sm font-medium text-muted-foreground hover:border-gold hover:text-gold transition-colors">
                    + Add Another Position
                  </button>
                {/if}
              </div>
            </section>

            <!-- Education -->
            <section class="rounded-lg border border-border/40 bg-white p-6">
              <h2 class="font-serif text-xl font-semibold text-foreground">
                Education
                <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
              </h2>
              <div class="mt-5 space-y-5">
                <div class="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label for="schoolName" class="block text-sm font-medium mb-2">School Name</label>
                    <input type="text" id="schoolName" bind:value={schoolName} class="form-input" />
                  </div>
                  <div>
                    <label for="schoolCityState" class="block text-sm font-medium mb-2">City/State</label>
                    <input type="text" id="schoolCityState" bind:value={schoolCityState} class="form-input" />
                  </div>
                </div>
                <div>
                  <label for="educationLevel" class="block text-sm font-medium mb-2">Highest Level Completed</label>
                  <select id="educationLevel" bind:value={educationLevel} class="form-select">
                    <option value="">Select...</option>
                    {#each Object.entries(EDUCATION_LEVELS) as [value, label]}
                      <option {value}>{label}</option>
                    {/each}
                  </select>
                </div>
                <div>
                  <label for="certifications" class="block text-sm font-medium mb-2">
                    Certifications <span class="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="certifications"
                    bind:value={certifications}
                    rows="3"
                    class="form-input resize-y"
                    placeholder="List any relevant certifications (e.g., ServSafe, Food Handler's Card)"
                  ></textarea>
                </div>
              </div>
            </section>

            <!-- Skills -->
            <section class="rounded-lg border border-border/40 bg-white p-6">
              <h2 class="font-serif text-xl font-semibold text-foreground">
                Skills
                <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
              </h2>
              <div class="mt-5 space-y-5">
                <div>
                  <p class="text-sm font-medium mb-3">Select all that apply</p>
                  <div class="flex flex-wrap gap-x-6 gap-y-3">
                    {#each SKILL_OPTIONS as skill}
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skills.includes(skill)}
                          onchange={() => { skills = toggleArrayItem(skills, skill); }}
                          class="custom-checkbox"
                        />
                        <span class="text-sm">{skill}</span>
                      </label>
                    {/each}
                  </div>
                </div>
                <div>
                  <label for="otherSkills" class="block text-sm font-medium mb-2">
                    Other Skills <span class="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="otherSkills"
                    bind:value={otherSkills}
                    class="form-input"
                    placeholder="Any other relevant skills"
                  />
                </div>
              </div>
            </section>
          </div>

        <!-- Step 4: References & Resume -->
        {:else if currentStep === 3}
          <div class="space-y-8">
            <!-- References -->
            <section class="rounded-lg border border-border/40 bg-white p-6">
              <h2 class="font-serif text-xl font-semibold text-foreground">
                References
                <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
              </h2>
              <div class="mt-5 space-y-6">
                <div class="rounded-lg border border-border/30 bg-stone-50/50 p-5 space-y-4">
                  <p class="text-sm font-semibold text-muted-foreground">Reference 1</p>
                  <div class="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label for="refName1" class="block text-sm font-medium mb-2">Name</label>
                      <input type="text" id="refName1" bind:value={refName1} class="form-input" />
                    </div>
                    <div>
                      <label for="refPhone1" class="block text-sm font-medium mb-2">Phone</label>
                      <input type="tel" id="refPhone1" value={refPhone1} oninput={(e) => { refPhone1 = formatPhone((e.target as HTMLInputElement).value); }} placeholder="(555) 123-4567" class="form-input" />
                    </div>
                    <div>
                      <label for="refRelationship1" class="block text-sm font-medium mb-2">Relationship</label>
                      <input type="text" id="refRelationship1" bind:value={refRelationship1} class="form-input" />
                    </div>
                  </div>
                </div>
                <div class="rounded-lg border border-border/30 bg-stone-50/50 p-5 space-y-4">
                  <p class="text-sm font-semibold text-muted-foreground">Reference 2</p>
                  <div class="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label for="refName2" class="block text-sm font-medium mb-2">Name</label>
                      <input type="text" id="refName2" bind:value={refName2} class="form-input" />
                    </div>
                    <div>
                      <label for="refPhone2" class="block text-sm font-medium mb-2">Phone</label>
                      <input type="tel" id="refPhone2" value={refPhone2} oninput={(e) => { refPhone2 = formatPhone((e.target as HTMLInputElement).value); }} placeholder="(555) 123-4567" class="form-input" />
                    </div>
                    <div>
                      <label for="refRelationship2" class="block text-sm font-medium mb-2">Relationship</label>
                      <input type="text" id="refRelationship2" bind:value={refRelationship2} class="form-input" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Resume Upload -->
            <section class="rounded-lg border border-border/40 bg-white p-6">
              <h2 class="font-serif text-xl font-semibold text-foreground">
                Resume
                <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
              </h2>
              <div class="mt-5">
                <p class="text-sm text-muted-foreground mb-3">PDF only, 5MB max</p>
                {#if resumeFile}
                  <div class="flex items-center gap-3 rounded-lg border border-border/40 bg-stone-50 p-4">
                    <svg class="h-8 w-8 text-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-foreground truncate">{resumeFile.name}</p>
                      <p class="text-xs text-muted-foreground">{formatFileSize(resumeFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      onclick={() => { resumeFile = null; }}
                      class="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Remove file"
                    >
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                {:else}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="relative rounded-lg border-2 border-dashed p-8 text-center transition-colors
                      {dragging ? 'border-gold bg-gold/5' : 'border-stone-300 hover:border-gold/60'}"
                    ondrop={handleDrop}
                    ondragover={handleDragOver}
                    ondragleave={() => { dragging = false; }}
                  >
                    <svg class="mx-auto h-10 w-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p class="mt-3 text-sm text-muted-foreground">
                      Drag and drop your resume here, or
                    </p>
                    <label class="mt-2 inline-block cursor-pointer rounded-md bg-gold px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gold-dark">
                      Browse Files
                      <input
                        type="file"
                        accept=".pdf"
                        class="sr-only"
                        onchange={(e) => handleFileSelect((e.target as HTMLInputElement).files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                {/if}
                {#if touched.resume && errors.resume}
                  <p class="form-error-text" transition:slide={{ duration: 150 }}>{errors.resume}</p>
                {/if}
              </div>
            </section>
          </div>

        <!-- Step 5: Review & Submit -->
        {:else if currentStep === 4}
          <div class="space-y-8">
            {#if submitResult?.success}
              <div class="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
                <svg class="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 class="mt-4 font-serif text-2xl font-semibold text-green-800">Application Submitted</h2>
                <p class="mt-2 text-green-700">{submitResult.message}</p>
              </div>
            {:else}
              <!-- Review: Position & You -->
              <section class="rounded-lg border border-border/40 bg-white p-6">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="font-serif text-xl font-semibold text-foreground">
                    Position & You
                    <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
                  </h2>
                  <button type="button" onclick={() => goToStep(0)} class="text-sm font-medium text-gold hover:text-gold-dark transition-colors">Edit</button>
                </div>
                <dl class="review-dl">
                  <div><dt>Position</dt><dd>{selectedJob?.title || position}</dd></div>
                  {#if needsAgeVerification}
                    <div><dt>Age Verified</dt><dd>{ageConfirmation ? "Yes" : "No"}</dd></div>
                  {/if}
                  <div><dt>Full Name</dt><dd>{fullName}</dd></div>
                  <div><dt>Email</dt><dd>{email}</dd></div>
                  <div><dt>Phone</dt><dd>{phone}</dd></div>
                  {#if streetAddress || city || formState || zip}
                    <div><dt>Address</dt><dd>{[streetAddress, city, formState, zip].filter(Boolean).join(", ")}</dd></div>
                  {/if}
                </dl>
              </section>

              <!-- Review: Availability -->
              <section class="rounded-lg border border-border/40 bg-white p-6">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="font-serif text-xl font-semibold text-foreground">
                    Availability
                    <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
                  </h2>
                  <button type="button" onclick={() => goToStep(1)} class="text-sm font-medium text-gold hover:text-gold-dark transition-colors">Edit</button>
                </div>
                <dl class="review-dl">
                  <div><dt>Start Date</dt><dd>{startDate || "Not provided"}</dd></div>
                  <div><dt>Schedule</dt><dd>{schedule.length > 0 ? schedule.join(", ") : "Not provided"}</dd></div>
                </dl>
              </section>

              <!-- Review: Experience -->
              <section class="rounded-lg border border-border/40 bg-white p-6">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="font-serif text-xl font-semibold text-foreground">
                    Experience
                    <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
                  </h2>
                  <button type="button" onclick={() => goToStep(2)} class="text-sm font-medium text-gold hover:text-gold-dark transition-colors">Edit</button>
                </div>
                <dl class="review-dl">
                  {#each jobs as job, i}
                    {#if job.employer || job.jobTitle}
                      <div class="col-span-full border-b border-border/30 pb-2 mb-2 {i > 0 ? 'mt-3' : ''}">
                        <dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Position {i + 1}</dt>
                      </div>
                      {#if job.employer}<div><dt>Employer</dt><dd>{job.employer}</dd></div>{/if}
                      {#if job.jobTitle}<div><dt>Title</dt><dd>{job.jobTitle}</dd></div>{/if}
                      {#if job.jobCityState}<div><dt>Location</dt><dd>{job.jobCityState}</dd></div>{/if}
                      {#if job.jobStart || job.jobEnd || job.currentlyEmployed}<div><dt>Dates</dt><dd>{[job.jobStart, job.currentlyEmployed ? "Present" : job.jobEnd].filter(Boolean).join(" — ")}</dd></div>{/if}
                      {#if job.jobResponsibilities}<div class="col-span-full"><dt>Responsibilities</dt><dd class="whitespace-pre-line">{job.jobResponsibilities}</dd></div>{/if}
                    {/if}
                  {/each}
                  {#if !jobs.some(j => j.employer || j.jobTitle)}
                    <div><dt>Employment</dt><dd class="text-muted-foreground italic">Not provided</dd></div>
                  {/if}
                  {#if schoolName || educationLevel}
                    <div class="col-span-full border-b border-border/30 pb-2 mb-2 mt-3">
                      <dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Education</dt>
                    </div>
                    {#if schoolName}<div><dt>School</dt><dd>{schoolName}</dd></div>{/if}
                    {#if schoolCityState}<div><dt>Location</dt><dd>{schoolCityState}</dd></div>{/if}
                    {#if educationLevel}<div><dt>Level</dt><dd>{EDUCATION_LEVELS[educationLevel] || educationLevel}</dd></div>{/if}
                    {#if certifications}<div class="col-span-full"><dt>Certifications</dt><dd>{certifications}</dd></div>{/if}
                  {/if}
                  {#if skills.length > 0 || otherSkills}
                    <div class="col-span-full border-b border-border/30 pb-2 mb-2 mt-3">
                      <dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Skills</dt>
                    </div>
                    {#if skills.length > 0}<div><dt>Skills</dt><dd>{skills.join(", ")}</dd></div>{/if}
                    {#if otherSkills}<div><dt>Other</dt><dd>{otherSkills}</dd></div>{/if}
                  {/if}
                </dl>
              </section>

              <!-- Review: References & Resume -->
              <section class="rounded-lg border border-border/40 bg-white p-6">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="font-serif text-xl font-semibold text-foreground">
                    References & Resume
                    <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
                  </h2>
                  <button type="button" onclick={() => goToStep(3)} class="text-sm font-medium text-gold hover:text-gold-dark transition-colors">Edit</button>
                </div>
                <dl class="review-dl">
                  {#if refName1 || refPhone1}
                    <div class="col-span-full border-b border-border/30 pb-2 mb-2">
                      <dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference 1</dt>
                    </div>
                    {#if refName1}<div><dt>Name</dt><dd>{refName1}</dd></div>{/if}
                    {#if refPhone1}<div><dt>Phone</dt><dd>{refPhone1}</dd></div>{/if}
                    {#if refRelationship1}<div><dt>Relationship</dt><dd>{refRelationship1}</dd></div>{/if}
                  {/if}
                  {#if refName2 || refPhone2}
                    <div class="col-span-full border-b border-border/30 pb-2 mb-2 {refName1 || refPhone1 ? 'mt-3' : ''}">
                      <dt class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference 2</dt>
                    </div>
                    {#if refName2}<div><dt>Name</dt><dd>{refName2}</dd></div>{/if}
                    {#if refPhone2}<div><dt>Phone</dt><dd>{refPhone2}</dd></div>{/if}
                    {#if refRelationship2}<div><dt>Relationship</dt><dd>{refRelationship2}</dd></div>{/if}
                  {/if}
                  {#if !refName1 && !refPhone1 && !refName2 && !refPhone2}
                    <div><dt>References</dt><dd class="text-muted-foreground italic">Not provided</dd></div>
                  {/if}
                  <div>
                    <dt>Resume</dt>
                    <dd>{resumeFile ? `${resumeFile.name} (${formatFileSize(resumeFile.size)})` : "Not provided"}</dd>
                  </div>
                </dl>
              </section>

              <!-- Certification -->
              <section class="rounded-lg border border-border/40 bg-white p-6">
                <h2 class="font-serif text-xl font-semibold text-foreground">
                  Certification
                  <span class="mt-1 block h-0.5 w-10 bg-gold"></span>
                </h2>
                <div class="mt-5 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="certification"
                    bind:checked={certification}
                    onblur={() => handleBlur("certification", certification)}
                    onchange={() => handleInput("certification", certification)}
                    aria-invalid={touched.certification && errors.certification ? "true" : undefined}
                    aria-describedby={errors.certification ? "cert-error" : undefined}
                    class="custom-checkbox mt-0.5"
                  />
                  <label for="certification" class="text-sm text-foreground">
                    I certify that the information provided in this application is true and complete to the best of my knowledge. I understand that any falsification or omission of information may be grounds for rejection of my application or termination of employment. <span class="text-destructive" aria-hidden="true">*</span>
                  </label>
                </div>
                {#if touched.certification && errors.certification}
                  <p id="cert-error" class="form-error-text mt-2" transition:slide={{ duration: 150 }}>{errors.certification}</p>
                {/if}
              </section>

              <!-- Turnstile -->
              <div class="cf-turnstile" data-sitekey="0x4AAAAAACHr1kbpPYRV4EtW" data-theme="light" aria-label="Security verification"></div>

              <!-- Submit Error -->
              {#if submitResult && !submitResult.success}
                <div class="rounded-lg border border-red-200 bg-red-50 p-4" role="alert" transition:slide={{ duration: 200 }}>
                  <p class="text-sm text-red-700">{submitResult.message}</p>
                </div>
              {/if}
            {/if}
          </div>
        {/if}

        <!-- Navigation -->
        {#if !submitResult?.success}
          <div class="mt-8 flex items-center {currentStep > 0 ? 'justify-between' : 'justify-end'}">
            {#if currentStep > 0}
              <Button variant="gold-outline" onclick={prevStep}>
                <svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Back
              </Button>
            {/if}
            {#if currentStep < STEPS.length - 1}
              <Button variant="gold" onclick={nextStep}>
                Continue
                <svg class="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Button>
            {:else}
              <Button variant="gold" onclick={handleSubmit} disabled={submitting}>
                {#if submitting}
                  <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Submitting...
                {:else}
                  Submit Application
                {/if}
              </Button>
            {/if}
          </div>
        {/if}
      </div>
    {/key}
  </div>
</div>

<style>
  /* Form input base styles */
  .form-input {
    width: 100%;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border);
    background-color: white;
    padding: 0.625rem 1rem;
    font-size: 0.9375rem;
    line-height: 1.5;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .form-input:focus {
    border-color: var(--color-gold);
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 20%, transparent);
  }

  .form-input.form-error {
    border-color: var(--color-destructive);
  }

  .form-input.form-error:focus {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-destructive) 20%, transparent);
  }

  .form-input.form-valid {
    border-color: #16a34a;
  }

  .form-input.form-valid:focus {
    box-shadow: 0 0 0 3px color-mix(in srgb, #16a34a 20%, transparent);
  }

  /* Select styles match input */
  .form-select {
    width: 100%;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border);
    background-color: white;
    padding: 0.625rem 1rem;
    font-size: 0.9375rem;
    line-height: 1.5;
    transition: border-color 0.15s, box-shadow 0.15s;
    appearance: none;
  }

  .form-select:focus {
    border-color: var(--color-gold);
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 20%, transparent);
  }

  .form-select.form-error {
    border-color: var(--color-destructive);
  }

  .form-select.form-valid {
    border-color: #16a34a;
  }

  /* Error text */
  .form-error-text {
    margin-top: 0.375rem;
    font-size: 0.8125rem;
    color: var(--color-destructive);
  }

  /* Review definition list */
  .review-dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem 1rem;
  }

  .review-dl > div {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .review-dl dt {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-muted-foreground);
  }

  .review-dl dd {
    font-size: 0.875rem;
    color: var(--color-foreground);
  }

  .review-dl > .col-span-full {
    grid-column: 1 / -1;
  }

  @media (max-width: 639px) {
    .review-dl {
      grid-template-columns: 1fr;
    }
  }
</style>
