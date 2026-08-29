"""Structured page content, carried over from the original Customer Connect site.

Copy is preserved from the live site (lightly tidied for punctuation and to replace
the two lorem-ipsum placeholders that shipped on the original pages).
"""

# --------------------------------------------------------------------------
# Blog / resource-centre index
# --------------------------------------------------------------------------

POSTS = [
    dict(slug="why-your-business-needs-a-loyalty-and-engagement-platform",
         title="Why Your Business Needs a Loyalty and Engagement Platform",
         category="Loyalty", icon="gift", date="June 3, 2026", iso="2026-06-03",
         read="6 min read",
         excerpt="In a hyper-competitive market, attracting a new customer is only half the "
                 "battle — and often the more expensive half. The real opportunity is what "
                 "happens after the first purchase."),
    dict(slug="why-customer-retention-is-the-key-to-business-growth",
         title="Why Customer Retention Is the Key to Business Growth",
         category="Customer Retention", icon="repeat", date="May 15, 2026", iso="2026-05-15",
         read="4 min read",
         excerpt="Attracting new customers is essential, but retaining existing ones is far "
                 "more cost-effective and profitable. Loyal customers spend more, visit more, "
                 "and refer more."),
    dict(slug="how-to-get-more-customer-reviews-and-turn-them-into-revenue",
         title="How to Get More Customer Reviews and Turn Them Into Revenue",
         category="Reputation Management", icon="star", date="May 6, 2026", iso="2026-05-06",
         read="6 min read",
         excerpt="Reviews directly impact your Google ranking, your online reputation, and — "
                 "most importantly — how many new customers walk through your door."),
    dict(slug="restaurant-loyalty-kiosks-driving-repeat-business",
         title="Restaurant Loyalty Kiosks: Driving Repeat Business",
         category="Loyalty", icon="kiosk", date="April 22, 2026", iso="2026-04-22",
         read="7 min read",
         excerpt="Getting customers through the door is only half the battle. The real "
                 "challenge is turning one-time visitors into repeat guests."),
    dict(slug="why-11-conversations-are-the-key-to-growing-your-auto-shop",
         title="Why 1:1 Conversations Are the Key to Growing Your Auto Shop",
         category="Customer Engagement", icon="messages-two", date="April 1, 2026",
         iso="2026-04-01", read="8 min read",
         excerpt="Customers expect fast, personal, convenient communication. For auto shops "
                 "that means moving beyond one-size-fits-all marketing."),
    dict(slug="the-real-problem-with-restaurant-growth-one-time-customers",
         title="The Real Problem With Restaurant Growth: One-Time Customers",
         category="Customer Engagement", icon="utensils", date="March 18, 2026",
         iso="2026-03-18", read="8 min read",
         excerpt="More traffic. More ads. More exposure. But there’s a bigger issue that goes "
                 "unnoticed, and it’s where a significant amount of revenue is quietly lost."),
    dict(slug="how-to-measure-sms-campaign-success",
         title="How to Measure SMS Campaign Success",
         category="Text Marketing", icon="bar-chart", date="March 9, 2026", iso="2026-03-09",
         read="5 min read",
         excerpt="Open rates often exceed 90%, but sending messages alone doesn’t guarantee "
                 "results. Here’s what to actually track."),
    dict(slug="web-app-only-vs-kiosk-why-screen-movement-changes-everything",
         title="Web App Only vs. Kiosk: Why Screen Movement Changes Everything",
         category="Loyalty", icon="tablet", date="February 16, 2026", iso="2026-02-16",
         read="6 min read",
         excerpt="QR codes on the counter work. But there’s one major difference between web "
                 "app only and adding a kiosk — and it changes your sign-up rate."),
    dict(slug="reviews-dont-have-to-hurt-make-them-work-for-you",
         title="Reviews Don’t Have to Hurt: Make Them Work for You",
         category="Reputation Management", icon="shield", date="January 26, 2026",
         iso="2026-01-26", read="7 min read",
         excerpt="You open Google reviews Monday morning and a negative review from the "
                 "weekend is staring back at you. Here’s how to turn that around."),
    dict(slug="5-lessons-to-grow-revenue-by-thousands-each-month",
         title="5 Lessons to Grow Revenue by Thousands Each Month",
         category="Business", icon="trending-up", date="January 23, 2026", iso="2026-01-23",
         read="6 min read",
         excerpt="Revenue doesn’t rise by chance. It grows when you build systems that turn "
                 "everyday interactions into consistent sales."),
    dict(slug="how-1-to-1-texting-is-transforming-customer-relationships",
         title="How 1-to-1 Texting Is Transforming Customer Relationships",
         category="Customer Engagement", icon="message-dots", date="January 7, 2026",
         iso="2026-01-07", read="6 min read",
         excerpt="Mass marketing built awareness. One-to-one texting builds relationships — "
                 "and relationships are what bring customers back."),
    dict(slug="what-happens-when-you-dont-follow-up-with-customers",
         title="What Happens When You Don’t Follow Up with Customers",
         category="Customer Engagement", icon="clock", date="January 6, 2026", iso="2026-01-06",
         read="5 min read",
         excerpt="Most lost revenue isn’t lost at the point of sale. It’s lost in the silence "
                 "that follows it."),
    dict(slug="how-to-turn-holiday-shoppers-into-long-term-customers",
         title="How to Turn Holiday Shoppers into Long-term Customers",
         category="Customer Engagement", icon="sparkles", date="December 5, 2025",
         iso="2025-12-05", read="5 min read",
         excerpt="Holiday traffic is a once-a-year gift. What you do in the two weeks after "
                 "decides whether it becomes a year-round customer base."),
    dict(slug="3-tips-to-build-a-large-database-of-customers-to-text",
         title="3 Tips to Build a Large Database of Customers to Text",
         category="Text Marketing", icon="users", date="October 14, 2025", iso="2025-10-14",
         read="5 min read",
         excerpt="Your text list is the only marketing channel you truly own. Here are three "
                 "ways merchants grow theirs the fastest."),
]

