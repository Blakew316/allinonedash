"""Shared chrome and section builders for the Customer Connect site."""

from icons import icon, solid_star

SITE_NAME = "Customer Connect"
PARENT = "Wholesale Payments"
PHONE_DISPLAY = "(806) 606-6500"
PHONE_TEL = "+18066066500"
EMAIL = "support@customerconnectwp.com"
ADDRESS_LINES = ["3704 Benbrook Blvd.", "Fort Worth, TX 76116"]

# --------------------------------------------------------------------------
# Navigation model
# --------------------------------------------------------------------------

SOLUTIONS = [
    ("Customer Growth &amp; Retention", [
        ("customer-loyalty.html", "loyalty", "Customer Loyalty",
         "Turn first-time buyers into repeat customers."),
        ("customer-retention.html", "repeat", "Customer Retention",
         "Keep customers returning with timely follow-ups and personalized messaging."),
        ("text-marketing.html", "send", "Text Marketing",
         "Reach your audience directly where they’re most active — on their phones."),
    ]),
    ("Reputation &amp; Reviews", [
        ("reputation-management.html", "star", "Reputation Management",
         "Build trust and grow with reviews and feedback management."),
    ]),
    ("Employee &amp; Team Engagement", [
        ("employee-engagement-employee-engagement-and-performance-tracking.html",
         "team", "Employee Engagement", "See your team in action."),
        ("recruiting-simplified.html", "user-plus", "Recruiting Simplified",
         "Attract, track and retain top talent without the manual follow-ups."),
    ]),
    ("Insights &amp; Analysis", [
        ("data-tracking-real-time-data-tracking-and-insights.html", "activity",
         "Data Tracking",
         "See the full picture with real-time insights and campaign metrics."),
    ]),
]

PRODUCTS = [
    ("Platform Tools", [
        ("loyalty-program.html", "gift", "Loyalty Program",
         "Custom loyalty and tailored campaigns that keep customers coming back."),
        ("sms-mms.html", "message-dots", "SMS &amp; MMS",
         "A powerhouse for driving quick actions like visits or purchases."),
        ("custom-mobile-web-app.html", "smartphone", "Custom Mobile Web App",
         "Your brand. Your customers. All in one mobile hub."),
        ("1-to-1-conversations.html", "messages-two", "1 to 1 Conversations",
         "Connect directly with each customer in a personal manner."),
        ("online-reviews.html", "star", "Online Reviews",
         "Collect, manage and showcase reviews automatically."),
        ("kiosks.html", "kiosk", "Kiosk",
         "Engage customers with interactive kiosk solutions."),
    ]),
    ("Success Metrics", [
        ("growth-conversion-turn-customer-interactions-into-revenue.html",
         "trending-up", "Growth Conversion",
         "Turn every text, click and visit into measurable revenue."),
        ("customer-success.html", "handshake", "Customer Success",
         "See how we help businesses grow with real results."),
        ("compliance.html", "shield", "Compliance",
         "Stay protected and fully compliant with texting regulations."),
        ("data-analytics.html", "pie-chart", "Data Analytics",
         "Unlock insights and drive decisions with powerful analytics."),
    ]),
]

# --------------------------------------------------------------------------
# Shared content blocks reused across pages
# --------------------------------------------------------------------------

TESTIMONIALS = [
    ("We were looking for a better way to communicate directly with our customers, "
     "especially for specials and updates. Customer Connect turned out to be exactly "
     "what our business needed. It’s affordable, easy to use, and flexible. Our customers "
     "sign up via QR code or kiosk, and we can quickly send messages, promotions, and "
     "track results. I expect this platform to be a big benefit to our business.",
     "Anna Sullivan", "Carl’s Catfish", "AS", 5),
    ("This platform helps us easily connect with our guests! This company is great to work with!",
     "Daniel S.", "Rafferty’s", "DS", 5),
    ("This software has been a great addition to my local store marketing. I have several "
     "stores with 3,000+ customer sign-ups! This large database allows me to increase revenue "
     "by sending out textALERTS about $5 Friday, promote additional offers and or sell gift cards!",
     "Paul R.", "Smoothie King", "PR", 5),
]

