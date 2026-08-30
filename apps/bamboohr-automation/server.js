// Local entry point. On Netlify the same app runs as a serverless function —
// see netlify/functions/api.mjs.

import 'dotenv/config';
import { createApp } from './src/app.js';

const app = createApp({ serveStatic: true });

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  const live = Boolean(process.env.BAMBOOHR_SUBDOMAIN && process.env.BAMBOOHR_API_KEY);
  console.log(`\n  Wholesale Payments hiring site running at http://localhost:${port}`);
  console.log(`  Mode: ${live ? `LIVE (${process.env.BAMBOOHR_SUBDOMAIN}.bamboohr.com)` : 'DEMO (no BambooHR credentials configured)'}`);
  console.log(`  Email: ${process.env.SMTP_HOST && process.env.SMTP_USER ? 'SMTP configured' : 'simulated (no SMTP configured)'}\n`);
});
