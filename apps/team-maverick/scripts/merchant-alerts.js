const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const INDEX_PATH = path.join(__dirname, '..', 'index.html');
const TRACKING_PATH = path.join(__dirname, 'merchant-tracking.json');
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'justin.woodruff@wholesalepayments.com';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

// ── Read DATA from index.html ──────────────────────────────────────
function readSalesData() {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const m = html.match(/var DATA = (\{[\s\S]*?\});\s*\n/);
  if (!m) throw new Error('Cannot find DATA in index.html');
  return JSON.parse(m[1]);
}

// ── Load / save tracking state ─────────────────────────────────────
function loadTracking() {
  try { return JSON.parse(fs.readFileSync(TRACKING_PATH, 'utf8')); }
  catch (e) { return { merchants: {} }; }
}
function saveTracking(t) {
  fs.writeFileSync(TRACKING_PATH, JSON.stringify(t, null, 2) + '\n', 'utf8');
}

// ── Collect all non-processing merchants across all months ─────────
function collectNonProcessing(DATA) {
  const seen = {};
  const months = Object.keys(DATA).sort(function (a, b) {
    return new Date('1 ' + a) - new Date('1 ' + b);
  });
  months.forEach(function (month) {
    var deals = DATA[month].deals || [];
    deals.forEach(function (d) {
      if (d.proc === 'Yes') {
        // Merchant started processing — clear any tracking
        var key = d.name + '||' + d.rep;
        seen[key] = { processing: true };
      }
    });
    deals.forEach(function (d) {
      if (d.proc !== 'No') return;
      var key = d.name + '||' + d.rep;
      if (seen[key] && seen[key].processing) return;
      seen[key] = {
        name: d.name,
        rep: d.rep,
        status: d.status || '',
        vol: d.vol || '$0',
        txn: d.txn || 0,
        tier: d.tier || 'Red',
        month: month,
        delivered: /^deliver|installed/i.test(d.status || ''),
      };
    });
  });
  // Filter out merchants that started processing in a later month
  var result = {};
  Object.keys(seen).forEach(function (k) {
    if (!seen[k].processing) result[k] = seen[k];
  });
  return result;
}

// ── Day difference helper ──────────────────────────────────────────
function daysSince(dateStr) {
  var d = new Date(dateStr);
  var now = new Date();
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.floor((now - d) / 86400000);
}

// ── Build alert lists ──────────────────────────────────────────────
function checkAlerts(nonProc, tracking) {
  var today = new Date().toISOString().split('T')[0];
  var alerts2day = [];
  var alerts3day = [];

  Object.keys(nonProc).forEach(function (key) {
    var merchant = nonProc[key];
    var t = tracking.merchants[key];

    if (!t) {
      // First time seeing this merchant as non-processing
      tracking.merchants[key] = {
        firstSeen: today,
        status: merchant.status,
        notified2day: false,
        notified3day: false,
      };
      return;
    }

    var days = daysSince(t.firstSeen);

    // The two alert buckets are mutually exclusive so no merchant is ever
    // counted twice:
    //   • Equipment delivered/installed but not processing  → 2-day bucket
    //   • Still awaiting equipment, no payments              → 3-day bucket
    if (merchant.delivered) {
      // 2-day alert: equipment delivered or installed but not processing
      if (days >= 2 && !t.notified2day) {
        alerts2day.push({
          name: merchant.name,
          rep: merchant.rep,
          status: merchant.status,
          days: days,
          month: merchant.month,
          vol: merchant.vol,
          txn: merchant.txn,
          tier: merchant.tier,
        });
        t.notified2day = true;
      }
    } else {
      // 3-day alert: equipment not yet delivered and no payments processed
      if (days >= 3 && !t.notified3day) {
        alerts3day.push({
          name: merchant.name,
          rep: merchant.rep,
          status: merchant.status,
          days: days,
          month: merchant.month,
          vol: merchant.vol,
          txn: merchant.txn,
          tier: merchant.tier,
        });
        t.notified3day = true;
      }
    }
  });

  // Clean up merchants that started processing
  Object.keys(tracking.merchants).forEach(function (key) {
    if (!nonProc[key]) delete tracking.merchants[key];
  });

  // Order each list by severity: Red → Yellow → Green → White, then by the
  // longest-overdue first, then alphabetically — so the email reads top-down
  // from most urgent to least instead of in raw data order.
  var tierRank = { Red: 0, Yellow: 1, Green: 2, White: 3 };
  function bySeverity(a, b) {
    var ra = tierRank[a.tier] != null ? tierRank[a.tier] : 9;
    var rb = tierRank[b.tier] != null ? tierRank[b.tier] : 9;
    if (ra !== rb) return ra - rb;
    if (b.days !== a.days) return b.days - a.days;
    return a.name.localeCompare(b.name);
  }
  alerts2day.sort(bySeverity);
  alerts3day.sort(bySeverity);

  return { alerts2day: alerts2day, alerts3day: alerts3day };
}