FAQS = [
    ("What is Customer Connect?",
     "<p>A <strong>text marketing and communication platform</strong> that helps businesses "
     "connect with customers and employees via SMS. It lets you send promotions, reminders, "
     "and automated messages to drive engagement and increase revenue.</p>"),
    ("How does Customer Connect work?",
     "<ul><li><strong>Customers opt in</strong> via text, QR code, web form, or in-store kiosk.</li>"
     "<li><strong>You send messages</strong> like promotions, event reminders, or loyalty rewards.</li>"
     "<li><strong>Customers respond and engage</strong>, helping you drive repeat business.</li></ul>"),
    ("Who can use Customer Connect?",
     "<p>Any business can use Customer Connect. It’s a particularly strong fit for:</p>"
     "<ul><li><strong>Retail &amp; restaurants</strong> — coupons, loyalty rewards</li>"
     "<li><strong>Salons &amp; gyms</strong> — appointment reminders, promotions</li>"
     "<li><strong>Service businesses</strong> — customer updates, scheduling</li>"
     "<li><strong>Healthcare &amp; dental offices</strong> — patient reminders</li>"
     "<li><strong>Corporate teams</strong> — employee alerts, shift updates</li></ul>"),
    ("How fast can we launch?",
     "<p>Most merchants are live within a few days. We register your dedicated toll-free "
     "texting number, walk you through step-by-step onboarding, and help you import or grow "
     "your first contact list with QR codes, web forms, and kiosks.</p>"),
    ("Is texting through the platform compliant?",
     "<p>Yes. TCPA and CTIA safeguards are built in — verified opt-in capture, automatic "
     "STOP handling, non-marketing list updates, and full message history for audits. See the "
     "<a href=\"compliance.html\">Compliance</a> page for the details.</p>"),
]

MARQUEE_ITEMS = [
    ("utensils", "Restaurants"), ("shopping-bag", "Retail"), ("scissors", "Salons &amp; Spas"),
    ("dumbbell", "Fitness"), ("wrench", "Auto Shops"), ("truck", "Food Trucks"),
    ("paw", "Pet Services"), ("flag", "Golf Courses"), ("ticket", "Entertainment"),
    ("stethoscope", "Healthcare"), ("building", "Franchises"), ("briefcase", "Services"),
]


# --------------------------------------------------------------------------
# Document chrome
# --------------------------------------------------------------------------

def head(title, description, active=None, canonical=None, body_class=""):
    """Opening markup through <body> plus the sticky header."""
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} | {site}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#00115b">
<meta name="author" content="{parent} dba {site}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{site}">
<meta property="og:title" content="{title} | {site}">
<meta property="og:description" content="{desc}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title} | {site}">
<meta name="twitter:description" content="{desc}">
{canon}<link rel="icon" href="assets/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<meta name="apple-mobile-web-app-title" content="WPI CC">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="stylesheet" href="assets/css/site.css">
</head>
<body class="{bodyclass}">
<div class="page-veil" aria-hidden="true"></div>
<div class="scroll-progress" aria-hidden="true"></div>
<a class="skip-link" href="#main">Skip to content</a>
{header}
<main id="main">
""".format(
        title=title, site=SITE_NAME, desc=description, parent=PARENT,
        canon=('<link rel="canonical" href="%s">\n' % canonical) if canonical else "",
        bodyclass=body_class, header=site_header(active))


def _mega(cols, foot_text, foot_link, foot_label):
    groups = []
    for heading, links in cols:
        items = "".join(
            '<a class="mega-link" href="{href}">'
            '<span class="mega-ico">{ico}</span>'
            '<span class="mega-copy"><strong>{name}</strong><span>{desc}</span></span></a>'.format(
                href=href, ico=icon(ic), name=name, desc=desc)
            for href, ic, name, desc in links)
        groups.append('<div class="mega-col"><span class="micro">%s</span>%s</div>'
                      % (heading, items))
    return ('<div class="mega" role="region"><div class="mega-grid">%s</div>'
            '<div class="mega-foot"><span>%s</span>'
            '<a class="link-arrow" href="%s">%s %s</a></div></div>'
            % ("".join(groups), foot_text, foot_link, foot_label,
               icon("arrow-right", cls="ico")))


def site_header(active=None):
    def cur(slug):
        return ' aria-current="page"' if active == slug else ""

    # The supplied Wholesale Payments lockup already carries the parent wordmark,
    # so the header pairs it with the product name rather than repeating "by WP".
    brand = ('<a class="brand" href="index.html" aria-label="{site} home">'
             '<img class="brand-logo" src="assets/img/logo.png" alt="{parent}" '
             'width="876" height="217">'
             '<span class="brand-rule" aria-hidden="true"></span>'
             '<span class="brand-product">Customer Connect</span></a>').format(
        site=SITE_NAME, parent=PARENT)

    nav = """<nav class="nav" aria-label="Primary">
  <div class="nav-item has-mega">
    <button class="nav-link" type="button">Solutions {chev}</button>
    {solutions}
  </div>
  <div class="nav-item has-mega">
    <button class="nav-link" type="button">Products {chev}</button>
    {products}
  </div>
  <div class="nav-item"><a class="nav-link" href="pricing.html"{p_cur}>Pricing</a></div>
  <div class="nav-item"><a class="nav-link" href="blog.html"{b_cur}>Resources</a></div>