CATEGORIES = ["Business", "Customer Engagement", "Customer Retention", "Loyalty",
              "Reputation Management", "Text Marketing"]

TAGS = ["SMS marketing", "Loyalty", "Kiosk", "Reviews", "Retention", "Automation",
        "Restaurants", "Compliance", "Analytics"]


# --------------------------------------------------------------------------
# Solution & product pages
# --------------------------------------------------------------------------
# Each entry drives one page. `nav` is the mega-menu label used for breadcrumbs.

PAGES = {}

PAGES["customer-loyalty"] = dict(
    nav="Solutions", eyebrow="Customer loyalty",
    title="Customer Loyalty",
    meta="Turn first-time buyers into repeat customers with automatic reminders, "
         "personalized rewards, and win-back campaigns that run themselves.",
    h1="Turn First Visits Into Lasting Loyalty",
    lede="Strengthen customer loyalty with automatic reminders on offers, personalized "
         "rewards, and text campaigns that re-engage lost customers effortlessly.",
    features_eyebrow="Features and benefits",
    features_title="All the Loyalty Tools… None of the Complexity",
    features_lede="Everything you need to keep customers coming back, without adding a "
                  "single step to your team’s day.",
    features=[
        ("repeat", "Win Back Dormant Customers",
         "Re-engage customers who haven’t visited or purchased in a while with targeted "
         "messages that bring them back into your business."),
        ("clock", "Schedule Automatic Reminders",
         "Create follow-ups you control, scheduled to send when it makes sense for your business."),
        ("tag", "Capture Prospects With Offers",
         "Turn casual visitors into loyal, repeat customers with timely promotions, personalized "
         "offers, and exclusive incentives that drive action."),
        ("kiosk", "Kiosk &amp; Mobile Web App",
         "Let customers check in, earn points, and redeem rewards effortlessly from your kiosk "
         "or mobile web app — keeping loyalty seamless and engagement high."),
        ("gift", "Deliver Personalized Rewards",
         "Recognize and reward customers with custom incentives that make them feel valued and "
         "keep them coming back again and again."),
        ("filter", "Targeted Customer Segmentation",
         "Reach the right customers with the right message at exactly the right time, so every "
         "interaction is relevant and drives engagement."),
    ],
    pillars_eyebrow="Every touchpoint, working together",
    pillars_title="Every Touchpoint, Working Together",
    pillars_lede="Convert more prospects, retain more customers, and boost engagement from one "
                 "connected loyalty engine.",
    pillars=[
        ("user-plus", "Convert More Prospects",
         "Turn interest into revenue by offering rewards when someone opts in.",
         ["QR codes, keywords, or web forms deliver instant offers via text",
          "Every sign-up lands in a list you own",
          "Offers are trackable from send to redemption"]),
        ("repeat", "Retain More Customers",
         "Reward loyalty with personalized offers that keep them coming back.",
         ["Automated reminders and redeemable offer texts",
          "“We Miss You” campaigns that run without you",
          "No hours spent building each send"]),
        ("kiosk", "Boost Engagement",
         "Encourage frequent interactions through kiosks and your mobile web app.",
         ["Self-serve check-ins at the point of sale",
          "Reward progress visible on every visit",
          "Redemptions confirmed instantly by text"]),
    ],
    showcase=[
        ("Loyalty that compounds every single visit",
         "Points, visits, and rewards are tracked digitally — no punch cards, no extra apps, "
         "nothing for your staff to remember. Customers see how close they are to their next "
         "reward, and the platform nudges them back when they drift.",
         "chart"),
    ],
    resources=True, testimonials=True, faq=True,
)

PAGES["customer-retention"] = dict(
    nav="Solutions", eyebrow="Customer retention",
    title="Customer Retention",
    meta="Keep customers returning with timely follow-ups, personalized offers, and smart "
         "text campaigns that bring them back without lifting a finger.",
    h1="Retention That Feels One-to-One",
    lede="Boost customer retention with automated follow-ups, personalized offers, and smart "
         "text campaigns that bring customers back without lifting a finger.",
    features_eyebrow="Features and benefits",
    features_title="Retention That Feels One-to-One",
    features_lede="Five ways the platform quietly keeps your business top of mind.",
    features=[
        ("repeat", "Win Back Customers",
         "Timely reminders and personalized follow-ups keep your business top of mind."),
        ("zap", "Drive Traffic Fast",
         "Instant offers bring in customers exactly when you need them most."),
        ("gift", "Reward Repeat Visits",
         "Perks and exclusive incentives keep customers coming back and build real loyalty."),
        ("heart", "Make Every Message Personal",
         "Personalized messages make customers feel valued — not marketed to."),
        ("activity", "See Retention in Action",
         "Real-time insights connect return visits to revenue."),
    ],
    pillars_eyebrow="Turn visits into repeat business",
    pillars_title="Turn Visits Into Repeat Business",
    pillars_lede="Three systems working together so returning customers become the default, "
                 "not the exception.",
    pillars=[
        ("send", "Re-Engage With Ease",
         "When customers start to drift, bring them back with the right message at the right time.",
         ["Personalized follow-ups keep you top of mind",
          "Triggered by time since last visit",
          "Strengthens loyalty without extra effort"]),
        ("gift", "Build Loyalty Without Lifting a Finger",
         "Customers earn and redeem rewards each visit.",
         ["Simple, seamless, completely hands-off for you",
          "Progress tracked automatically on every check-in",
          "Rewards redeemable straight from their phone"]),
        ("bar-chart", "Track Retention, Not Just Sales",
         "See exactly how many customers return, how often, and the revenue impact.",
         ["Return rate and visit frequency in one view",
          "Revenue impact per campaign",
          "No spreadsheets — just clear results"]),
    ],
    resources=True, testimonials=True, faq=True,
)

