/* ==========================================================================
   Quote engine
   --------------------------------------------------------------------------
   The one place proposal arithmetic lives. Both the proposal generator and the
   pricing screens call in here, so a rate can never be blended one way on one
   page and another way on the next.

   A merchant type carries a card mix: which interchange programs its
   transactions clear at, and in what proportion. Every program is looked up in
   assets/js/interchange.js by brand and code, so a mix can only ever quote a
   rate that appears in the processor's published schedule. A code that does not
   resolve is reported rather than silently skipped.
   ========================================================================== */

(function () {
  'use strict';

  var IC = window.WPI_INTERCHANGE || { programs: [] };
  var P = window.WPI_PRICING || {};

  /* brand|code -> program. The schedule prints a handful of codes twice under
     different names at identical rates; the first spelling wins. */
  var INDEX = {};
  IC.programs.forEach(function (p) {
    var key = p.brand + '|' + p.code;
    if (!INDEX[key]) INDEX[key] = p;
  });

  function program(brand, code) {
    return INDEX[brand + '|' + code] || null;
  }

  /* Turn a mix of {brand, code, weight} into rows carrying live rates. */
  function resolve(mix) {
    var rows = [], missing = [];
    (mix || []).forEach(function (m) {
      var p = program(m.brand, m.code);
      if (!p) { missing.push(m.brand + ' ' + m.code); return; }
      rows.push({
        code: p.code, brand: p.brand, kind: p.kind, name: p.name,
        rate: p.rate, item: p.item,
        weight: m.weight,
        ticket: m.ticket == null ? 1 : m.ticket
      });
    });
    return { rows: rows, missing: missing };
  }

  /* Weighted interchange, and the network dues that ride on top of it.
     
     A rate applies to volume; a per-item applies to a count. Those are not the
     same weighting, and treating them as one is the mistake that quietly breaks
     a quote: regulated debit is over half of a retail merchant's transactions
     but clears at 0.05%, so blending the rate by transaction share alone
     understates interchange by a quarter and produces proposals that lose money.

     So each row carries `ticket` — its average sale relative to the merchant's
     overall average, defaulting to 1. Volume share follows from weight × ticket,
     the rate is blended across volume share, and the per-item across the
     transaction share it was given.

     Dues differ by network, so they ride the same two weightings. */
  function blend(mix) {
    var r = resolve(mix);
    var out = { rows: r.rows, missing: r.missing, weight: 0,
                rate: 0, item: 0, duesRate: 0, duesItem: 0 };
    var dues = P.dues || {};

    var basis = 0;
    r.rows.forEach(function (row) { basis += row.weight * row.ticket; });

    r.rows.forEach(function (row) {
      var d = dues[row.brand] || { pct: 0, perItem: 0 };
      row.volumeShare = basis ? row.weight * row.ticket / basis : 0;
      out.weight   += row.weight;
      out.rate     += row.volumeShare * row.rate;
      out.item     += row.weight * row.item;
      out.duesRate += row.volumeShare * d.pct;
      out.duesItem += row.weight * d.perItem;
    });
    return out;
  }

  function merchantType(id) {
    var types = P.merchantTypes || [];
    for (var i = 0; i < types.length; i++) if (types[i].id === id) return types[i];
    return types[0] || null;
  }

  function model(id) {
    var models = P.models || [];
    for (var i = 0; i < models.length; i++) if (models[i].id === id) return models[i];
    return models[0] || null;
  }

  /* Fee lines a given pricing model is allowed to carry. Dual pricing rolls the
     statement and PCI lines into its service fee, so those are not simply
     switched off by default - they cannot be billed on it at all. */
  function allowed(model, id) {
    return !model || !model.excludes || model.excludes.indexOf(id) < 0;
  }

  /* Monthly cost of the fee lines a rep switched on and the model permits. */
  function fees(ids, txns, model) {
    var out = [], total = 0;
    (P.marginAdjustments || []).forEach(function (a) {
      if ((ids || []).indexOf(a.id) < 0) return;
      if (!allowed(model, a.id)) return;
      var amount = a.unit === 'perItem' ? a.amount * txns : a.amount;
      total += amount;
      out.push({ id: a.id, name: a.name, unit: a.unit, rate: a.amount, amount: amount });
    });
    return { lines: out, total: total };
  }

  /* --------------------------------------------------------------- quoting */
  /*
     opts:
       type          merchant type id
       model         pricing model id
       volume        monthly card volume
       txns          monthly transaction count
       adjustments   array of margin adjustment ids
       actualCost    optional: interchange + dues straight off the merchant's
                     statement. Given, it replaces the blended figure entirely,
                     which is the exact answer rather than a modelled one.
       currentFees, currentMonthly   what they pay today
  */
  function quote(opts) {
    var type = merchantType(opts.type);
    var m = model(opts.model);
    var volume = Number(opts.volume) || 0;
    var txns = Number(opts.txns) || 0;

    var mix = blend(type ? type.mix : []);
    var modelled = volume * mix.rate / 100 + txns * mix.item;
    var modelledDues = volume * mix.duesRate / 100 + txns * mix.duesItem;

    var usingActual = opts.actualCost != null && opts.actualCost !== '' &&
                      Number(opts.actualCost) > 0;
    var cost = usingActual ? Number(opts.actualCost) : modelled + modelledDues;
    var interchange = usingActual ? cost : modelled;
    var dues = usingActual ? 0 : modelledDues;

    var lines = [];
    var markup = 0;

    if (m.id === 'icplus') {
      markup = volume * m.markupPct / 100 + txns * m.markupPerItem;
      lines.push({ label: 'Interchange — passed through at cost',
                   detail: usingActual
                     ? 'From the merchant\'s statement'
                     : mix.rate.toFixed(3) + '% + ' + money(mix.item) + ' blended',
                   amount: interchange, cost: true });
      if (dues) {
        lines.push({ label: 'Network dues and assessments',
                     detail: mix.duesRate.toFixed(4) + '% + ' + money(mix.duesItem),
                     amount: dues, cost: true });
      }
      lines.push({ label: m.name,
                   detail: m.markupPct + '% + ' + money(m.markupPerItem) + ' over cost',
                   amount: markup });
    } else if (m.id === 'flat') {
      var gross = volume * m.flatPct / 100 + txns * m.flatPerItem;
      markup = gross - cost;
      lines.push({ label: m.name,
                   detail: m.flatPct + '% + ' + money(m.flatPerItem) + ' on every transaction',
                   amount: gross });
    } else {
      markup = m.monthly;
      lines.push({ label: m.name,
                   detail: m.dualPct + '% card price · card price carries the cost',
                   amount: 0 });
      lines.push({ label: m.feeLabel || 'Program fee',
                   detail: money(m.monthly) + ' a month',
                   amount: m.monthly });
    }

    var fee = fees(opts.adjustments, txns, m);
    fee.lines.forEach(function (l) {
      lines.push({ label: l.name,
                   detail: l.unit === 'perItem' ? money(l.rate) + ' × ' + txns : null,
                   amount: l.amount });
    });

    /* Round each line to cents before summing, so the total on a printed sheet
       always equals the lines above it. Summing at full precision and rounding
       once leaves the page a penny out, which reads as an arithmetic error to
       the person being quoted. */
    lines.forEach(function (l) { l.amount = Math.round(l.amount * 100) / 100; });
    var proposed = lines.reduce(function (sum, l) { return sum + l.amount; }, 0);
    proposed = Math.round(proposed * 100) / 100;
    var current = (Number(opts.currentFees) || 0) + (Number(opts.currentMonthly) || 0);

    return {
      type: type, model: m, mix: mix, lines: lines,
      volume: volume, txns: txns,
      ticket: txns ? volume / txns : 0,
      interchange: interchange, dues: dues, cost: cost, markup: markup,
      usingActual: usingActual,
      fees: fee.total,
      proposed: proposed,
      current: current,
      saving: current - proposed,
      currentRate: volume ? current / volume * 100 : 0,
      proposedRate: volume ? proposed / volume * 100 : 0
    };
  }

  /* Per-item amounts run to four places (dues are $0.0195), money to two.
     Trailing zeros past the cents are trimmed so $0.1500 reads as $0.15. */
  function money(n) {
    n = Number(n) || 0;
    var s = Math.abs(n) < 1 ? n.toFixed(4) : n.toFixed(2);
    return '$' + s.replace(/(\.\d\d)0+$/, '$1');
  }

  window.WPI_QUOTE = {
    allows: allowed,
    program: program,
    resolve: resolve,
    blend: blend,
    merchantType: merchantType,
    model: model,
    quote: quote,
    programs: IC.programs,
    source: IC.source
  };
})();