</nav>""".format(
        chev=icon("chevron-down", cls="chev"),
        solutions=_mega(SOLUTIONS, "Not sure where to start?",
                        "connect-grow.html", "See the full platform"),
        products=_mega(PRODUCTS, "Every plan includes onboarding and support.",
                       "pricing.html", "Compare plans"),
        p_cur=cur("pricing"), b_cur=cur("blog"))

    actions = """<div class="nav-actions">
  <a class="btn btn-quiet btn-sm" href="sign-in.html">Login</a>
  <a class="btn btn-primary btn-sm" href="book-demo.html">{cal} Book a Demo</a>
  <button class="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">
    <i></i><i></i><i></i>
  </button>
</div>""".format(cal=icon("calendar", cls="ico"))

    return """<div class="topbar">
  <div class="shell">
    <div class="topbar-items tagline">
      <span>{zap} It starts with a message. It ends with loyalty.</span>
    </div>
    <div class="topbar-items">
      <span class="hide-sm">{shield} TCPA &amp; CTIA compliant</span>
      <a href="tel:{tel}">{phone} Call or text {phone_d}</a>
    </div>
  </div>
</div>
<header class="site-header">
  <div class="shell header-inner">
    {brand}
    {nav}
    {actions}
  </div>
</header>
{drawer}""".format(
        zap=icon("zap"), shield=icon("shield"), phone=icon("phone"),
        tel=PHONE_TEL, phone_d=PHONE_DISPLAY,
        brand=brand, nav=nav, actions=actions, drawer=_drawer())


def _drawer():
    def group(label, cols):
        links = "".join(
            '<a href="%s">%s</a>' % (href, name)
            for _, sub in cols for href, _ic, name, _d in sub)
        return ("""<div class="drawer-group">
  <button class="drawer-toggle" type="button">{label} {chev}</button>
  <div class="drawer-panel"><div>{links}</div></div>
</div>""".format(label=label, chev=icon("chevron-down", cls="chev"), links=links))

    return """<div class="drawer" id="drawer">
  <div class="shell">
    {sol}
    {prod}
    <div class="drawer-group"><a class="drawer-link" href="pricing.html">Pricing</a></div>
    <div class="drawer-group"><a class="drawer-link" href="blog.html">Resources</a></div>
    <div class="drawer-group"><a class="drawer-link" href="connect-grow.html">Why Customer Connect</a></div>
    <div class="drawer-group"><a class="drawer-link" href="troubleshooting.html">Kiosk Support</a></div>
    <div class="drawer-cta">
      <a class="btn btn-primary btn-lg btn-block" href="book-demo.html">Book a Demo</a>
      <a class="btn btn-ghost btn-block" href="sign-in.html">Login</a>
      <a class="btn btn-quiet btn-block" href="tel:{tel}">Call or text {phone}</a>
    </div>
  </div>
</div>""".format(sol=group("Solutions", SOLUTIONS), prod=group("Products", PRODUCTS),
                 tel=PHONE_TEL, phone=PHONE_DISPLAY)


def footer():
    social = "".join(
        '<a href="#" aria-label="%s">%s</a>' % (label, icon(ic))
        for ic, label in [("facebook", "Facebook"), ("instagram", "Instagram"),
                          ("linkedin", "LinkedIn"), ("x-social", "X"), ("youtube", "YouTube")])

    def col(title, links):
        items = "".join('<li><a href="%s">%s</a></li>' % (h, t) for h, t in links)
        return '<div class="footer-col"><h5>%s</h5><ul>%s</ul></div>' % (title, items)

    return """</main>