PAGES["text-marketing"] = dict(
    nav="Solutions", eyebrow="Text marketing",
    title="Text Marketing",
    meta="Reach your audience where they're most active. Targeted text campaigns, "
         "personalized messages, and automated follow-ups that keep customers coming back.",
    h1="Turn Customer Moments Into Revenue Moves",
    lede="Drive engagement with targeted text campaigns, personalized messages, and automated "
         "follow-ups that keep your customers connected and coming back.",
    features_eyebrow="Features and benefits",
    features_title="Turn Customer Moments Into Revenue Moves",
    features_lede="Reach your audience directly where they’re most active — on their phones.",
    features=[
        ("repeat", "Re-engage Lost Customers",
         "Automatically send timely, personalized texts based on how long it’s been since a "
         "customer’s last visit."),
        ("bar-chart", "Know What’s Working",
         "Track every campaign in one place — from opens and clicks to redemptions and revenue."),
        ("headset", "Enhance Customer Service",
         "Provide fast, convenient support over SMS: answer questions, send updates, and resolve "
         "issues quickly."),
        ("eye", "Spot Opportunities Instantly",
         "Monitor campaigns as they happen and get instant visibility into what’s working and "
         "what’s not."),
        ("target", "Smarter Targeting",
         "Reach customers with messages tailored to their behavior or location, so every campaign "
         "is highly relevant."),
    ],
    pillars_eyebrow="Every message, measurable impact",
    pillars_title="Every Message, Measurable Impact",
    pillars_lede="Launch, measure, and improve — a loop that gets sharper every campaign.",
    pillars=[
        ("clock", "Launch Campaigns That Work While You Work",
         "Schedule texts to go out after visits, sign-ups, or missed visits.",
         ["Promos, thank-yous, and reminders on autopilot",
          "Trigger-based sends need no manual work",
          "Focus on the floor, not the phone"]),
        ("dollar", "See What’s Driving Revenue",
         "Track clicks, responses, and redemptions by location or campaign.",
         ["Spot trends instantly across locations",
          "No spreadsheets, no guesswork",
          "Clear insight into what actually converts"]),
        ("repeat", "Optimize and Repeat",
         "Use built-in reports to double down on top performers and fix what isn’t converting.",
         ["Test new redeemable offers",
          "Segment by customer behavior",
          "Build smarter campaigns every time"]),
    ],
    resources=True, testimonials=True, faq=True,
)

PAGES["reputation-management"] = dict(
    nav="Solutions", eyebrow="Reputation management",
    title="Reputation Management",
    meta="Build trust and grow your business with automated review requests, instant feedback "
         "alerts, and smart follow-ups that turn happy customers into 5-star reviews.",
    h1="Feedback That Fuels Growth",
    lede="Boost your reputation with automated review requests, instant feedback tools, and "
         "smart follow-ups that turn happy customers into positive online reviews.",
    features_eyebrow="Features and benefits",
    features_title="Feedback That Fuels Growth",
    features_lede="You can’t afford to ignore what customers say online. Manage reviews before "
                  "they manage you.",
    features=[
        ("send", "Request Reviews Automatically",
         "Ask for a review after each visit or check-in, so happy customers actually share "
         "their experience."),
        ("bell", "Get Instant Alerts",
         "See the moment each new review comes in — no more wondering what’s out there."),
        ("eye", "Stay Ahead of Your Reputation",
         "Track ratings across Google, Yelp, and more from one dashboard."),
        ("star", "Turn 5-Star Feedback Into Fuel",
         "More great reviews build trust and attract new business."),
        ("gift", "Reward the Customers Who Speak Up",
         "Recognize reviewers with custom incentives that make them feel valued and keep them "
         "coming back."),
    ],
    pillars_eyebrow="Ignite fuel and power growth",
    pillars_title="Ignite Fuel &amp; Power Growth",
    pillars_lede="Capture, track, and act — the three moves that compound into a reputation "
                 "competitors can’t buy.",
    pillars=[
        ("star", "Capture Every Review",
         "Turn customer moments into reviews that build your reputation.",
         ["Make it easy for customers to share experiences",
          "Requests triggered by visits and check-ins",
          "Your team stays informed as reviews land"]),
        ("activity", "Track Performance in Real Time",
         "See which team members drive the most reviews and monitor response rates.",
         ["Spot trends by location or campaign",
          "Response-rate visibility in one place",
          "No spreadsheets required"]),
        ("target", "Take Action Where It Counts",
         "Get alerts for customer feedback and respond before it affects your reputation.",
         ["Respond quickly to protect trust",
          "Use data to coach your team",
          "Improve service and build trust at scale"]),
    ],
    resources=True, testimonials=True, faq=True,
)

PAGES["employee-engagement-employee-engagement-and-performance-tracking"] = dict(
    nav="Solutions", eyebrow="Employee engagement",
    title="Employee Engagement",
    meta="See your team in action. Automatic check-ins, personalized recognition, and "
         "performance tracking that keeps employees motivated and connected.",
    h1="Insights That Move Your Team Forward",
    lede="Boost team engagement with automatic check-ins, personalized recognition, and "
         "messages that keep employees motivated and connected effortlessly.",
    features_eyebrow="Features and benefits",
    features_title="Insights That Move Your Team Forward",
    features_lede="Know who’s contributing, who needs support, and what’s driving results — "
                  "without guesswork.",
    features=[
        ("user-check", "Know Who’s Performing",
         "See who’s contributing and who needs support, without guesswork."),
        ("activity", "Track Results Instantly",
         "Get complete visibility with instant performance tracking across every location, "
         "role, or shift."),
        ("award", "Celebrate Top Performers",
         "Recognize achievements the moment they happen by tracking performance in real time."),
        ("filter", "Prevent Bottlenecks",
         "Stay ahead of potential problems with real-time visibility into your operations."),
        ("trending-up", "Motivate Through Impact",
         "Empower your team by showing them exactly how their work contributes to overall success."),
    ],
    pillars_eyebrow="Turn data into action",
    pillars_title="Turn Data Into Action",
    pillars_lede="Everything your team does with customers, visible in one place.",
    pillars=[
        ("inbox", "Track Every Interaction",
         "View customer conversations and campaign responses in one place for better visibility.",
         ["One thread per customer, shared across the team",
          "Notes and assignments keep everyone aligned",
          "Nothing falls through the cracks"]),
        ("bar-chart", "Spot What’s Driving Results",
         "See what messaging and campaigns are working best.",
         ["Compare performance by person or location",
          "Double down on what drives results",
          "Real-time, not end-of-month"]),
        ("gauge", "Work Smarter, Not Harder",
         "Review message and campaign performance to make better decisions over time.",
         ["Trends surface automatically",
          "Coach with evidence, not hunches",
          "Improvements compound each month"]),
    ],
    resources=True, testimonials=True, faq=True,
)

