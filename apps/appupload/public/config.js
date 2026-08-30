/* AppUpload baked defaults — committed once, every browser gets them.
   Anything set in the in-app Settings (saved to this browser) wins over these. */
window.AU_CONFIG = {
  // Anthropic API key used for extraction. Leave "" to require each browser to
  // save one in Settings (or use demo mode). Committing a key here makes every
  // device work with zero setup — this is a team-internal tool; the key is
  // visible to anyone who can open the site.
  apiKey: "",
  model: "claude-sonnet-4-6",
  // Default sales-rep roster for the picker (editable in-app; custom reps persist per browser).
  reps: [
    "Adam Drexler",
    "Gabriel Craft",
    "Isaac Jenkins",
    "Jabe Schoenrock",
    "Jaden Dufek",
    "Jason Coutcher",
    "Judah Steelman",
    "Justin Woodruff",
    "Lloyd Cruz",
    "Max Alperstein",
    "Sadie Scoville",
    "Seth Manshum",
    "Timothy Constenius",
    "Walter Smith",
  ],
};
