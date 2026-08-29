"""Inline SVG icon library for the Customer Connect site.

Stroke-based, 24x24 grid, `currentColor` — so icons inherit brand colour from CSS.
Keeping them inline (rather than an icon font or sprite sheet) means zero network
requests and no flash of unstyled icons.
"""

_STROKE = ('fill="none" stroke="currentColor" stroke-width="1.85" '
           'stroke-linecap="round" stroke-linejoin="round"')

# name -> inner SVG markup (paths only)
PATHS = {
    # --- arrows / chrome ---------------------------------------------------
    "arrow-right":   '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    "arrow-up":      '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
    "arrow-up-right":'<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
    "chevron-down":  '<path d="m6 9 6 6 6-6"/>',
    "chevron-right": '<path d="m9 6 6 6-6 6"/>',
    "chevron-left":  '<path d="m15 6-6 6 6 6"/>',
    "check":         '<path d="M20 6 9 17l-5-5"/>',
    "plus":          '<path d="M12 5v14"/><path d="M5 12h14"/>',
    "search":        '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    "external":      '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',

    # --- messaging --------------------------------------------------------
    "message":       '<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"/>',
    "message-dots":  '<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"/><path d="M8.5 10h.01"/><path d="M12 10h.01"/><path d="M15.5 10h.01"/>',
    "messages-two":  '<path d="M17 13a2 2 0 0 1-2 2H8l-4 3.5V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2Z"/><path d="M8 15v1a2 2 0 0 0 2 2h6l4 3.5V10a2 2 0 0 0-2-2h-1"/>',
    "send":          '<path d="M21 3 3 10.5l7 3.5 3.5 7Z"/><path d="M21 3 10 14"/>',
    "inbox":         '<path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6"/><path d="M3 12h5l1.5 2.5h5L16 12h5L18.5 5A2 2 0 0 0 16.6 4H7.4a2 2 0 0 0-1.9 1Z"/>',
    "image":         '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-4.5 3.5 3L16 13l4 4"/>',
    "bell":          '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>',
    "at-sign":       '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',

    # --- customers / people ----------------------------------------------
    "users":         '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M21 20v-1.5a4 4 0 0 0-3-3.85"/><path d="M15.5 4.2a3.5 3.5 0 0 1 0 6.6"/>',
    "user-plus":     '<path d="M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="8.5" cy="7.5" r="3.5"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
    "user-check":    '<path d="M14 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="8" cy="7.5" r="3.5"/><path d="m16 11.5 2 2 4-4"/>',
    "heart":         '<path d="M20.3 5.7a5.1 5.1 0 0 0-7.2 0L12 6.8l-1.1-1.1a5.1 5.1 0 0 0-7.2 7.2L12 21l8.3-8.1a5.1 5.1 0 0 0 0-7.2Z"/>',
    "handshake":     '<path d="m11 17 2 2 3.5-3.5"/><path d="M3 11l4-4 3 2 3-2 4 4"/><path d="M3 11v4l4.5 4.5a2 2 0 0 0 2.8 0"/><path d="M21 11v4l-3 3"/>',
    "smile":         '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4.2 4.2 0 0 0 7 0"/><path d="M9 9.5h.01"/><path d="M15 9.5h.01"/>',

    # --- growth / analytics ----------------------------------------------
    "trending-up":   '<path d="m3 16 5.5-5.5 3.5 3.5L21 5"/><path d="M15 5h6v6"/>',
    "bar-chart":     '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    "pie-chart":     '<path d="M21 15.5A9 9 0 1 1 8.5 3v9h12.5Z"/><path d="M12.5 3a9 9 0 0 1 8.5 8.5"/>',
    "activity":      '<path d="M22 12h-4l-3 8-4-16-3 8H2"/>',
    "target":        '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    "gauge":         '<path d="M21 16a9 9 0 1 0-18 0"/><path d="m12 12 4-3.5"/><circle cx="12" cy="12" r="1.4"/>',
    "dollar":        '<path d="M12 2v20"/><path d="M17 6.5c0-1.9-2.2-3-5-3s-5 1.3-5 3.3S9 10 12 10.5s5 1 5 3.2-2.2 3.3-5 3.3-5-1.1-5-3"/>',
    "layers":        '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
    "filter":        '<path d="M3 5h18l-7 8v6l-4-2v-4Z"/>',
    "clipboard":     '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 3v1"/><path d="m9 13 1.8 1.8L14.5 11"/>',
    "download":      '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
    "upload":        '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>',

    # --- loyalty / offers -------------------------------------------------
    "gift":          '<rect x="3" y="8.5" width="18" height="12" rx="2"/><path d="M12 8.5V21"/><path d="M3 13h18"/><path d="M12 8.5S10.5 4 8 4a2.5 2.5 0 0 0 0 4.5Z"/><path d="M12 8.5S13.5 4 16 4a2.5 2.5 0 0 1 0 4.5Z"/>',
    "star":          '<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9Z"/>',
    "award":         '<circle cx="12" cy="9" r="6"/><path d="m8.5 14.5-1.5 7 5-3 5 3-1.5-7"/>',
    "tag":           '<path d="M20 12.5 12.5 20a2 2 0 0 1-2.8 0l-6-6a2 2 0 0 1 0-2.8L11 3.8a2 2 0 0 1 1.7-.6l6 .9a1.5 1.5 0 0 1 1.3 1.3l.6 5.4a2 2 0 0 1-.6 1.7Z"/><circle cx="15.5" cy="8.5" r="1.4"/>',
    "ticket":        '<path d="M3 9V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V9a3 3 0 0 0 0 6v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V15a3 3 0 0 0 0-6Z"/><path d="M12 8v8"/>',
    "repeat":        '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    "sparkles":      '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9Z"/><path d="M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>',
    "coins":         '<circle cx="9" cy="9" r="6"/><path d="M15.6 5.2a6 6 0 0 1 0 13.6"/><path d="M9 15v6"/>',

    # --- devices ----------------------------------------------------------
    "smartphone":    '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18.5h2"/>',
    "tablet":        '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    "monitor":       '<rect x="2.5" y="4" width="19" height="12.5" rx="2.5"/><path d="M8 20.5h8"/><path d="M12 16.5v4"/>',
    "kiosk":         '<rect x="5" y="2.5" width="14" height="14.5" rx="2.5"/><path d="M9 21h6"/><path d="M12 17v4"/><path d="M9.5 7.5h5"/><path d="M9.5 11h3"/>',
    "qr":            '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3z"/><path d="M20 14v.01"/><path d="M14 20.5v.01"/><path d="M20.5 20.5v.01"/>',
    "wifi":          '<path d="M2.5 9a15 15 0 0 1 19 0"/><path d="M6 12.5a10 10 0 0 1 12 0"/><path d="M9.5 16a5 5 0 0 1 5 0"/><path d="M12 19.5h.01"/>',
    "globe":         '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
    "link":          '<path d="M10 13a4.5 4.5 0 0 0 6.4 0l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4L11 5.6"/><path d="M14 11a4.5 4.5 0 0 0-6.4 0L5 13.6a4.5 4.5 0 0 0 6.4 6.4L13 18.4"/>',

    # --- ops / trust ------------------------------------------------------
    "shield":        '<path d="M12 21s7.5-3.5 7.5-9.5V5.6L12 3 4.5 5.6v5.9C4.5 17.5 12 21 12 21Z"/><path d="m9 12 2 2 4-4"/>',
    "lock":          '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    "file-check":    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="m9 14.5 1.8 1.8 3.7-3.8"/>',
    "zap":           '<path d="M13 2 4 14h6l-1 8 9-12h-6Z"/>',
    "clock":         '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.5 2"/>',
    "calendar":      '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3.5 10.5h17"/>',
    "headset":       '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14a2.5 2.5 0 0 1 2.5 2.5v1A2.5 2.5 0 0 1 4 20Z"/><path d="M20 14a2.5 2.5 0 0 0-2.5 2.5v1A2.5 2.5 0 0 0 20 20Z"/>',
    "book":          '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10a3 3 0 0 1 3 3v14a2.5 2.5 0 0 0-2.5-2.5H4Z"/><path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H14a3 3 0 0 0-1 .2"/><path d="M13 20a2.5 2.5 0 0 1 2.5-2.5H20V4.5"/>',
    "play":          '<circle cx="12" cy="12" r="9.5"/><path d="M10 8.5l6 3.5-6 3.5Z"/>',
    "map-pin":       '<path d="M20 10.5c0 6-8 11-8 11s-8-5-8-11a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10.5" r="2.8"/>',
    "phone":         '<path d="M21 16.9v2.6a1.8 1.8 0 0 1-2 1.8 18.6 18.6 0 0 1-8.1-2.9 18.3 18.3 0 0 1-5.6-5.6A18.6 18.6 0 0 1 2.4 4.6a1.8 1.8 0 0 1 1.8-2h2.6a1.8 1.8 0 0 1 1.8 1.6c.1 1 .4 1.9.7 2.8a1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14.8 14.8 0 0 0 5.6 5.6l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.9.3 1.8.6 2.8.7A1.8 1.8 0 0 1 21 16.9Z"/>',
    "mail":          '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3 7 9 6 9-6"/>',
    "briefcase":     '<rect x="2.5" y="7.5" width="19" height="12.5" rx="2.5"/><path d="M8.5 7.5V5.5A2 2 0 0 1 10.5 3.5h3a2 2 0 0 1 2 2v2"/><path d="M2.5 13h19"/>',
    "list-checks":   '<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="m3 6 1.5 1.5L7.5 4.5"/><path d="m3 12 1.5 1.5L7.5 10.5"/><path d="m3 18 1.5 1.5L7.5 16.5"/>',
    "settings":      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11h.1a2 2 0 1 1 0 4H21Z"/>',
    "eye":           '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    "flag":          '<path d="M5 21V4"/><path d="M5 5h10l-1.5 3.5L15 12H5"/>',

    # --- industries -------------------------------------------------------
    "utensils":      '<path d="M6 3v7a2.5 2.5 0 0 0 5 0V3"/><path d="M8.5 10v11"/><path d="M17 3c-1.5 1.5-2 3-2 5s1 3 2 3 2-1 2-3-.5-3.5-2-5Z"/><path d="M17 11v10"/>',
    "scissors":      '<circle cx="6.5" cy="6.5" r="2.8"/><circle cx="6.5" cy="17.5" r="2.8"/><path d="M8.7 8.4 20 19"/><path d="M8.7 15.6 20 5"/>',
    "dumbbell":      '<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3.5 9.5v5"/><path d="M20.5 9.5v5"/><path d="M6.5 12h11"/>',
    "truck":         '<path d="M2.5 16.5V7a1.5 1.5 0 0 1 1.5-1.5h9V16.5"/><path d="M13 9.5h4l4 4v3h-8"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    "paw":           '<circle cx="7" cy="8" r="2.2"/><circle cx="12" cy="6" r="2.2"/><circle cx="17" cy="8" r="2.2"/><path d="M12 11c3 0 5.5 2.4 5.5 5a3 3 0 0 1-3 3c-1 0-1.7-.5-2.5-.5s-1.5.5-2.5.5a3 3 0 0 1-3-3c0-2.6 2.5-5 5.5-5Z"/>',
    "wrench":        '<path d="M14.5 6.5a4.5 4.5 0 1 0 5.6 5.6L21 12l-9 9-3-3 9-9Z"/><path d="m6 15 3 3"/><path d="M3 18l3 3"/>',
    "shopping-bag":  '<path d="M5 8h14l1 12.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20.5Z"/><path d="M8.5 11V6.5a3.5 3.5 0 0 1 7 0V11"/>',
    "stethoscope":   '<path d="M5 3v5a4 4 0 0 0 8 0V3"/><path d="M9 12v3a5 5 0 0 0 10 0v-2"/><circle cx="19" cy="10" r="2"/>',
    "building":      '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1"/><path d="M14 7h1"/><path d="M9 11h1"/><path d="M14 11h1"/><path d="M10 21v-4.5h4V21"/>',

    # --- social -----------------------------------------------------------
    "facebook":      '<path d="M14.5 8.5H17V5h-2.5A4.5 4.5 0 0 0 10 9.5V12H7.5v3.5H10V22h3.5v-6.5H16l.5-3.5h-3V9.8a1.3 1.3 0 0 1 1.5-1.3Z"/>',
    "linkedin":      '<path d="M7 10v8"/><path d="M7 6.5v.01"/><path d="M11.5 18v-4.5a3 3 0 0 1 6 0V18"/><path d="M11.5 10v8"/>',
    "instagram":     '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><path d="M17 7h.01"/>',
    "x-social":      '<path d="M4 4l7 9m0 0 7 7m-7-7L4 20m14-16-7 9"/>',
    "youtube":       '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10.5 9.5l5 2.5-5 2.5Z"/>',
}