PAGES["recruiting-simplified"] = dict(
    nav="Solutions", eyebrow="Recruiting",
    title="Recruiting Simplified",
    meta="Attract, track, and retain top talent without the manual follow-ups. Automated "
         "candidate messaging, interview reminders, and pipeline visibility.",
    h1="Recruitment That Feels Personal",
    lede="Streamline recruiting with automated follow-ups, personalized messages, and "
         "campaigns that effortlessly keep candidates engaged.",
    features_eyebrow="Features and benefits",
    features_title="Recruitment That Feels Personal",
    features_lede="Keep every candidate warm — even when your day gets away from you.",
    features=[
        ("repeat", "Reconnect Candidates",
         "Automatically reconnect with candidates who haven’t responded, keeping them in the loop."),
        ("zap", "Speed Up Hiring",
         "Keep hiring moving by sending candidates timely updates and reminders at every stage."),
        ("sparkles", "Boost Engagement",
         "Incentivize engagement with perks, interview invitations, or exclusive opportunities."),
        ("heart", "Personalize Every Message",
         "Make every applicant feel recognized by tailoring messages to their experience and "
         "background."),
        ("list-checks", "Track Your Hiring",
         "Keep a close eye on every stage with real-time visibility into your pipeline and who’s "
         "progressing."),
    ],
    pillars_eyebrow="Turn applicants into hires",
    pillars_title="Turn Applicants Into Hires",
    pillars_lede="A hiring process that stays consistent no matter how busy the week gets.",
    pillars=[
        ("send", "Engage Candidates Automatically",
         "Reach out at the right moment — after application, after interview, or after inactivity.",
         ["Triggered outreach keeps talent interested",
          "No candidate goes dark by accident",
          "Text response rates beat email by a wide margin"]),
        ("clock", "Keep Talent Moving Forward",
         "Automated follow-ups, reminders, and updates make hiring smooth and consistent.",
         ["Interview reminders reduce no-shows",
          "Every candidate gets the same experience",
          "Onboarding workflows start on day one"]),
        ("inbox", "Stay Connected, Stay in Control",
         "Manage every conversation with ease and take action at the right time.",
         ["All replies in one shared inbox",
          "Assign conversations to a teammate",
          "Full history for every applicant"]),
    ],
    resources=True, testimonials=True, faq=True,
)

PAGES["data-tracking-real-time-data-tracking-and-insights"] = dict(
    nav="Solutions", eyebrow="Data tracking",
    title="Data Tracking",
    meta="Real-time data tracking, campaign insights, and customer analytics that help you "
         "make smarter decisions — with zero spreadsheets.",
    h1="Real-Time Insights. Zero Spreadsheets.",
    lede="Improve performance with real-time data tracking, campaign insights, and customer "
         "analytics that help you make smarter decisions effortlessly.",
    features_eyebrow="Features and benefits",
    features_title="Real Time Insights. Zero Spreadsheets.",
    features_lede="It starts with insights. It ends with results.",
    features=[
        ("users", "See Who’s Engaging",
         "Track exactly which customers interact with your campaigns and which ones don’t, so "
         "you can focus on what matters."),
        ("bar-chart", "Track Every Result",
         "Monitor campaign performance across locations, teams, or individual initiatives from "
         "one easy dashboard."),
        ("target", "Double Down on What Works",
         "Identify your top-performing offers and most effective keywords so you can focus your "
         "effort where it pays."),
        ("bell", "Stay Top of Mind",
         "Keep your business front of mind with timely, relevant messages that boost engagement "
         "and loyalty."),
    ],
    features_cols=4,
    pillars_eyebrow="Measure everything that matters",
    pillars_title="Measure Everything That Matters",
    pillars_lede="Three steps from raw activity to a decision you can act on today.",
    pillars=[
        ("activity", "Track Every Interaction",
         "From opt-ins to redemptions, see exactly how customers engage.",
         ["Redeemable offers and keyword performance",
          "Team activity in one place",
          "Every check-in timestamped"]),
        ("eye", "Spot What’s Working",
         "Quickly identify your top campaigns and team members.",
         ["Real-time consumer behavior insight",
          "Redemption rates by campaign",
          "Double down on what drives revenue"]),
        ("target", "Make Smarter Decisions",
         "Use data to guide your next move.",
         ["Send a new offer with confidence",
          "Follow up with the right team member",
          "Re-engage the right customers first"]),
    ],
    resources=True, testimonials=True, faq=True,
)

