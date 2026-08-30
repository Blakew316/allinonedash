/* =========================================================
   App configuration.

   Email delivery uses EmailJS (https://www.emailjs.com — free
   tier available). Create a service + template there, then fill
   in the three IDs below. Until they're filled in, the app falls
   back to opening the device's mail client with the full score
   breakdown pre-written (nothing breaks — email still works).

   Results template variables (results go to the MANAGER —
   candidates never see their score):
     {{to_email}} {{candidate_name}} {{candidate_email}}
     {{candidate_phone}} {{candidate_role}} {{score}} {{tier}}
     {{tier_blurb}} {{breakdown_text}} {{completed_date}}
   Invite template variables:
     {{to_email}} {{candidate_name}} {{candidate_phone}}
     {{form_link}} {{manager_email}} {{company_name}}
   ========================================================= */

window.WPQ_CONFIG = {
  emailjs: {
    publicKey: "",         // e.g. "AbC123xyz..."
    serviceId: "",         // e.g. "service_wholesale"
    templateId: "",        // e.g. "template_results" — results/confirmation email
    inviteTemplateId: "",  // e.g. "template_invite" — "please take the questionnaire" email
  },

  // Optional: also send/CC every result to a hiring manager inbox.
  // With EmailJS configured, expose {{manager_email}} in your template's
  // CC/BCC field. In mailto fallback mode this address is added as CC.
  hiringManagerEmail: "",

  companyName: "Wholesale Payments",

  // Teams shown in the dashboard's team picker — choosing one
  // auto-fills the results-delivery email with the team lead's address.
  teams: [
    { name: "Team Indigo",   email: "erik.demster@wholesalepayments.com" },
    { name: "Team Mahogany", email: "walker.hall@wholesalepayments.com" },
    { name: "Team Chrome",   email: "donovan.staggs@wholesalepayments.com" },
    { name: "Team Shadow",   email: "bobby.ingram@wholesalepayments.com" },
    { name: "Team Maverick", email: "justin.woodruff@wholesalepayments.com" },
    { name: "Team Mercury",  email: "michael.reed@wholesalepayments.com" },
  ],
};