<footer class="site-footer">
  <div class="shell footer-main">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand brand-light" href="index.html" aria-label="{site} home">
          <img class="brand-mark" src="assets/img/mark.png" alt="" width="143" height="217">
          <span class="brand-type"><span class="brand-name">Customer Connect</span>
          <span class="brand-by">by {parent}</span></span>
        </a>
        <p>The engagement platform behind 10,000+ merchants. Loyalty, text marketing,
        reviews, and real-time insights in one place — built and supported by {parent}.</p>
        <div class="footer-social">{social}</div>
      </div>
      {platform}
      {company}
      <div class="footer-col">
        <h5>Contact</h5>
        <div class="footer-contact">
          <div>{ph}<span><a href="tel:{tel}">{phone}</a><br>Call or text us</span></div>
          <div>{ml}<span><a href="mailto:{email}">{email}</a></span></div>
          <div>{pin}<span>{addr}</span></div>
        </div>
      </div>
    </div>
    <p class="footer-compliance">
      Message frequency varies. Message and data rates may apply. Reply STOP to opt out,
      HELP for help. Mobile opt-in data and consent are never shared with third parties or
      affiliates for marketing purposes. {parent}, Corp. d/b/a {site}.
    </p>
  </div>
  <div class="shell footer-bar">
    <span>© <span data-year>2026</span> {site} — All rights reserved.</span>
    <div class="footer-legal">
      <a href="privacy.html">Privacy Policy</a>
      <a href="merchant-terms.html">Terms &amp; Conditions</a>
      <a href="compliance.html">Compliance</a>
      <a href="troubleshooting.html">Kiosk Support</a>
    </div>
  </div>
</footer>
<button class="to-top" type="button" aria-label="Back to top">{up}</button>
<script src="assets/js/site.js" defer></script>
</body>
</html>
""".format(
        site=SITE_NAME, parent=PARENT, social=social,
        platform=col("Platform", [
            ("loyalty-program.html", "Loyalty Program"),
            ("sms-mms.html", "SMS &amp; MMS"),
            ("custom-mobile-web-app.html", "Mobile Web App"),
            ("1-to-1-conversations.html", "1 to 1 Conversations"),
            ("online-reviews.html", "Online Reviews"),
            ("kiosks.html", "Loyalty Kiosk"),
            ("data-analytics.html", "Data Analytics"),
        ]),
        company=col("Company", [
            ("connect-grow.html", "Why Customer Connect"),
            ("customer-success.html", "Customer Success"),
            ("pricing.html", "Pricing"),
            ("blog.html", "Resource Center"),
            ("book-demo.html", "Book a Demo"),
            ("sign-in.html", "Merchant Login"),
        ]),
        ph=icon("phone"), ml=icon("mail"), pin=icon("map-pin"),
        tel=PHONE_TEL, phone=PHONE_DISPLAY, email=EMAIL,
        addr="<br>".join(ADDRESS_LINES), up=icon("arrow-up"))


# --------------------------------------------------------------------------
# Section builders
# --------------------------------------------------------------------------

def section_head(eyebrow, title, lede=None, align="center", reveal=True):
    rv = ' data-reveal' if reveal else ""
    parts = ['<div class="section-head%s"%s>' % ("" if align == "center" else " left", rv)]
    if eyebrow:
        parts.append('<span class="micro">%s</span>' % eyebrow)
    parts.append('<h2 class="t-h2">%s</h2>' % title)
    if lede:
        parts.append('<p class="lede">%s</p>' % lede)
    parts.append("</div>")
    return "".join(parts)


def page_hero(eyebrow, title, lede, primary=None, secondary=None, align="center",
              title_class="t-h1"):
    cta = ""
    if primary or secondary:
        btns = []
        if primary:
            btns.append('<a class="btn btn-primary btn-lg" href="%s">%s %s</a>'
                        % (primary[1], primary[0], icon("arrow-right", cls="ico ico-arrow")))
        if secondary:
            btns.append('<a class="btn btn-ghost btn-lg" href="%s">%s</a>'
                        % (secondary[1], secondary[0]))
        cta = '<div class="page-hero-cta anim-up d4">%s</div>' % "".join(btns)
    return """<section class="page-hero{al}">
  <div class="bg-orbs" aria-hidden="true"><span class="orb orb-a"></span><span class="orb orb-b"></span></div>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="shell">
    <span class="pill anim-up d1"><span class="dot"></span>{eyebrow}</span>
    <h1 class="{tc} anim-up d2" style="margin-top:22px">{title}</h1>
    <p class="lede anim-up d3">{lede}</p>
    {cta}
  </div>
</section>""".format(al="" if align == "center" else " left", eyebrow=eyebrow,
                     tc=title_class, title=title, lede=lede, cta=cta)


def feature_grid(items, cols=3, numbered=False):
    cards = []
    for i, (ic, title, body) in enumerate(items):
        num = ('<span class="feature-num">%02d</span>' % (i + 1)) if numbered else ""
        cards.append("""<article class="card card-hover card-glow feature-card" data-reveal>
  {num}<div class="feature-ico">{ico}</div>
  <h3>{title}</h3><p>{body}</p>