PAGES["loyalty-program"] = dict(
    nav="Products", eyebrow="Loyalty program",
    title="Loyalty Program",
    meta="Custom loyalty and tailored campaigns that keep customers coming back. Automated "
         "campaigns, win-back messages, and a loyalty dashboard built for local business.",
    h1="Build Loyalty That Lasts, Customize Every Experience",
    lede="Go beyond basic messaging — create personalized loyalty and tailored campaigns that "
         "keep customers coming back.",
    features_eyebrow="Features and benefits",
    features_title="What You Get With Loyalty",
    features_lede="Turn every visit into a reason to return.",
    features=[
        ("repeat", "Automated Loyalty Campaigns", "Reward repeat visits without extra effort."),
        ("send", "Win-Back Messages", "Re-engage customers who haven’t visited in a while."),
        ("gift", "Custom Offers &amp; Incentives", "Create offers unique to your business."),
        ("target", "Targeted Promotions", "Send timely discounts and perks that drive action."),
        ("bar-chart", "Loyalty Tracking Dashboard", "See which customers are most engaged."),
        ("heart", "Personalized Messaging", "Deliver texts that feel 1-to-1, not mass produced."),
    ],
    pillars_eyebrow="What you get with loyalty",
    pillars_title="Turn Every Visit Into a Reason to Return",
    pillars_lede="Three outcomes merchants see within the first ninety days.",
    pillars=[
        ("repeat", "Keep Customers Coming Back",
         "Reward loyal shoppers with exclusive offers and perks.",
         ["Automatic follow-ups after visits or purchases",
          "Celebrate birthdays and anniversaries with special texts",
          "Turn one-time buyers into repeat customers"]),
        ("dollar", "Increase Customer Spend",
         "Encourage higher ticket sales through incentives.",
         ["Offer discounts for repeat visits",
          "Targeted promotions that drive upsells",
          "Motivate customers to choose you over competitors"]),
        ("list-checks", "Simplify Loyalty Management",
         "Make loyalty effortless for both you and your customers.",
         ["Track redemption offers inside your texting platform",
          "No punch cards or extra apps required",
          "Customers redeem offers directly from their phone"]),
    ],
    steps_eyebrow="Setup",
    steps_title="Set Up a Loyalty Kiosk in Minutes",
    steps_lede="Make it easy for customers to join and redeem offers right at your business.",
    steps=[
        ("Place Kiosk Tablet on Site", "Place your kiosk near the checkout counter or entrance."),
        ("Customers Sign Up", "Customers enter their phone number to join."),
        ("Redeem Via Text", "Check-ins are tracked digitally and customers receive offers "
                            "directly to their phone."),
    ],
    industries_eyebrow="Industries",
    industries_title="Industries That Benefit From Loyalty",
    industries_lede="Loyalty programs work for almost any business, but they shine where repeat "
                    "visits drive revenue.",
    industries=[
        ("utensils", "Restaurants"), ("scissors", "Spas &amp; Salons"),
        ("dumbbell", "Fitness Centers"), ("truck", "Food Trucks"),
        ("paw", "Pet Services"), ("flag", "Golf Courses"),
        ("ticket", "Entertainment Venues"), ("wrench", "Auto Shops"),
    ],
    testimonials=True, testimonials_title="Customer Stories: Loyalty That Works",
    faq=True,
)

PAGES["sms-mms"] = dict(
    nav="Products", eyebrow="SMS &amp; MMS",
    title="SMS &amp; MMS",
    meta="A powerhouse for driving quick actions like visits or purchases. 98% open rates, "
         "instant delivery, trackable results, and true two-way conversations.",
    h1="Turn Every Text Into an Opportunity",
    lede="More than marketing. More than loyalty. We help you stay connected with customers, "
         "employees, and prospects at every stage.",
    features_eyebrow="Features and benefits",
    features_title="What You Get With SMS/MMS",
    features_lede="Simple, fast, and effective messaging for your business.",
    features=[
        ("eye", "98% Open Rates",
         "Get your message in front of nearly every customer, every time."),
        ("heart", "Personalized Messaging",
         "Make every text feel like it’s written just for them."),
        ("zap", "Instant Delivery &amp; Responses",
         "Send time-sensitive offers and reminders your customers can act on right away."),
        ("bar-chart", "Trackable Results",
         "Measure opens, clicks, and redemptions to prove ROI with every campaign."),
        ("messages-two", "Two-Way Conversations",
         "Build stronger relationships by letting customers reply directly."),
        ("image", "More Than Just Words",
         "Showcase products, share promotions, and stand out with visual messages."),
    ],
    pillars_eyebrow="What you get with SMS/MMS",
    pillars_title="Simple, Fast, and Effective Messaging",
    pillars_lede="Three jobs your text number does from day one.",
    pillars=[
        ("gift", "Boost Customer Loyalty",
         "Turn one-time buyers into repeat customers.",
         ["Reward frequent customers with exclusive offers via text",
          "Send loyalty reminders, promotions, or birthday messages",
          "Stay top-of-mind without cluttering inboxes"]),
        ("repeat", "Recover Lost Revenue",
         "Bring back customers who went quiet.",
         ["Send “We Miss You” messages to inactive customers",
          "Offer time-sensitive deals to reignite engagement",
          "Track redemptions to see which messages drive results"]),
        ("headset", "Simplify Customer Support",
         "Make it easier for customers to reach you.",
         ["Answer questions through two-way texting",
          "Reduce wait times compared to phone or email",
          "Share updates, confirmations, or instructions instantly"]),
    ],
    steps_eyebrow="Getting started",
    steps_title="From Sign-Up to Send: Easy SMS/MMS Setup",
    steps_lede="Follow a few simple steps to start texting your customers, drive engagement, "
               "and generate revenue.",
    steps=[
        ("Get Dedicated Text Number",
         "We automatically assign and register a dedicated text number exclusively for your "
         "business."),
        ("Add Contacts",
         "Start adding contacts to text using the upload tool and other growth tools."),
        ("Start Engaging",
         "Start increasing revenue and better engaging leads, customers, staff, and recruits."),
    ],
    stats_eyebrow="Results",
    stats_title="Big or Small, Results That Stand Out",
    stats_lede="Drive business growth with Customer Connect, proven through our customers’ "
               "achievements.",
    stats=[("211+", "Redemptions", "Average monthly redemptions for an active single-location merchant."),
           ("$2,000", "Added Revenue", "Typical monthly revenue lift attributed to trackable text offers."),
           ("98%", "Open Rate", "SMS is opened at rates more than double email marketing.")],
    testimonials=True, faq=True,
)