// ── Build HTML email ───────────────────────────────────────────────
function buildEmail(alerts2day, alerts3day) {
  var tierColor = {
    White: '#6B7280', Green: '#16A34A', Yellow: '#D97706', Red: '#DC2626',
  };

  function merchantRow(a) {
    return '<tr>' +
      '<td style="padding:10px 14px;border-bottom:1px solid #eee;font-weight:600">' + a.name + '</td>' +
      '<td style="padding:10px 14px;border-bottom:1px solid #eee">' + a.rep + '</td>' +
      '<td style="padding:10px 14px;border-bottom:1px solid #eee">' + a.status + '</td>' +
      '<td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center">' + a.days + '</td>' +
      '<td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center">' +
        '<span style="background:' + (tierColor[a.tier] || '#6B7280') + '22;color:' + (tierColor[a.tier] || '#6B7280') +
        ';padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700">' + a.tier + '</span></td>' +
      '<td style="padding:10px 14px;border-bottom:1px solid #eee">' + a.month + '</td>' +
    '</tr>';
  }

  function section(title, subtitle, alerts, color) {
    if (!alerts.length) return '';
    return '<div style="margin:24px 0 8px">' +
      '<h2 style="margin:0 0 4px;font-size:16px;color:' + color + '">' + title + '</h2>' +
      '<p style="margin:0 0 12px;font-size:13px;color:#6B7280">' + subtitle + '</p>' +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
      '<thead><tr style="background:#F9FAFB">' +
        '<th style="padding:8px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;border-bottom:2px solid #E5E7EB">Merchant</th>' +
        '<th style="padding:8px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;border-bottom:2px solid #E5E7EB">Sales Rep</th>' +
        '<th style="padding:8px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;border-bottom:2px solid #E5E7EB">Status</th>' +
        '<th style="padding:8px 14px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;border-bottom:2px solid #E5E7EB">Days</th>' +
        '<th style="padding:8px 14px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;border-bottom:2px solid #E5E7EB">Tier</th>' +
        '<th style="padding:8px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;border-bottom:2px solid #E5E7EB">Month</th>' +
      '</tr></thead><tbody>' +
      alerts.map(merchantRow).join('') +
      '</tbody></table>';
  }

  var total = alerts2day.length + alerts3day.length;

  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;background:#F5F6F8;font-family:-apple-system,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">' +
    '<div style="max-width:680px;margin:24px auto;background:#fff;border-radius:10px;border:1px solid #E5E7EB;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
      '<div style="background:#1A1D23;padding:20px 24px;color:#fff">' +
        '<h1 style="margin:0;font-size:18px;font-weight:700;letter-spacing:.3px">TEAM MAVERICK &mdash; Merchant Alert</h1>' +
        '<p style="margin:6px 0 0;font-size:13px;color:#9CA3AF">' + total + ' merchant' + (total !== 1 ? 's' : '') + ' need attention &middot; ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '</p>' +
      '</div>' +
      '<div style="padding:8px 24px 24px">' +
        section(
          'Equipment Delivered — Not Processing (2+ Days)',
          'These merchants had equipment delivered or installed but haven\'t processed any payments.',
          alerts2day, '#D97706'
        ) +
        section(
          'No Payments Processed (3+ Days)',
          'These merchants are still awaiting equipment delivery and have processed no payments after 3+ days.',
          alerts3day, '#DC2626'
        ) +
      '</div>' +
      '<div style="padding:16px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;font-size:12px;color:#6B7280;text-align:center">' +
        'Wholesale Payments &middot; Team Maverick Dashboard &middot; Automated Alert' +
      '</div>' +
    '</div></body></html>';
}

// ── Send email ─────────────────────────────────────────────────────
async function sendEmail(html, count) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.log('SMTP credentials not configured — printing email to console');
    console.log('To:', NOTIFY_EMAIL);
    console.log('Subject: [Maverick Alert] ' + count + ' merchant(s) not processing');
    console.log(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    return;
  }

  var transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_USER,
    to: NOTIFY_EMAIL,
    subject: '[Maverick Alert] ' + count + ' merchant(s) not processing',
    html: html,
  });

  console.log('Alert email sent to', NOTIFY_EMAIL);
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  var DATA = readSalesData();
  var nonProc = collectNonProcessing(DATA);
  var tracking = loadTracking();

  console.log('Non-processing merchants:', Object.keys(nonProc).length);
  console.log('Currently tracked:', Object.keys(tracking.merchants).length);

  var result = checkAlerts(nonProc, tracking);
  saveTracking(tracking);

  var total = result.alerts2day.length + result.alerts3day.length;
  console.log('2-day alerts (delivered/installed):', result.alerts2day.length);
  console.log('3-day alerts (no payments):', result.alerts3day.length);

  if (total === 0) {
    console.log('No new alerts today');
    return;
  }

  result.alerts2day.forEach(function (a) {
    console.log('  2-DAY:', a.name, '(' + a.rep + ') —', a.days, 'days since delivery');
  });
  result.alerts3day.forEach(function (a) {
    console.log('  3-DAY:', a.name, '(' + a.rep + ') —', a.days, 'days without processing');
  });

  var emailHtml = buildEmail(result.alerts2day, result.alerts3day);
  await sendEmail(emailHtml, total);
}

// Run when invoked directly (e.g. by the GitHub Actions workflow). Exporting
// the functions lets the email be previewed/tested without sending mail.
if (require.main === module) {
  main().catch(function (err) {
    console.error('Alert check failed:', err.message || err);
    process.exit(1);
  });
}

module.exports = {
  readSalesData: readSalesData,
  collectNonProcessing: collectNonProcessing,
  loadTracking: loadTracking,
  checkAlerts: checkAlerts,
  buildEmail: buildEmail,
};