</article>""".format(num=num, ico=icon(ic), title=title, body=body))
    return '<div class="grid g-%d" data-stagger="70">%s</div>' % (cols, "".join(cards))


def pillars(items):
    cards = []
    for ic, title, blurb, bullets in items:
        lis = "".join('<li>%s<span>%s</span></li>' % (icon("check"), b) for b in bullets)
        cards.append("""<article class="card card-hover pillar" data-reveal>
  <div class="pillar-badge">{ico}</div>
  <h3>{title}</h3>
  <p>{blurb}</p>
  <ul class="check-list">{lis}</ul>
</article>""".format(ico=icon(ic), title=title, blurb=blurb, lis=lis))
    return '<div class="grid g-3" data-stagger="90">%s</div>' % "".join(cards)


def steps(items):
    out = []
    for i, (title, body) in enumerate(items, 1):
        out.append("""<div class="step" data-reveal>
  <div class="step-num">{n}</div><h3>{title}</h3><p>{body}</p>
</div>""".format(n=i, title=title, body=body))
    return '<div class="steps grid g-3" data-stagger="110">%s</div>' % "".join(out)


def industries(items):
    cards = "".join(
        '<div class="industry" data-reveal><i>%s</i><b>%s</b></div>' % (icon(ic), name)
        for ic, name in items)
    return '<div class="grid g-4 industries" data-stagger="60">%s</div>' % cards


def testimonials(title="What Our Customers Are Saying",
                 eyebrow="Merchant stories",
                 lede="Real merchants, real results — in their own words."):
    cards = []
    for quote, name, company, initials, rating in TESTIMONIALS:
        stars = '<span class="stars">%s</span>' % (solid_star() * rating)
        cards.append("""<figure class="quote">
  <div class="quote-mark" aria-hidden="true">&ldquo;</div>
  {stars}
  <blockquote>{quote}</blockquote>
  <figcaption class="quote-by">
    <span class="qav">{ini}</span>
    <span><b>{name}</b><span>{company}</span></span>
  </figcaption>
</figure>""".format(stars=stars, quote=quote, ini=initials, name=name, company=company))
    return """<section class="section section-tint">
  <div class="shell">
    {head}
    <div data-carousel data-reveal>
      <div class="quotes">{cards}</div>
      <div class="quotes-nav">
        <button class="qnav" type="button" data-prev aria-label="Previous testimonial">{left}</button>
        <div class="qdots" aria-hidden="true"></div>
        <button class="qnav" type="button" data-next aria-label="Next testimonial">{right}</button>
      </div>
    </div>
  </div>
</section>""".format(head=section_head(eyebrow, title, lede), cards="".join(cards),
                     left=icon("chevron-left"), right=icon("chevron-right"))


def faq_section(items=None, title="Got Questions? We’ve Got Answers.",
                lede="Still have unanswered questions and need to get in touch?"):
    items = items or FAQS
    rows = []
    for i, (q, a) in enumerate(items):
        rows.append("""<div class="faq-item{open}">
  <button class="faq-q" type="button">{q}<span class="faq-ico">{plus}</span></button>
  <div class="faq-a"><div><div class="inner">{a}</div></div></div>
</div>""".format(open=" open" if i == 0 else "", q=q, plus=icon("plus"), a=a))
    return """<section class="section">
  <div class="shell">
    <div class="split tilt">
      <div data-reveal="left">
        <span class="micro">FAQ</span>
        <h2 class="t-h2" style="margin-top:14px">{title}</h2>
        <p class="lede">{lede}</p>
        <div class="contact-cards mt-4">
          <a class="contact-card" href="sms:{tel}"><i>{msg}</i>
            <span><b>Text us</b><span>{phone}</span></span></a>
          <a class="contact-card" href="mailto:{email}"><i>{mail}</i>
            <span><b>Email us</b><span>{email}</span></span></a>
        </div>
      </div>
      <div class="faq" data-reveal="right">{rows}</div>
    </div>
  </div>