PAGES["custom-mobile-web-app"] = dict(
    nav="Products", eyebrow="Mobile web app",
    title="Custom Mobile Web App",
    meta="Your brand. Your customers. All in one mobile hub. A no-download experience that "
         "lets customers sign up, check in, and engage instantly.",
    h1="Engage Every Customer, Right From Their Phone",
    lede="A no-download, all-in-one mobile experience that lets customers sign up, check in, "
         "and engage with your business instantly.",
    features_eyebrow="Features and benefits",
    features_title="Mobile Web App Features and Benefits",
    features_lede="Everything your customers need, one QR scan away.",
    features=[
        ("qr", "No App Download Needed",
         "Customers scan a QR code and instantly access your custom web app."),
        ("user-plus", "Frictionless Sign-Ups",
         "Capture phone numbers, opt-ins, visits, check-ins, and redemptions directly from the app."),
        ("map-pin", "Digital Loyalty Program",
         "Built with geo-targeting, so customers can only check in or redeem rewards at your "
         "location."),
        ("bell", "Text Alerts",
         "Send timely, personalized messages and offers that spark engagement and drive real action."),
        ("link", "Seamless Integrations",
         "Connect customers to your menu, website, or social media in one tap."),
        ("activity", "Track &amp; Improve Performance",
         "Access real-time data to see what’s working and optimize results."),
    ],
    pillars_eyebrow="What you get",
    pillars_title="Everything You Need to Keep Customers Engaged",
    pillars_lede="Built to remove every step between a customer and their next visit.",
    pillars=[
        ("qr", "Easy Sign-Up &amp; Check-In",
         "Make joining effortless for every customer.",
         ["Custom QR codes placed throughout your business",
          "Instant access via phone number — no app download",
          "Simple setup for staff and customers alike",
          "Customers skip the counter and interact from anywhere in the building"]),
        ("zap", "Automated Engagement",
         "Stay connected without lifting a finger.",
         ["Trigger-based text campaigns for timely follow-ups",
          "Personalized offers that keep your brand top of mind",
          "Built-in loyalty and rewards to increase repeat visits"]),
        ("bar-chart", "Measurable Results",
         "See what’s working and turn insights into action.",
         ["Track customer sign-ups, redemptions, and engagement",
          "View performance data in real time",
          "Make data-driven decisions that drive growth"]),
    ],
    faq=True, testimonials=True,
)

PAGES["1-to-1-conversations"] = dict(
    nav="Products", eyebrow="1 to 1 conversations",
    title="1 to 1 Conversations",
    meta="Connect directly with each customer in a personal manner. Two-way messaging, shared "
         "inbox, templates, and full conversation history.",
    h1="Connect Personally, Every Time",
    lede="Build stronger relationships by sending thoughtful, 1-to-1 messages that feel "
         "personal, timely, and relevant — without slowing down your business.",
    features_eyebrow="Features and benefits",
    features_title="What You Get With 1-to-1 Conversations",
    features_lede="Personal connections that drive customer loyalty.",
    features=[
        ("messages-two", "Two-Way Messaging",
         "Engage customers directly in a personal, meaningful way."),
        ("clipboard", "Message Templates",
         "Save time while keeping messages authentic."),
        ("bell", "Automated Alerts",
         "Never miss a reply or important conversation."),
        ("user-check", "Assign Conversations",
         "Assign to yourself or a teammate before replying — or let the system auto-assign once "
         "you respond."),
        ("filter", "Segmentation &amp; Targeting",
         "Send messages to the right people, exactly when they’re most likely to respond."),
        ("inbox", "Conversation History",
         "Keep a record of every interaction for context. Add notes, tag teammates, and stay "
         "aligned."),
    ],
    pillars_eyebrow="What you get",
    pillars_title="Personal Connections That Drive Customer Loyalty",
    pillars_lede="One-to-one at the scale of your whole customer list.",
    pillars=[
        ("heart", "Build Personal Connections",
         "Connect directly with each customer in a way that feels personal.",
         ["Send messages tailored to individual needs or preferences",
          "Answer questions quickly and personally",
          "Make every customer feel seen and valued"]),
        ("zap", "Drive Engagement &amp; Action",
         "Encourage customers to respond, redeem offers, or take the next step.",
         ["Follow up on offers, appointments, or inquiries",
          "Keep conversations moving without losing track",
          "Turn casual interest into sales or bookings"]),
        ("inbox", "Simplify Communication Management",
         "Keep all customer conversations organized in one place.",
         ["Track messages and replies easily",
          "Avoid missed opportunities with clear threads",
          "Manage multiple conversations without confusion",
          "Use contact notes so your team stays aligned"]),
    ],
    steps_eyebrow="Setup",
    steps_title="Set Up a Loyalty Kiosk in Minutes",
    steps_lede="Make it easy for customers to join and redeem offers right at your business.",
    steps=[
        ("Place Kiosk Tablet on Site", "Place your kiosk near the checkout counter or entrance."),
        ("Customers Sign Up", "Customers enter their phone number to join."),
        ("Redeem Via Text", "Check-ins are tracked digitally and customers receive offers "
                            "directly to their phone."),
    ],
    testimonials=True, faq=True,
)

PAGES["online-reviews"] = dict(
    nav="Products", eyebrow="Online reviews",
    title="Online Reviews",
    meta="Collect, manage, and showcase reviews automatically. Turn every customer experience "
         "into a powerful marketing tool.",
    h1="Collect, Manage, and Showcase Your Reviews",
    lede="Turn every customer experience into a powerful marketing tool.",
    features_eyebrow="Features and benefits",
    features_title="Online Reviews Features and Benefits",
    features_lede="Everything you need to build a reputation that sells for you.",
    features=[
        ("send", "Automated Review Requests",
         "Automated campaigns send texts asking customers to leave a review."),
        ("shield", "Reputation Builder",
         "Build your reputation by quickly addressing negative reviews and proudly displaying "
         "the positive ones."),
        ("sparkles", "Positive Reviews Amplified",
         "Share glowing reviews on your website or social media."),
        ("message", "Respond Quickly",
         "Reply to reviews directly to boost trust and credibility."),
        ("eye", "Monitor Feedback",
         "Identify trends to improve your business operations."),
        ("trending-up", "Boost Online Presence",
         "Increase visibility and attract more customers."),
    ],
    pillars_eyebrow="What you get with online reviews",
    pillars_title="Turn Every Review Into Growth",
    pillars_lede="Collection, response, and improvement — handled in one loop.",
    pillars=[
        ("send", "Effortless Review Collection",
         "Get more reviews without extra work.",
         ["Automated requests sent via text",
          "Easy for customers to respond",
          "Capture feedback from every interaction"]),
        ("message", "Manage &amp; Respond",
         "Stay on top of your reputation.",
         ["Address negative reviews quickly",
          "Respond fast to build trust",
          "Highlight positive experiences publicly"]),
        ("bar-chart", "Insights &amp; Improvement",
         "Use feedback to grow your business.",
         ["Monitor trends and identify areas to improve",
          "Understand what drives customer satisfaction",
          "Make informed business decisions"]),
    ],
    testimonials=True, faq=True,
)