# Aliases keep template code readable.
PATHS["chat"] = PATHS["message-dots"]
PATHS["reviews"] = PATHS["star"]
PATHS["analytics"] = PATHS["bar-chart"]
PATHS["loyalty"] = PATHS["gift"]
PATHS["growth"] = PATHS["trending-up"]
PATHS["team"] = PATHS["users"]
PATHS["compliance"] = PATHS["shield"]
PATHS["support"] = PATHS["headset"]
PATHS["webapp"] = PATHS["smartphone"]


def icon(name, cls="", size=None, extra=""):
    """Return inline SVG markup for `name`.

    Unknown names fall back to a neutral dot so a typo never breaks a build
    silently in a way that's invisible in the page.
    """
    inner = PATHS.get(name)
    if inner is None:
        raise KeyError("unknown icon: %s" % name)
    attrs = ['xmlns="http://www.w3.org/2000/svg"', 'viewBox="0 0 24 24"',
             _STROKE, 'aria-hidden="true"']
    if cls:
        attrs.append('class="%s"' % cls)
    if size:
        attrs.append('width="%s" height="%s"' % (size, size))
    if extra:
        attrs.append(extra)
    return "<svg %s>%s</svg>" % (" ".join(attrs), inner)


def solid_star():
    """Filled star for rating rows."""
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
            'fill="currentColor" aria-hidden="true">'
            '<path d="m12 2.5 3 6.1 6.7.9-4.9 4.7 1.2 6.7L12 17.8l-6 3.1 1.2-6.7L2.3 9.5l6.7-.9Z"/></svg>')