</section>""".format(title=title, lede=lede, rows="".join(rows),
                     msg=icon("message"), mail=icon("mail"),
                     tel=PHONE_TEL, phone=PHONE_DISPLAY, email=EMAIL)


def cta_band(kicker="It Starts with a Message", punch="It Ends with Loyalty",
             lede="Book a 20-minute walkthrough with a Growth Specialist and see exactly "
                  "how much revenue your customer list is leaving on the table.",
             note="No contracts to review on the call. No pressure. Just a plan."):
    return """<section class="cta-band">
  <div class="cta-glow" aria-hidden="true"></div>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="shell">
    <h2 class="t-h1" data-reveal>{kicker}<em class="grad-text">{punch}</em></h2>
    <p class="lede" data-reveal style="--d:80ms">{lede}</p>
    <div class="cta-actions" data-reveal style="--d:160ms">
      <a class="btn btn-solid-light btn-lg" href="book-demo.html">Book a Demo {ar}</a>
      <a class="btn btn-on-dark btn-lg" href="connect-grow.html">See It In Action</a>
    </div>
    <p class="cta-note" data-reveal style="--d:240ms">{note}</p>
  </div>
</section>""".format(kicker=kicker, punch=punch, lede=lede, note=note,
                     ar=icon("arrow-right", cls="ico ico-arrow"))


def marquee(label="Trusted across every kind of local business"):
    items = "".join('<span class="marquee-item">%s %s</span>' % (icon(ic), name)
                    for ic, name in MARQUEE_ITEMS)
    return """<section class="section-tight" style="border-block:1px solid var(--line-soft)">
  <p class="micro center" style="margin-bottom:8px">{label}</p>
  <div class="marquee"><div class="marquee-track">{items}{items}</div></div>
</section>""".format(label=label, items=items)


def resources_section(posts, title="Find Helpful Resources",
                      eyebrow="Resource center",
                      lede="Playbooks, benchmarks, and field notes from merchants growing "
                           "revenue with loyalty and text."):
    return """<section class="section section-tint">
  <div class="shell">
    {head}
    {cards}
    <div class="center mt-5" data-reveal>
      <a class="btn btn-ghost" href="blog.html">Browse all resources {ar}</a>
    </div>
  </div>
</section>""".format(head=section_head(eyebrow, title, lede),
                     cards=post_grid(posts, 3), ar=icon("arrow-right", cls="ico ico-arrow"))


def post_grid(posts, cols=3):
    cards = "".join(post_card(p) for p in posts)
    return '<div class="grid g-%d" data-stagger="80">%s</div>' % (cols, cards)


def post_card(post):
    return """<a class="post-card" href="{slug}.html" data-reveal>
  <div class="post-thumb"><span class="post-cat">{cat}</span>{ico}</div>
  <div class="post-body">
    <time datetime="{iso}">{date}</time>
    <h3>{title}</h3>
    <p>{excerpt}</p>
    <span class="link-arrow">Read article {ar}</span>
  </div>
</a>""".format(slug=post["slug"], cat=post["category"], ico=icon(post["icon"]),
               iso=post["iso"], date=post["date"], title=post["title"],
               excerpt=post["excerpt"], ar=icon("arrow-right", cls="ico"))


def stat_band(items, dark=True):
    cards = []
    for value, label, note in items:
        n = '<small>%s</small>' % note if note else ""
        cards.append('<div class="stat%s" data-reveal><b>%s</b><span>%s</span>%s</div>'
                     % ("" if dark else " stat-light", value, label, n))
    return ('<div class="stat-band grid g-%d" data-stagger="90">%s</div>'
            % (len(items), "".join(cards)))


def counter_stat(value, suffix, label, prefix="", decimals=0, note=""):
    n = '<small>%s</small>' % note if note else ""
    return ('<div class="stat" data-reveal><b><span data-count="%s" data-prefix="%s" '
            'data-suffix="%s" data-decimals="%d">%s0</span></b><span>%s</span>%s</div>'
            % (value, prefix, suffix, decimals, prefix, label, n))


def contact_strip():
    cards = [
        ("phone", "Call or text", PHONE_DISPLAY, "tel:%s" % PHONE_TEL),
        ("mail", "Email support", EMAIL, "mailto:%s" % EMAIL),
        ("map-pin", "Headquarters", " · ".join(ADDRESS_LINES), None),
    ]
    out = []
    for ic, label, value, href in cards:
        inner = '<i>%s</i><span><b>%s</b><span>%s</span></span>' % (icon(ic), label, value)
        out.append('<a class="contact-card" href="%s" data-reveal>%s</a>' % (href, inner)
                   if href else
                   '<div class="contact-card" data-reveal>%s</div>' % inner)
    return '<div class="contact-cards grid g-3" data-stagger="70">%s</div>' % "".join(out)