PAGES["kiosks"] = dict(
    nav="Products", eyebrow="Loyalty kiosk",
    title="Loyalty Kiosk",
    meta="Cellular-enabled, self-serve kiosks for in-store sign-ups and loyalty check-ins — "
         "typically 1,500+ new customer sign-ups per year per location.",
    h1="In-Store Sign-Up &amp; Loyalty Kiosk",
    lede="Merchants using our cellular-enabled, self-serve kiosks for in-store sign-ups and "
         "loyalty check-ins typically see upwards of 1,500 new customer sign-ups per year, per "
         "location.",
    features_eyebrow="Features and benefits",
    features_title="Loyalty Kiosk Features and Benefits",
    features_lede="Placed at the point of sale or hostess station, in a tamper-proof case, "
                  "running on cellular data. The only requirement is to plug it in.",
    features=[
        ("user-plus", "Turn Walk-In Traffic Into Repeat Customers",
         "Every customer who walks through your door is an opportunity."),
        ("users", "Grow Your Text List Automatically",
         "Customers sign themselves up in seconds."),
        ("gift", "Increase Loyalty Without Extra Effort",
         "Customers earn points or visits just by stopping by, making it easier to keep them "
         "coming back more often."),
        ("repeat", "Drive More Return Visits",
         "Once someone joins through the kiosk, you can automatically send offers, reminders, "
         "and “We Miss You” messages that bring them back when business is slow."),
        ("link", "Works With Your Existing Texting Tools",
         "The kiosk integrates seamlessly with text campaigns, automations, one-to-one messaging, "
         "and loyalty."),
        ("clock", "Save Staff Time",
         "Staff stays focused on serving customers — not collecting phone numbers, explaining "
         "sign-ups, or tracking punch cards."),
    ],
    pillars_eyebrow="What you get with kiosks",
    pillars_title="Turn Every Visit Into a Reason to Return",
    pillars_lede="How the kiosk works, from placement to redemption.",
    pillars=[
        ("kiosk", "What Is a Kiosk?",
         "A communications hub between you and your customer.",
         ["Animated sign-up offer encourages more sign-ups",
          "Shows the reward and visits needed to earn it",
          "Customizable with your colors, images, and logo",
          "Optional career-board link right on the home screen"]),
        ("list-checks", "How Does It Work?",
         "Four steps, all handled by the customer’s own phone.",
         ["Customer signs into the program at the kiosk",
          "They reply “Yes” to the auto-response text and get the sign-up offer",
          "They check in with their mobile number on each visit",
          "At the check-in goal, the reward unlocks for the next visit"]),
        ("wifi", "Built for the Real World",
         "No finicky Wi-Fi, no tampering, no IT project.",
         ["Runs on cellular data — plug it in and go",
          "Tamper-proof case for high-traffic counters",
          "Redemptions send a time-stamped claim text instantly"]),
    ],
    steps_eyebrow="Setup",
    steps_title="Set Up a Loyalty Kiosk in Minutes",
    steps_lede="Make it easy for customers to join and redeem offers right at your business.",
    steps=[
        ("Place Kiosk Tablet on Site", "Place your kiosk near the checkout counter or entrance."),
        ("Customers Sign Up", "Customers enter their phone number to join."),
        ("Redeem Via Text", "Check-ins are tracked digitally and customers receive offers "
                            "directly to their phone."),
    ],
    testimonials=True, testimonials_title="Customer Stories: Loyalty That Works",
    faq=True,
)

PAGES["growth-conversion-turn-customer-interactions-into-revenue"] = dict(
    nav="Products", eyebrow="Growth conversion",
    title="Growth Conversion",
    meta="Turn every text, click, and visit into measurable revenue with automated campaigns, "
         "loyalty rewards, and real-time conversion analytics.",
    h1="Turn Every Interaction Into Revenue",
    lede="Convert more customers with automated texts, loyalty rewards, and real-time data "
         "that work together to grow your business.",
    features_eyebrow="Features and benefits",
    features_title="What You Get With Growth Conversion",
    features_lede="Everything you need to turn engagement into results.",
    features=[
        ("send", "Automated Campaigns", "Send timely texts that drive sales and repeat visits."),
        ("bar-chart", "Data-Driven Decisions", "Use performance tracking to identify what’s working."),
        ("target", "Targeted Offers", "Reach the right customers with the right message every time."),
        ("gift", "Loyalty Integration", "Reward repeat visits to boost retention and lifetime value."),
        ("pie-chart", "Conversion Analytics", "See redemptions, engagement, and ROI in your dashboard."),
        ("zap", "Hands-Free Growth", "Automations do the work, so you can focus on your business."),
    ],
    pillars_eyebrow="What you get",
    pillars_title="Everything You Need to Turn Engagement Into Results",
    pillars_lede="Set it once, then watch the compounding start.",
    pillars=[
        ("send", "Automated Campaigns That Convert",
         "Send the right message at the right time.",
         ["Trigger-based texts for timely offers",
          "Segmented audiences for maximum impact",
          "Set it once — watch results roll in"]),
        ("activity", "Real-Time Tracking &amp; Insights",
         "See results as they happen.",
         ["Monitor conversions and revenue",
          "Spot trends to refine your strategy",
          "Make data-driven decisions instantly"]),
        ("gift", "Loyalty &amp; Retention Tools",
         "Keep customers coming back again and again.",
         ["Encourage repeat visits with rewards",
          "Keep customers returning automatically",
          "Build long-term relationships that grow profits"]),
    ],
    faq=True, testimonials=True,
)

