/**
 * Centralized site information
 * Edit hours, contact info, and address here to update across the entire site
 */

export const hours = {
  // Regular tasting room hours
  tastingRoom: [
    { days: "Monday", hours: "Closed" },
    { days: "Tuesday", hours: "Closed" },
    { days: "Wednesday", hours: "Closed" },
    { days: "Thursday", hours: "Closed" },
    { days: "Friday", hours: "12 PM - 5 PM" },
    { days: "Saturday", hours: "12 PM - 5 PM" },
    { days: "Sunday", hours: "12 PM - 4 PM" },
  ],
  // Optional: Add seasonal notes or closures
  note: "", // e.g., "Closed Thanksgiving & Christmas"
};

export const contact = {
  phone: "(605) 624-4500",
  email: "wine@valiantvineyards.us",
};

export const address = {
  street: "1500 W. Main St",
  city: "Vermillion",
  state: "SD",
  zip: "57069",
  full: "1500 W. Main St, Vermillion, SD 57069",
  googleMapsUrl: "https://maps.google.com/?q=Valiant+Vineyards+Vermillion+SD",
  coordinates: {
    lat: 42.78164954978507,
    lon: -96.95279070399366,
  },
};

export const social = {
  facebook: "https://www.facebook.com/valiant.vineyards",
  instagram: "https://www.instagram.com/valiant_vineyards/",
};

// Announcement bar above the nav — set enabled: false to disable.
// Changing text auto-resets dismissal for returning visitors.
export const announcement = {
  enabled: false,
  text: "Bourbon, Beer & BBQ Bacchanal - Friday, Feb. 20th at 6:30 PM",
  link: "https://aftontickets.com/bbb-2026",
  linkText: "Get Your Tickets Online",
};
