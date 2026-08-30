/* WPI Rewards — portal data
   Balances, transactions, orders and activity are taken from the captured
   account snapshot (Colony House Liquor, Aug 15 2026). Catalog entries mirror
   the live catalog's structure; swap in the full feed when wiring the API. */

window.WPI = (function () {
  "use strict";

  const account = {
    business: "Colony House Liquor",
    initials: "CH",
    mid: "554402059848457",
    role: "Merchant Admin",
    memberSince: "February 2026",
    availablePoints: 9683,
    pendingPoints: 43564,
    get totalPoints() { return this.availablePoints + this.pendingPoints; },
  };

  const support = {
    email: "support@wholesalepayments.com",
    phone: "929-367-8896",
    phoneHref: "tel:+19293678896",
  };

  /* categories: gift | luxury | travel | merch */
  const catalog = [
    // Gift cards
    { id: "gc-amazon-100", cat: "gift", brand: "Amazon",      name: "$100 Amazon Gift Card (Digital)",  desc: "Delivered by email within one business day.", points: 12000 , img: "https://tuzo-django-store.s3.amazonaws.com/Amazon_Gift_Card.jpg" },
    { id: "gc-apple",      cat: "gift", brand: "Apple",       name: "$100 Apple Gift Card",             desc: "Digital delivery; apps, music, devices and more.", points: 12000 , img: "https://tuzo-django-store.s3.amazonaws.com/Applee.png", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2FApplee.png&w=640&q=75" },
    { id: "gc-ubereats",   cat: "gift", brand: "Uber Eats",   name: "$100 Uber Eats Gift Card",         desc: "Delivered by email within one business day.", points: 12000 , img: "https://tuzo-django-store.s3.amazonaws.com/Ubereatsresize.png", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2FUbereatsresize.png&w=640&q=75" },
    { id: "gc-ebay",       cat: "gift", brand: "eBay",        name: "$100 eBay Gift Card",              desc: "Delivered by email within one business day.", points: 12000 , img: "https://tuzo-django-store.s3.amazonaws.com/eBayBlue.png", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2FeBayBlue.png&w=640&q=75" },
    { id: "gc-chickfila",  cat: "gift", brand: "Chick-fil-A", name: "$100 Chick-fil-A Gift Card",       desc: "Delivered by email within one business day.", points: 12000 , img: "https://tuzo-django-store.s3.amazonaws.com/Chickresize.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2FChickresize.jpg&w=640&q=75" },
    { id: "gc-express",    cat: "gift", brand: "Express",     name: "$100 Express Gift Card",           desc: "Delivered by email within one business day.", points: 12000 , img: "https://tuzo-django-store.s3.amazonaws.com/Exxpress_1.png", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2FExxpress_1.png&w=640&q=75" },

    // Merchandise & electronics (as featured on the captured dashboard)
    { id: "m-macbook",   cat: "merch", brand: "Apple",    name: "MacBook Pro 14-inch (M4)",              desc: "Ships factory sealed with full warranty.", points: 206880 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/yUpYhuhxfonEaCPZe1NN_main_image_l6OPyFP.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FyUpYhuhxfonEaCPZe1NN_main_image_l6OPyFP.jpg&w=640&q=75" },
    { id: "m-ipad",      cat: "merch", brand: "Apple",    name: "iPad Air 11-inch (M3)",                 desc: "Ships factory sealed with full warranty.", points: 68880 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/xWiStCkryEkpDqQiSb45_main_image_IQn71DV.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FxWiStCkryEkpDqQiSb45_main_image_IQn71DV.jpg&w=640&q=75" },
    { id: "m-golf",      cat: "merch", brand: "Callaway", name: "Callaway Strata Complete Golf Set",     desc: "Ships direct in 5–7 business days.", points: 64799 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/yYWuBMJo0NcUkdK3ftwN_main_image_Qxbb5Xn.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FyYWuBMJo0NcUkdK3ftwN_main_image_Qxbb5Xn.jpg&w=640&q=75" },
    { id: "m-tcl-tv",    cat: "merch", brand: "TCL",      name: "TCL 55\" 4K UHD Smart TV",              desc: "Ships direct in 5–7 business days.", points: 43199 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/yGqIeHcUaBYoicAbJYx2_main_image_Ubn2R0D.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FyGqIeHcUaBYoicAbJYx2_main_image_Ubn2R0D.jpg&w=640&q=75" },
    { id: "m-sony-buds", cat: "merch", brand: "Sony",     name: "Sony WF-1000XM5 Wireless Earbuds",      desc: "Ships factory sealed with full warranty.", points: 41280 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/xw1PAtzhjTUjQZCCvT1v_main_image_7EMkb1l.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2Fxw1PAtzhjTUjQZCCvT1v_main_image_7EMkb1l.jpg&w=640&q=75" },

    // Luxury goods (as listed in the live catalog)
    { id: "l-cartier-bb42-gold", cat: "luxury", brand: "Cartier",   name: "Ballon Bleu de Cartier — 42mm Pink Gold, Brown Leather", desc: "18K pink gold case, silver opaline dial, caliber 1847 MC.", points: 2428800 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/iljXNZRdYGOomlnMfb0L_main_image_PnzpGuh.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FiljXNZRdYGOomlnMfb0L_main_image_PnzpGuh.jpg&w=3840&q=75" },
    { id: "l-rolex-sub",         cat: "luxury", brand: "Rolex",     name: "Submariner Date 126610LN",                               desc: "Iconic divers' watch with Cyclops date magnifier.", points: 2015000 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards/c8706157-4ea2-4bec-93da-c9b658e0314d/main/b4a5abef-7b2a-4eb3-b634-e9a9c01d0c7c.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards%2Fc8706157-4ea2-4bec-93da-c9b658e0314d%2Fmain%2Fb4a5abef-7b2a-4eb3-b634-e9a9c01d0c7c.jpg&w=3840&q=75" },
    { id: "l-omega-yg",          cat: "luxury", brand: "Omega",     name: "Seamaster Diver 300M — 42mm Steel & Yellow Gold",        desc: "Co-Axial Master Chronometer, blue ceramic dial.", points: 1752600 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/cmf4iwUJX7e3WNOeVAkD_main_image_ippWEJK.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2Fcmf4iwUJX7e3WNOeVAkD_main_image_ippWEJK.jpg&w=3840&q=75" },
    { id: "l-omega-sedna",       cat: "luxury", brand: "Omega",     name: "Seamaster Diver 300M — 42mm Steel & Sedna Gold",         desc: "Co-Axial Master Chronometer, black ceramic dial.", points: 1752600 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/4coPGMoHcmcyNqXneZYg_main_image_6OcccFQ.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2F4coPGMoHcmcyNqXneZYg_main_image_6OcccFQ.jpg&w=3840&q=75" },
    { id: "l-cartier-bb42-steel", cat: "luxury", brand: "Cartier",  name: "Ballon Bleu de Cartier — 42mm Steel & Yellow Gold",      desc: "Silvered guilloché dial, caliber 1847 MC automatic.", points: 1669800 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/2Rv9avQKTMuJziNIlihq_main_image_hqRqDOu.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2F2Rv9avQKTMuJziNIlihq_main_image_hqRqDOu.jpg&w=3840&q=75" },
    { id: "l-cartier-santos-lg", cat: "luxury", brand: "Cartier",   name: "Santos de Cartier — Large, Gold & Steel",                desc: "Yellow gold bezel, silvered opaline dial.", points: 1614600 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/N1mhyCf9TcLJ8m6UPLYd_main_image_K0cZHA3.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FN1mhyCf9TcLJ8m6UPLYd_main_image_K0cZHA3.jpg&w=3840&q=75" },
    { id: "l-cartier-bb36",      cat: "luxury", brand: "Cartier",   name: "Ballon Bleu de Cartier — 36mm Steel & Yellow Gold",      desc: "Interchangeable two-tone strap, automatic movement.", points: 1476600 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/iKbDWzOFV2IoDpCqCNWC_main_image_SzQCJl3.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FiKbDWzOFV2IoDpCqCNWC_main_image_SzQCJl3.jpg&w=3840&q=75" },
    { id: "l-cartier-santos-md", cat: "luxury", brand: "Cartier",   name: "Santos de Cartier — Medium, Yellow Gold & Steel",        desc: "Silvered opaline dial, steel bracelet.", points: 1462800 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/lmLHkeWYX3sG3B1Ifq5H_main_image_ZAxjPVo.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FlmLHkeWYX3sG3B1Ifq5H_main_image_ZAxjPVo.jpg&w=3840&q=75" },
    { id: "l-brt-super-black",   cat: "luxury", brand: "Breitling", name: "Super Chronomat B01 44 — Black Dial, Metal Bracelet",    desc: "Breitling 01 movement, ratcheted rotating bezel.", points: 1407600 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/nWvmOChIbNRXJkGE5tfr_main_image_fau9EG8.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FnWvmOChIbNRXJkGE5tfr_main_image_fau9EG8.jpg&w=3840&q=75" },
    { id: "l-brt-super-blue",    cat: "luxury", brand: "Breitling", name: "Super Chronomat B01 44 — Blue Dial, Metal Bracelet",     desc: "Breitling 01 movement, ratcheted rotating bezel.", points: 1407600 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/ybLHmDNXQptkN8dKnJbZ_main_image_SQd6pY4.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FybLHmDNXQptkN8dKnJbZ_main_image_SQd6pY4.jpg&w=3840&q=75" },
    { id: "l-brt-chronomat36",   cat: "luxury", brand: "Breitling", name: "Chronomat Automatic 36 — Steel & Red Gold",              desc: "Mother-of-pearl dial, steel and red gold bracelet.", points: 1373400 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/osVcopppk7e9r5opetx8_main_image_k9Ta7US.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FosVcopppk7e9r5opetx8_main_image_k9Ta7US.jpg&w=3840&q=75" },
    { id: "l-brt-nav43-black",   cat: "luxury", brand: "Breitling", name: "Navitimer B01 Chronograph 43 — Black Dial",              desc: "Bidirectional slide rule bezel, steel bracelet.", points: 1373400 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/rBZFcLnjnOQjpSok3LjB_main_image_RJuoql8.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FrBZFcLnjnOQjpSok3LjB_main_image_RJuoql8.jpg&w=3840&q=75" },
    { id: "l-brt-nav43-silver",  cat: "luxury", brand: "Breitling", name: "Navitimer B01 Chronograph 43 — Silver Dial",             desc: "Bidirectional slide rule bezel, steel bracelet.", points: 1373400 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/WXreuGuVdv6FwDst5prF_main_image_PfrzK7q.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FWXreuGuVdv6FwDst5prF_main_image_PfrzK7q.jpg&w=3840&q=75" },
    { id: "l-brt-nav41-blue",    cat: "luxury", brand: "Breitling", name: "Navitimer B01 Chronograph 41 — Blue Dial",               desc: "Bidirectional slide rule bezel, steel bracelet.", points: 1359600 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/GREe1V4KI794KuDeyS7Y_main_image_d804TbZ.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FGREe1V4KI794KuDeyS7Y_main_image_d804TbZ.jpg&w=3840&q=75" },
    { id: "l-brt-nav41-ice",     cat: "luxury", brand: "Breitling", name: "Navitimer B01 Chronograph 41 — Ice Blue Dial",           desc: "Bidirectional slide rule bezel, steel bracelet.", points: 1359600 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/yeSM3OUdRZFnYicmlXSa_main_image_9WG4LjG.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FyeSM3OUdRZFnYicmlXSa_main_image_9WG4LjG.jpg&w=3840&q=75" },
    { id: "l-brt-super-rubber",  cat: "luxury", brand: "Breitling", name: "Super Chronomat B01 44 — Black Rubber Strap",            desc: "Breitling 01 movement, folding buckle.", points: 1352400 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/ErIOkdtjnFVtISN4gf4H_main_image_bjzoTIg.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FErIOkdtjnFVtISN4gf4H_main_image_bjzoTIg.jpg&w=3840&q=75" },
    { id: "l-brt-nav43-ice",     cat: "luxury", brand: "Breitling", name: "Navitimer B01 Chronograph 43 — Ice Blue Dial",           desc: "Bidirectional slide rule bezel, steel bracelet.", points: 1373400 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/eyjyahBx61vl2XtXgU2E_main_image_jIKHvjq.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FeyjyahBx61vl2XtXgU2E_main_image_jIKHvjq.jpg&w=3840&q=75" },
    { id: "l-brt-nav41-silver",  cat: "luxury", brand: "Breitling", name: "Navitimer B01 Chronograph 41 — Silver Dial",             desc: "Bidirectional slide rule bezel, steel bracelet.", points: 1359600 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/mOapqtIutXyXJDz0WKAM_main_image_D7NpG8o.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FmOapqtIutXyXJDz0WKAM_main_image_D7NpG8o.jpg&w=3840&q=75" },
    { id: "l-brt-nav41-black",   cat: "luxury", brand: "Breitling", name: "Navitimer B01 Chronograph 41 — Black Dial",              desc: "Bidirectional slide rule bezel, steel bracelet.", points: 1359600 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/SBqZVUSegZZiMB8bXaEP_main_image_tB8crOX.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FSBqZVUSegZZiMB8bXaEP_main_image_tB8crOX.jpg&w=3840&q=75" },
    { id: "l-brt-super-rubber-blue", cat: "luxury", brand: "Breitling", name: "Super Chronomat B01 44 — Blue Rubber Strap",         desc: "Breitling 01 movement, folding buckle.", points: 1352400 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/tRZUpvBLeA3EcBq5sRvk_main_image_N6WdYoT.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FtRZUpvBLeA3EcBq5sRvk_main_image_N6WdYoT.jpg&w=3840&q=75" },
    { id: "l-brt-nav43-leather", cat: "luxury", brand: "Breitling", name: "Navitimer B01 Chronograph 43 — Blue Dial, Leather Strap", desc: "Bidirectional slide rule bezel, alligator leather strap.", points: 1304400 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/yhAnRgtkhrDIWyQLVxbh_main_image_SOkvmM9.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FyhAnRgtkhrDIWyQLVxbh_main_image_SOkvmM9.jpg&w=3840&q=75" },
    { id: "l-omega-white",       cat: "luxury", brand: "Omega",     name: "Seamaster Diver 300M — 42mm White Dial, Rubber Strap",   desc: "Co-Axial Master Chronometer, black ceramic bezel.", points: 772800 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/xpsMfRwhCYww63r2x2T7_main_image_74Ev5t2.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FxpsMfRwhCYww63r2x2T7_main_image_74Ev5t2.jpg&w=3840&q=75" },
    { id: "l-brt-superocean",    cat: "luxury", brand: "Breitling", name: "Superocean Heritage B20 — 44mm Blue Dial",               desc: "Automatic B20 movement, blue rubber strap.", points: 759000 , img: "https://tuzo-django-store.s3.amazonaws.com/rewards_images/xUbpt5oLTrzi3t14u0aY_main_image_qiJmyln.jpg", imgAlt: "https://wpirewards.com/_next/image/?url=https%3A%2F%2Ftuzo-django-store.s3.amazonaws.com%2Frewards_images%2FxUbpt5oLTrzi3t14u0aY_main_image_qiJmyln.jpg&w=3840&q=75" },
  ];

  /* Processing transactions → points earned (captured from the account) */
  const transactions = [
    { date: "2026-08-13", amount: 2494.15, points: 499 },
    { date: "2026-08-12", amount: 2924.53, points: 585 },
    { date: "2026-08-11", amount: 2599.36, points: 520 },
    { date: "2026-08-10", amount: 3803.97, points: 761 },
    { date: "2026-08-09", amount: 8217.32, points: 1643 },
    { date: "2026-08-07", amount: 2063.74, points: 413 },
    { date: "2026-08-06", amount: 1858.72, points: 372 },
    { date: "2026-08-05", amount: 2142.09, points: 428 },
    { date: "2026-08-04", amount: 2349.26, points: 470 },
    { date: "2026-08-03", amount: 4414.75, points: 883 },
    { date: "2026-08-02", amount: 6656.38, points: 1331 },
    { date: "2026-07-31", amount: 2474.89, points: 495 },
    { date: "2026-07-30", amount: 1884.45, points: 377 },
    { date: "2026-07-29", amount: 1788.89, points: 358 },
    { date: "2026-07-28", amount: 2704.59, points: 541 },
    { date: "2026-07-27", amount: 3811.15, points: 762 },
    { date: "2026-07-26", amount: 9086.89, points: 1817 },
    { date: "2026-07-24", amount: 3036.41, points: 607 },
    { date: "2026-07-23", amount: 1887.13, points: 377 },
    { date: "2026-07-22", amount: 1950.90, points: 390 },
    { date: "2026-07-21", amount: 2067.88, points: 414 },
    { date: "2026-07-20", amount: 4405.52, points: 881 },
    { date: "2026-07-19", amount: 8737.72, points: 1748 },
    { date: "2026-07-17", amount: 2612.51, points: 523 },
    { date: "2026-07-16", amount: 2441.19, points: 488 },
    { date: "2026-07-15", amount: 1914.07, points: 383 },
    { date: "2026-07-14", amount: 2202.99, points: 441 },
    { date: "2026-07-13", amount: 3130.80, points: 626 },
    { date: "2026-07-12", amount: 8642.08, points: 1728 },
    { date: "2026-07-10", amount: 1941.52, points: 388 },
  ];

  const orders = [
    { id: "ORD-B830205F82", productId: "gc-amazon-100", name: "$100 Amazon Gift Card (Digital)", date: "2026-07-27", qty: 1, points: 12000, status: "Confirmed" },
    { id: "ORD-08BED175D9", productId: "gc-amazon-100", name: "$100 Amazon Gift Card (Digital)", date: "2026-07-03", qty: 1, points: 12000, status: "Confirmed" },
    { id: "ORD-8D74F8CD9D", productId: "gc-amazon-100", name: "$100 Amazon Gift Card (Digital)", date: "2026-06-03", qty: 1, points: 12000, status: "Confirmed" },
  ];

  const faq = [
    { q: "How does the rewards program work?",
      a: "Every payment you process through Wholesale Payments earns reward points automatically — no enrollment steps and nothing extra at the terminal. Points accrue daily and appear here in your portal, where you can redeem them for gift cards, merchandise and more." },
    { q: "What can I redeem points for?",
      a: "The catalog covers digital gift cards from major brands, name-brand merchandise and luxury goods. Use the \"Within my points\" toggle in the catalog to see everything you can redeem today." },
    { q: "Can I give my points to an employee or a customer?",
      a: "Yes. Many merchants redeem points for gift cards and pass them along as staff incentives or customer thank-yous. Contact support if you'd like help setting up a recurring employee-rewards routine." },
    { q: "Do my points expire?",
      a: "Points stay in your account as long as your processing account remains active and in good standing. There is no scheduled expiration, so you can save toward larger rewards." },
    { q: "When do my points move from Pending to Available?",
      a: "Points earned on recent transactions are held as Pending while the underlying batches settle, then automatically become Available for redemption — typically after the settlement cycle completes." },
    { q: "How do reward goals work?",
      a: "Add any catalog item as a goal and your dashboard will track your progress toward it as points accrue, so you always know how close you are to the reward you actually want." },
  ];

  const fmt = new Intl.NumberFormat("en-US");
  const fmtUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtDateLong = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return { account, support, catalog, transactions, orders, faq, fmt, fmtUsd, fmtDate, fmtDateLong };
})();