PAGES["customer-success"] = dict(
    nav="Products", eyebrow="Customer success",
    title="Customer Success",
    meta="Your success is our priority. Personalized onboarding, campaign strategy, and a "
         "dedicated team guiding every step of your texting and engagement journey.",
    h1="Your Success Is Our Priority",
    lede="We help businesses grow by guiding every step of their texting and engagement journey.",
    features_eyebrow="Features and benefits",
    features_title="Customer Success Features and Benefits",
    features_lede="Real people who know what works for merchants like you.",
    features=[
        ("list-checks", "Onboarding Guidance",
         "Personalized setup so your program launches smoothly."),
        ("target", "Strategy Support",
         "Recommendations to grow your contacts list and drive results."),
        ("send", "Campaign Assistance",
         "Help creating text campaigns, loyalty programs, and automation."),
        ("bar-chart", "Performance Insights",
         "Track results and get actionable tips to improve engagement."),
        ("book", "Ongoing Training",
         "Access tutorials, webinars, and best practices."),
        ("headset", "Dedicated Support Team",
         "Quick answers when you need them most."),
    ],
    pillars_eyebrow="What you get with customer success",
    pillars_title="Everything You Need to Maximize Your Results",
    pillars_lede="Support that doesn’t stop after the first campaign goes out.",
    pillars=[
        ("user-check", "Personalized Onboarding",
         "Make joining effortless for every customer.",
         ["Step-by-step setup guidance",
          "Tailored program configuration",
          "Quick adoption for your team"]),
        ("handshake", "Expert Support &amp; Strategy",
         "Guidance to grow your business smarter.",
         ["Campaign advice and best practices",
          "Pro tips to grow your subscriber list",
          "Recommendations for loyalty and engagement"]),
        ("trending-up", "Insights That Drive Growth",
         "Turn data into action and results.",
         ["Track and analyze results in real time",
          "Optimize campaigns with data-driven insights",
          "Achieve measurable ROI and long-term success"]),
    ],
    testimonials=True, faq=True,
)

PAGES["compliance"] = dict(
    nav="Products", eyebrow="Compliance",
    title="Compliance",
    meta="Stay compliant and text with confidence. TCPA and CTIA safeguards, automatic opt-in "
         "management, instant STOP handling, and transparent record keeping.",
    h1="Stay Compliant. Text With Confidence.",
    lede="Protect your business and your customers with built-in texting compliance tools.",
    features_eyebrow="Features and benefits",
    features_title="What You Get With Customer Connect Compliance",
    features_lede="Everything you need to protect your business and build trust.",
    features=[
        ("user-check", "Automatic Opt-In Management",
         "Collect and store verified customer consent automatically."),
        ("shield", "TCPA &amp; CTIA Compliant Messaging",
         "Every text follows federal and carrier regulations."),
        ("messages-two", "Two-Way Opt-Out Controls",
         "Customers can easily unsubscribe with a single word."),
        ("file-check", "Transparent Record Keeping",
         "Access detailed logs of every opt-in and opt-out event."),
        ("clipboard", "Message Templates",
         "Send campaigns that meet all compliance standards."),
        ("smile", "Peace of Mind",
         "Reduce risk while focusing on growing your business."),
    ],
    pillars_eyebrow="What you get",
    pillars_title="Protect Your Business and Build Trust",
    pillars_lede="Compliance handled at the platform level, not left to your team’s memory.",
    pillars=[
        ("lock", "Secure Opt-In Collection",
         "Collect consent the right way, every time.",
         ["Verified customer consent stored automatically",
          "Built-in double opt-in protection",
          "QR codes and keywords built for compliance"]),
        ("user-check", "Easy Opt-Out Management",
         "Keep customer trust front and center.",
         ["Instant STOP keyword recognition",
          "Automatic non-marketing list updates",
          "Customer-friendly preference options"]),
        ("file-check", "Built-In Safeguards",
         "Stay protected without slowing down.",
         ["Pre-approved quick replies that meet industry standards",
          "TCPA and CTIA alignment for every campaign",
          "Full message history for audits and record keeping"]),
    ],
    testimonials=True, faq=True,
)

PAGES["data-analytics"] = dict(
    nav="Products", eyebrow="Data analytics",
    title="Data Analytics",
    meta="Unlock insights and drive decisions with powerful analytics. Customer insights, "
         "segmentation data, performance dashboards, and redemption tracking.",
    h1="Data That Powers Smarter Connections",
    lede="Beyond messaging — track, analyze, and optimize every conversation to grow your "
         "business smarter.",
    features_eyebrow="Features and benefits",
    features_title="What You Get With Data Analytics",
    features_lede="Track performance. Prove ROI. Grow faster.",
    features=[
        ("users", "Customer Insights", "Understand consumer patterns and behaviors."),
        ("filter", "Segmentation Data", "Target messages with precision."),
        ("gauge", "Performance Dashboards", "Visualize results in a single view."),
        ("bar-chart", "Campaign Comparison", "Know which texts drive the best ROI."),
        ("download", "Export Reports", "Share insights with your team easily."),
        ("ticket", "Redemption Tracking", "See exactly how many customers redeem each promotion."),
    ],
    pillars_eyebrow="What you get",
    pillars_title="Track Performance. Prove ROI. Grow Faster.",
    pillars_lede="From first opt-in to attributed revenue, in one view.",
    pillars=[
        ("activity", "Measure Every Signal",
         "Nothing happens on the platform that you can’t see.",
         ["Opt-ins, check-ins, clicks, and redemptions",
          "Performance by location, team, or campaign",
          "Real-time, not end-of-month"]),
        ("target", "Segment With Precision",
         "Send to the people most likely to act.",
         ["Behavior and visit-recency segments",
          "Location-based targeting",
          "Reusable audiences for every campaign"]),
        ("trending-up", "Prove the Return",
         "Tie messages to money.",
         ["Redemption rates per offer",
          "Estimated revenue per campaign",
          "Exportable reports for your team"]),
    ],
    testimonials=True, faq=True,
)
