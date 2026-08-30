/*
 * Statement Studio — form UI, live preview and download wiring.
 * The PDF itself is produced by js/statement.js (StatementPDF).
 */
(function () {
  'use strict';

  var fmt = StatementPDF.format;
  var STORAGE_KEY = 'statement-studio-v1';
  var LOGO_KEY = 'statement-studio-logo-v1';
  var template = 'check'; // 'check' | 'processing' | 'bank' | 'billing'
  var checkLogoUrl = null; // bank logo lifted from an uploaded check

  /* ------------------------------------------------------------------ *
   * Sample data (mirrors the reference statements' structure)
   * ------------------------------------------------------------------ */

  var SAMPLE = {
    remitAddress: ['PO Box 246', 'Alpharetta, GA, 30024', 'United States'],
    coverNotice: 'Your account will be automatically charged for the amount due. No action is required on your part.',
    notices: '',
    billTo: ['SAMPLE MERCHANT LLC', '100 Main Street', 'Springfield, TX, 75000', 'United States'],
    details: {
      statementNumber: '',
      issueDate: 'Pending',
      paymentTerms: 'Auto-Draft',
      billingId: '',
      billingAccountNumber: '815200000000',
      productId: '6'
    },
    periodStart: defaultPeriod().start,
    periodEnd: defaultPeriod().end,
    statementMonth: {
      month: String(new Date(defaultPeriod().start + 'T00:00:00').getMonth()),
      year: defaultPeriod().start.slice(0, 4),
      volume: ''
    },
    totalSales: '',
    transactionCount: '',
    summaryAuto: true,
    currency: 'USD',
    taxRate: '0',
    feesCollected: '',
    categories: {
      transaction: {
        included: true,
        items: [
          // amounts left empty on purpose — they auto-calculate
          { description: 'Sale: Qualified, Visa, Credit', count: '2', volume: '91.48', rate: '3.85%', fee: '', amount: '' },
          { description: 'Sale: Qualified, MasterCard, Debit', count: '9', volume: '495.10', rate: '3.85%', fee: '', amount: '' },
          { description: 'Sale: Qualified, Visa, Debit', count: '5', volume: '670.84', rate: '3.85%', fee: '', amount: '' }
        ]
      },
      cardNetwork: { included: true, items: [] },
      otherProcessing: {
        included: true,
        items: [
          { description: 'Recurring: Service, Monthly', count: '1', volume: '', rate: '', fee: '45', amount: '' }
        ]
      },
      thirdParty: { included: true, items: [] },
      recurring: { included: true, items: [] }
    },
    batches: [
      { date: periodDay(12), number: '152976220001', salesCount: '2', salesAmount: '91.48', refundCount: '0', refundAmount: '0.00' },
      { date: periodDay(19), number: '152976250002', salesCount: '9', salesAmount: '495.10', refundCount: '0', refundAmount: '0.00' },
      { date: periodDay(25), number: '152976280003', salesCount: '5', salesAmount: '670.84', refundCount: '0', refundAmount: '0.00' }
    ],
    template: 'check',
    style2: {
      processorLine: 'SAMPLE PROCESSING, 100 COMMERCE WAY #210, SPRINGFIELD, TX 75000',
      addressee: ['SAMPLE MERCHANT LLC', '100 MAIN STREET', 'SPRINGFIELD TX 75000-1000'],
      location: ['SAMPLE MERCHANT LLC', '100 MAIN STREET', 'SPRINGFIELD TX 75000-1000'],
      merchantNumber: '528400000000000',
      customerService: '800-555-0100',
      statementSeq: '',
      tinLabel: 'XXXXX0000',
      ytdReportable: '',
      importantInfo: '',
      cardTypes: [
        { name: 'MASTERCARD', items: '3', amount: '314.36', refundItems: '0', refundAmount: '0' },
        { name: 'VISA', items: '8', amount: '628.71', refundItems: '0', refundAmount: '0' },
        { name: 'Visa Debit', items: '4', amount: '251.48', refundItems: '0', refundAmount: '0' },
        { name: 'DCVR ACQ', items: '1', amount: '62.87', refundItems: '0', refundAmount: '0' }
      ],
      fees: [
        { group: 'MASTERCARD', type: 'CF', description: 'DUES & ASSESSMENTS', volume: '314.36', rate: '0.00130', total: '' },
        { group: 'MASTERCARD', type: 'CF', description: 'DISC 1', volume: '314.36', rate: '0.00200', total: '' },
        { group: 'AUTHS & AVS', type: 'CF', description: 'CPU GTWY', volume: '3.00', rate: '0.1000', total: '' },
        { group: 'VISA', type: 'CF', description: 'DISC 1', volume: '880.19', rate: '0.00200', total: '' },
        { group: 'VISA', type: 'CF', description: 'OTHER VOLUME FEES', volume: '880.19', rate: '0.00110', total: '' },
        { group: 'AUTHS & AVS', type: 'CF', description: 'CPU GTWY', volume: '12.00', rate: '0.1000', total: '' },
        { group: 'DCVR ACQ', type: 'CF', description: 'DISC 1', volume: '62.87', rate: '0.00200', total: '' },
        { group: 'AUTHS & AVS', type: 'MISC', description: 'REGULATORY PRODUCT', volume: '', rate: '', total: '-3.95' }
      ],
      thirdParty: [],
      adjustments: []
    },
    bank: {
      bankName: 'Meridian Bank',
      bankAddress: ['P.O. Box 4820', 'Riverton, CO 80202'],
      bankPhone: '1-800-555-0142',
      bankWebsite: 'meridianbank.example',
      accountType: 'Business Checking',
      accountNumber: '•••• 4821 7730',
      holderName: 'SAMPLE MERCHANT LLC',
      holderAddress: ['100 MAIN STREET, SUITE 5', 'SPRINGFIELD TX 75000'],
      beginningBalance: '4,215.60',
      fees: '12.00',
      credits: [
        { date: periodDay(2), description: 'Mobile Deposit', amount: '1,250.00' },
        { date: periodDay(6), description: 'ACH Credit — Card Settlement', amount: '842.19' },
        { date: periodDay(13), description: 'Customer Payment — Invoice 2041', amount: '3,100.00' },
        { date: periodDay(21), description: 'ACH Credit — Card Settlement', amount: '915.44' }
      ],
      debits: [
        { date: periodDay(3), description: 'Card Purchase — Restaurant Supply Co', amount: '318.72' },
        { date: periodDay(9), description: 'Online Transfer to Payroll', amount: '2,400.00' },
        { date: periodDay(22), description: 'ACH Debit — Utilities', amount: '214.83' }
      ],
      checks: [
        { date: periodDay(11), description: '', number: '1042', amount: '500.00' }
      ]
    },
    check: {
      payerName: 'SAMPLE MERCHANT LLC',
      payerAddress: ['100 MAIN STREET', 'SPRINGFIELD, TX 75000'],
      bankName: 'Meridian Bank',
      checkNumber: '1001',
      fraction: '00-000/000',
      date: '',
      payTo: '',
      amount: '',
      memo: '',
      routingNumber: '',
      accountNumber: '',
      voided: true,
      logo: null
    },
    letter: {
      bankName: 'Meridian Bank',
      bankAddress: '101 Commerce Street, Springfield, TX 75000',
      bankPhone: '1-800-555-0142',
      date: '',
      salutation: 'To Whom It May Concern:',
      holderName: 'SAMPLE MERCHANT LLC',
      accountLabel: '',
      accountType: '',
      holderAddress1: '100 Main Street',
      holderAddress2: 'Springfield, TX 75000',
      sinceYear: '',
      balance: '',
      thirdParty: '',
      authAction: 'credit',
      accountNumber: '',
      routingNumber: '',
      signerName: '',
      signerTitle: 'Account Manager',
      contactPhone: ''
    }
  };

  function defaultPeriod() {
    var now = new Date();
    var first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: iso(first), end: iso(last) };
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }
  // A day inside the default (previous-month) billing period.
  function periodDay(day) {
    var now = new Date();
    return iso(new Date(now.getFullYear(), now.getMonth() - 1, day));
  }

  /* ------------------------------------------------------------------ *
   * Element helpers
   * ------------------------------------------------------------------ */

  function $(id) { return document.getElementById(id); }

  function hasText(v) {
    return v !== null && v !== undefined && String(v).trim() !== '';
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  /* Inline SF-style "X" glyph for the small remove buttons (decorative —
   * each button carries its own aria-label). */
  var REMOVE_ICON =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' +
    ' aria-hidden="true" focusable="false" style="display:block">' +
    '<path d="M6 6l12 12M18 6L6 18"/></svg>';

  function input(cls, value, placeholder) {
    var node = el('input', { type: 'text', class: cls || '', spellcheck: 'false' });
    node.value = value == null ? '' : value;
    if (placeholder) node.placeholder = placeholder;
    return node;
  }

  /* ------------------------------------------------------------------ *
   * Fee category cards
   * ------------------------------------------------------------------ */

  var feeContainer = $('fee-categories');

  function buildFeeCard(def) {
    var card = el('div', { class: 'fee-cat', 'data-key': def.key });

    var toggle = el('input', { type: 'checkbox' });
    toggle.checked = true;
    toggle.addEventListener('change', function () {
      card.classList.toggle('off', !toggle.checked);
      onChange();
    });

    var head = el('div', { class: 'fee-cat-head' }, [
      el('label', { class: 'switch-row' }, [
        toggle,
        el('span', { class: 'switch', 'aria-hidden': 'true' }),
        el('span', { text: def.name })
      ]),
      el('span', { class: 'fee-cat-total' })
    ]);
    head.querySelector('.fee-cat-total').innerHTML = 'Total <strong>0.00</strong>';

    var tbody = el('tbody');
    var table = el('table', { class: 'rows-table fee-table' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Description' }),
          el('th', { class: 'num', text: 'Count' }),
          el('th', { class: 'num', text: 'Volume $' }),
          el('th', { class: 'num', text: 'Rate' }),
          el('th', { class: 'num', text: 'Fee' }),
          el('th', { class: 'num', text: 'Amount $' }),
          el('th')
        ])
      ]),
      tbody
    ]);

    var addBtn = el('button', {
      type: 'button',
      class: 'btn btn-ghost btn-small',
      text: '+ Add line item'
    });
    addBtn.addEventListener('click', function () {
      tbody.appendChild(buildFeeRow({}, def.name));
      onChange();
      var first = tbody.lastChild.querySelector('input');
      if (first) first.focus();
    });

    var body = el('div', { class: 'fee-cat-body' }, [
      el('div', { class: 'table-scroll' }, [table]),
      addBtn
    ]);

    card.appendChild(head);
    card.appendChild(body);
    return card;
  }

  // Moves focus somewhere sensible after a row is removed.
  function removeRow(tr, fallbackFocus) {
    var sibling = tr.nextElementSibling || tr.previousElementSibling;
    tr.remove();
    var target = sibling ? sibling.querySelector('.btn-icon') : fallbackFocus;
    if (target) target.focus();
    onChange();
  }

  function buildFeeRow(item, catName) {
    var tr = el('tr');
    var labels = ['description', 'count', 'volume in dollars', 'rate', 'fee', 'amount in dollars'];
    var cells = [
      input('', item.description, 'e.g. Sale: Qualified, Visa, Credit'),
      input('num', item.count, '--'),
      input('num', item.volume, '--'),
      input('num', item.rate, '--'),
      input('num', item.fee, '--'),
      input('num', item.amount, 'auto')
    ];
    cells.forEach(function (c, i) {
      c.setAttribute('aria-label', (catName || 'Fee') + ' item ' + labels[i]);
      tr.appendChild(el('td', {}, [c]));
    });

    // The amount auto-calculates from Volume × Rate(%) or Fee × Count.
    // Typing an amount pins it; clearing the field re-enables auto.
    var amount = cells[5];
    var manual = hasText(item.amount);
    function syncAmount() {
      if (manual) {
        amount.classList.remove('is-derived');
        amount.title = '';
        return;
      }
      var derived = StatementPDF.resolveAmount({
        count: cells[1].value,
        volume: cells[2].value,
        rate: cells[3].value,
        fee: cells[4].value,
        amount: ''
      });
      amount.value = derived === null ? '' : fmt.amount(derived);
      amount.classList.toggle('is-derived', derived !== null);
      amount.title = derived === null ? ''
        : 'Auto-calculated — type to override, clear to re-enable';
    }
    cells.slice(1, 5).forEach(function (c) {
      c.addEventListener('input', syncAmount);
    });
    amount.addEventListener('input', function () {
      manual = hasText(amount.value);
      syncAmount();
    });
    syncAmount();
    var rm = el('button', { type: 'button', class: 'btn-icon', title: 'Remove row', 'aria-label': 'Remove ' + (catName || 'fee') + ' row', html: REMOVE_ICON });
    rm.addEventListener('click', function () {
      removeRow(tr, tr.closest('.fee-cat').querySelector('.fee-cat-body .btn'));
    });
    tr.appendChild(el('td', {}, [rm]));
    return tr;
  }

  StatementPDF.CATEGORY_ORDER.forEach(function (def) {
    feeContainer.appendChild(buildFeeCard(def));
  });

  /* ------------------------------------------------------------------ *
   * Batch rows
   * ------------------------------------------------------------------ */

  var batchBody = $('batch-rows');

  function buildBatchRow(b) {
    var tr = el('tr');
    var date = el('input', { type: 'date', 'aria-label': 'Batch date' });
    date.value = b.date || '';
    var labels = ['Batch number', 'Batch sales count', 'Batch sales amount',
      'Batch refund count', 'Batch refund amount'];
    var cells = [
      date,
      input('', b.number, 'Batch #'),
      input('num', b.salesCount, '0'),
      input('num', b.salesAmount, '0.00'),
      input('num', b.refundCount, '0'),
      input('num', b.refundAmount, '0.00')
    ];
    cells.forEach(function (c, i) {
      if (i > 0) c.setAttribute('aria-label', labels[i - 1]);
      tr.appendChild(el('td', {}, [c]));
    });
    tr.appendChild(el('td', { class: 'cell-net', text: '0.00' }));
    var rm = el('button', { type: 'button', class: 'btn-icon', title: 'Remove batch', 'aria-label': 'Remove batch', html: REMOVE_ICON });
    rm.addEventListener('click', function () {
      removeRow(tr, $('batch-add'));
    });
    tr.appendChild(el('td', {}, [rm]));
    return tr;
  }

  $('batch-add').addEventListener('click', function () {
    batchBody.appendChild(buildBatchRow({}));
    onChange();
    var first = batchBody.lastChild.querySelector('input');
    if (first) first.focus();
  });

  /* ------------------------------------------------------------------ *
   * Template switcher + style-2 (card processing) rows
   * ------------------------------------------------------------------ */

  // 'billing' stays a valid template so a previously-generated billing PDF can
  // still be imported and rendered, but it no longer has a segmented tab.
  var TEMPLATES = ['check', 'processing', 'bank', 'letter', 'billing'];
  function setTemplate(next, skipChange) {
    template = TEMPLATES.indexOf(next) >= 0 ? next : 'check';
    TEMPLATES.forEach(function (t) {
      document.body.classList.toggle('tpl-' + t, template === t);
      var seg = $('seg-' + t);
      if (seg) {
        seg.classList.toggle('active', template === t);
        seg.setAttribute('aria-selected', String(template === t));
      }
    });
    if (!skipChange) onChange();
  }
  $('seg-check').addEventListener('click', function () { setTemplate('check'); });
  $('seg-processing').addEventListener('click', function () { setTemplate('processing'); });
  $('seg-bank').addEventListener('click', function () { setTemplate('bank'); });
  $('seg-letter').addEventListener('click', function () { setTemplate('letter'); });

  var cardTypeBody = $('cardtype-rows');
  var fees2Body = $('fees2-rows');
  var thirdPartyBody = $('thirdparty-rows');
  var adjustmentsBody = $('adjustments-rows');
  var bkCreditBody = $('bk-credit-rows');
  var bkDebitBody = $('bk-debit-rows');
  var bkCheckBody = $('bk-check-rows');

  function buildCardTypeRow(c) {
    var tr = el('tr');
    var labels = ['Card type name', 'Card type items', 'Card type amount',
      'Card type refund items', 'Card type refund amount'];
    var cells = [
      input('', c.name, 'e.g. VISA'),
      input('num', c.items, '0'),
      input('num', c.amount, '0.00'),
      input('num', c.refundItems, '0'),
      input('num', c.refundAmount, '0.00')
    ];
    cells.forEach(function (cell, i) {
      cell.setAttribute('aria-label', labels[i]);
      tr.appendChild(el('td', {}, [cell]));
    });
    tr.appendChild(el('td', { class: 'cell-net', text: '—' }));
    var rm = el('button', { type: 'button', class: 'btn-icon', title: 'Remove card type', 'aria-label': 'Remove card type', html: REMOVE_ICON });
    rm.addEventListener('click', function () { removeRow(tr, $('cardtype-add')); });
    tr.appendChild(el('td', {}, [rm]));
    return tr;
  }

  function buildFees2Row(f) {
    var tr = el('tr');
    var group = input('', f.group, 'e.g. VISA');
    group.setAttribute('aria-label', 'Fee group');
    var type = el('select', { 'aria-label': 'Fee type' });
    ['CF', 'MISC'].forEach(function (t) {
      var o = el('option', { text: t });
      o.value = t;
      type.appendChild(o);
    });
    type.value = (f.type || 'CF').toUpperCase() === 'MISC' ? 'MISC' : 'CF';
    var desc = input('', f.description, 'e.g. DISC 1');
    desc.setAttribute('aria-label', 'Fee description');
    var volume = input('num', f.volume, '--');
    volume.setAttribute('aria-label', 'Fee volume');
    var rate = input('num', f.rate, '--');
    rate.setAttribute('aria-label', 'Fee rate');
    var total = input('num', f.total, 'auto');
    total.setAttribute('aria-label', 'Fee total');
    [group, type, desc, volume, rate, total].forEach(function (cell) {
      tr.appendChild(el('td', {}, [cell]));
    });

    var manual = hasText(f.total);
    function syncTotal() {
      if (manual) {
        total.classList.remove('is-derived');
        total.title = '';
        return;
      }
      var derived = StatementPDF2.resolveFeeTotal({ volume: volume.value, rate: rate.value, total: '' });
      total.value = derived === null ? '' : derived.toFixed(2);
      total.classList.toggle('is-derived', derived !== null);
      total.title = derived === null ? '' : 'Auto: −(Volume × Rate) — type to override, clear to re-enable';
    }
    [volume, rate].forEach(function (cell) { cell.addEventListener('input', syncTotal); });
    total.addEventListener('input', function () {
      manual = hasText(total.value);
      syncTotal();
    });
    syncTotal();

    var rm = el('button', { type: 'button', class: 'btn-icon', title: 'Remove fee', 'aria-label': 'Remove fee', html: REMOVE_ICON });
    rm.addEventListener('click', function () { removeRow(tr, $('fees2-add')); });
    tr.appendChild(el('td', {}, [rm]));
    return tr;
  }

  function buildSimpleRow(r, addBtnId, what) {
    var tr = el('tr');
    var date = el('input', { type: 'date', 'aria-label': what + ' date' });
    date.value = r.date || '';
    var desc = input('', r.description, 'Description');
    desc.setAttribute('aria-label', what + ' description');
    var amount = input('num', r.amount, '0.00');
    amount.setAttribute('aria-label', what + ' amount');
    [date, desc, amount].forEach(function (cell) { tr.appendChild(el('td', {}, [cell])); });
    var rm = el('button', { type: 'button', class: 'btn-icon', title: 'Remove row', 'aria-label': 'Remove ' + what, html: REMOVE_ICON });
    rm.addEventListener('click', function () { removeRow(tr, $(addBtnId)); });
    tr.appendChild(el('td', {}, [rm]));
    return tr;
  }

  $('cardtype-add').addEventListener('click', function () {
    cardTypeBody.appendChild(buildCardTypeRow({}));
    onChange();
    cardTypeBody.lastChild.querySelector('input').focus();
  });
  $('fees2-add').addEventListener('click', function () {
    fees2Body.appendChild(buildFees2Row({}));
    onChange();
    fees2Body.lastChild.querySelector('input').focus();
  });
  $('thirdparty-add').addEventListener('click', function () {
    thirdPartyBody.appendChild(buildSimpleRow({}, 'thirdparty-add', 'Third party transaction'));
    onChange();
  });
  $('adjustments-add').addEventListener('click', function () {
    adjustmentsBody.appendChild(buildSimpleRow({}, 'adjustments-add', 'Adjustment'));
    onChange();
  });

  // Bank transaction rows (deposits/credits & withdrawals/debits share a shape)
  function buildBankTxRow(r, addBtnId, what) {
    var tr = el('tr');
    var date = el('input', { type: 'date', 'aria-label': what + ' date' });
    date.value = r.date || '';
    var desc = input('', r.description, 'Description');
    desc.setAttribute('aria-label', what + ' description');
    var amount = input('num', r.amount, '0.00');
    amount.setAttribute('aria-label', what + ' amount');
    [date, desc, amount].forEach(function (cell) { tr.appendChild(el('td', {}, [cell])); });
    var rm = el('button', { type: 'button', class: 'btn-icon', title: 'Remove row', 'aria-label': 'Remove ' + what, html: REMOVE_ICON });
    rm.addEventListener('click', function () { removeRow(tr, $(addBtnId)); });
    tr.appendChild(el('td', {}, [rm]));
    return tr;
  }

  function buildBankCheckRow(r) {
    var tr = el('tr');
    var date = el('input', { type: 'date', 'aria-label': 'Check date' });
    date.value = r.date || '';
    var num = input('', r.number, 'Check #');
    num.setAttribute('aria-label', 'Check number');
    var amount = input('num', r.amount, '0.00');
    amount.setAttribute('aria-label', 'Check amount');
    [date, num, amount].forEach(function (cell) { tr.appendChild(el('td', {}, [cell])); });
    var rm = el('button', { type: 'button', class: 'btn-icon', title: 'Remove check', 'aria-label': 'Remove check', html: REMOVE_ICON });
    rm.addEventListener('click', function () { removeRow(tr, $('bk-check-add')); });
    tr.appendChild(el('td', {}, [rm]));
    return tr;
  }

  function addBankRow(body, row, focusFirst) {
    body.appendChild(row);
    onChange();
    if (focusFirst) { var f = body.lastChild.querySelector('input'); if (f) f.focus(); }
  }
  $('bk-credit-add').addEventListener('click', function () {
    addBankRow(bkCreditBody, buildBankTxRow({}, 'bk-credit-add', 'Credit'), true);
  });
  $('bk-debit-add').addEventListener('click', function () {
    addBankRow(bkDebitBody, buildBankTxRow({}, 'bk-debit-add', 'Debit'), true);
  });
  $('bk-check-add').addEventListener('click', function () {
    addBankRow(bkCheckBody, buildBankCheckRow({}), true);
  });

  // Re-distribute card-type amounts proportionally so they sum to `total`.
  function distributeCardTypes(total) {
    var rows = Array.prototype.slice.call(cardTypeBody.querySelectorAll('tr'));
    if (!rows.length || !(total > 0)) return;
    var weights = rows.map(function (tr) {
      var v = tr.querySelectorAll('input');
      return Math.max(fmt.toNum(v[2].value), 0);
    });
    var wSum = weights.reduce(function (a, b) { return a + b; }, 0);
    if (wSum <= 0) weights = rows.map(function () { return 1; });
    wSum = weights.reduce(function (a, b) { return a + b; }, 0);
    var cents = Math.round(total * 100);
    var allocated = 0;
    rows.forEach(function (tr, i) {
      var v = tr.querySelectorAll('input');
      var share = i === rows.length - 1
        ? cents - allocated
        : Math.round(cents * weights[i] / wSum);
      allocated += share;
      var oldAmount = fmt.toNum(v[2].value);
      var oldItems = Math.max(1, Math.round(fmt.toNum(v[1].value)));
      var avgTicket = oldAmount > 0 ? oldAmount / oldItems : 85;
      v[2].value = (share / 100).toFixed(2);
      v[1].value = String(Math.max(1, Math.round((share / 100) / avgTicket)));
    });
  }

  // Total dollar volume currently entered across the card-type rows — the
  // basis the processing fees are computed against.
  function sumCardVolumes() {
    var total = 0;
    cardTypeBody.querySelectorAll('tr').forEach(function (tr) {
      total += fmt.toNum(tr.querySelectorAll('input')[2].value);
    });
    return total;
  }

  // Net submitted volume across the batch rows — a fallback fee basis for
  // statements that carry no card-type breakdown.
  function sumBatchVolumes() {
    var total = 0;
    batchBody.querySelectorAll('tr').forEach(function (tr) {
      var v = tr.querySelectorAll('input');
      total += fmt.toNum(v[3].value) - fmt.toNum(v[5].value);
    });
    return total;
  }

  // Sum of the Transaction-category line-item volumes — the billing sales basis.
  function sumTransactionVolumes() {
    var total = 0;
    var body = feeContainer.querySelector('.fee-cat[data-key="transaction"] tbody');
    if (body) {
      body.querySelectorAll('tr').forEach(function (tr) {
        total += fmt.toNum(tr.querySelectorAll('input')[2].value);
      });
    }
    return total;
  }

  // When the monthly volume changes, scale the volume-proportional processing
  // fees by the same factor so they track the new volume.
  //   - auto-derived rows (blank total): scale the volume, then re-derive
  //   - imported rows with an explicit total: scale only when the total is
  //     genuinely volume-proportional (total ≈ volume × rate), so per-item /
  //     percentage fees scale while flat per-event fees (e.g. a $25 chargeback
  //     or PCI fee, whose total ≠ volume × rate) are left untouched
  function scaleProcessingFees(factor) {
    if (!(factor > 0) || !isFinite(factor) || Math.abs(factor - 1) < 1e-9) return;
    fees2Body.querySelectorAll('tr').forEach(function (tr) {
      var v = tr.querySelectorAll('input'); // group, desc, volume, rate, total
      var vol = fmt.toNum(v[2].value);
      if (vol === 0) return;
      if (v[4].classList.contains('is-derived')) {
        v[2].value = (vol * factor).toFixed(2);
        v[2].dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      // An explicit-total fee scales when it is volume-proportional: its total
      // is a small fraction of its volume (a real discount / per-item rate, well
      // under 100%). A flat per-event fee whose total is on the order of its
      // volume (e.g. a $25 chargeback fee against a $25 item) is left alone.
      var total = fmt.toNum(v[4].value);
      if (total !== 0 && Math.abs(total) < 0.5 * Math.abs(vol)) {
        v[2].value = (vol * factor).toFixed(2);
        v[4].value = (total * factor).toFixed(2);
      }
    });
  }

  // Billing analogue: scale the percentage-based line items (those with a Rate,
  // whose amount is Volume × Rate) so both the sales breakdown and the fees they
  // drive track the new monthly volume. Per-item fees (Fee × Count) and flat
  // monthly charges have no Rate and are left untouched, so they never inflate.
  function scaleBillingVolumes(factor) {
    if (!(factor > 0) || !isFinite(factor) || Math.abs(factor - 1) < 1e-9) return;
    feeContainer.querySelectorAll('.fee-cat tbody tr').forEach(function (tr) {
      var v = tr.querySelectorAll('input'); // desc, count, volume, rate, fee, amount
      if (!hasText(v[3].value)) return;      // only rate-based (volume-proportional) rows
      var vol = fmt.toNum(v[2].value);
      if (vol !== 0) {
        v[2].value = (vol * factor).toFixed(2);
        v[2].dispatchEvent(new Event('input', { bubbles: true })); // re-derive if auto
      }
      // an imported amount is pinned (manual); scale it by the same factor so it
      // stays in step with its now-scaled volume
      if (!v[5].classList.contains('is-derived')) {
        var amt = fmt.toNum(v[5].value);
        if (amt !== 0) v[5].value = fmt.amount(amt * factor);
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Statement month + auto-generated daily batches
   * ------------------------------------------------------------------ */

  var monthSel = $('month-select');   // hidden state holders (persisted)
  var yearInput = $('year-input');
  var volumeInput = $('monthly-volume');
  var monthNote = $('month-note');
  var rerollBtn = $('btn-reroll');
  var volumeDebounce = null;

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  function pad2(n) { return String(n).padStart(2, '0'); }

  function selectedYear() {
    var y = Math.round(fmt.toNum(yearInput.value));
    return (y >= 2000 && y <= 2100) ? y : new Date().getFullYear();
  }

  function selectedMonth() {
    var m = Math.round(Number(monthSel.value));
    return (m >= 0 && m <= 11) ? m : new Date().getMonth();
  }

  function daysInMonth(year, monthIdx) {
    return new Date(year, monthIdx + 1, 0).getDate();
  }

  // Point the billing period at the selected month.
  function syncPeriodFromMonth() {
    var year = selectedYear();
    var m = selectedMonth();
    $('period-start').value = year + '-' + pad2(m + 1) + '-01';
    $('period-end').value = year + '-' + pad2(m + 1) + '-' + pad2(daysInMonth(year, m));
    return true;
  }

  // Split `cents` across `days` random weights hovering around the daily
  // average; the rounded 2-decimal amounts always sum exactly to the total.
  function splitVolume(cents, days) {
    var weights = [];
    var sum = 0;
    for (var i = 0; i < days; i++) {
      var w = 0.6 + Math.random() * 0.8;
      weights.push(w);
      sum += w;
    }
    var amounts = weights.map(function (w) {
      return Math.max(1, Math.round(cents * w / sum));
    });
    var residual = cents - amounts.reduce(function (a, b) { return a + b; }, 0);
    var guard = 0;
    while (residual !== 0 && guard < 1000000) {
      var step = residual > 0 ? 1 : -1;
      var j = guard % days;
      if (amounts[j] + step >= 1) {
        amounts[j] += step;
        residual -= step;
      }
      guard++;
    }
    return amounts;
  }

  function collectBatchRows() {
    var out = [];
    batchBody.querySelectorAll('tr').forEach(function (tr) {
      var v = tr.querySelectorAll('input');
      out.push({
        date: v[0].value, number: v[1].value,
        salesCount: v[2].value, salesAmount: v[3].value,
        refundCount: v[4].value, refundAmount: v[5].value
      });
    });
    return out;
  }

  function batchRowsCarryData(rows) {
    return rows.some(function (b) {
      return fmt.toNum(b.salesAmount) !== 0 || fmt.toNum(b.refundAmount) !== 0;
    });
  }

  // Rebuild the batch table for the chosen month:
  //  - a total volume set -> one batch per day, randomized to the exact total
  //  - existing rows with real figures (e.g. an imported statement) -> keep
  //    every figure and re-date the rows into the chosen month
  //  - otherwise -> one zeroed row per day, ready to fill
  function regenerateBatches() {
    var year = selectedYear();
    var m = selectedMonth();
    var total = fmt.toNum(volumeInput.value);
    var days = daysInMonth(year, m);
    var existing = collectBatchRows();

    if (!(total > 0) && batchRowsCarryData(existing)) {
      batchBody.innerHTML = '';
      existing.forEach(function (b, idx) {
        var dm = /^\d{4}-\d{2}-(\d{2})$/.exec(b.date || '');
        var day = Math.min(dm ? Number(dm[1]) : idx + 1, days);
        b.date = year + '-' + pad2(m + 1) + '-' + pad2(Math.max(1, day));
        batchBody.appendChild(buildBatchRow(b));
      });
      return true;
    }

    var amounts = total > 0 ? splitVolume(Math.round(total * 100), days) : null;
    var avgTicket = 35 + Math.random() * 45; // plausible average sale size
    var prefix = String(100000 + Math.floor(Math.random() * 900000));
    batchBody.innerHTML = '';
    for (var d = 0; d < days; d++) {
      var amount = amounts ? amounts[d] / 100 : 0;
      batchBody.appendChild(buildBatchRow({
        date: year + '-' + pad2(m + 1) + '-' + pad2(d + 1),
        number: prefix + pad2(d + 1) + String(d + 1).padStart(4, '0'),
        salesCount: amounts ? String(Math.max(1, Math.round(amount / avgTicket))) : '0',
        salesAmount: amount.toFixed(2),
        refundCount: '0',
        refundAmount: '0.00'
      }));
    }
    return true;
  }

  function updateMonthNote() {
    var year = selectedYear();
    var m = selectedMonth();
    var days = daysInMonth(year, m);
    var total = fmt.toNum(volumeInput.value);
    if (total > 0) {
      monthNote.textContent = days + ' daily batches · $' + fmt.money(total) +
        ' across ' + MONTH_NAMES[m] + ' ' + year;
      rerollBtn.hidden = false;
    } else if (batchRowsCarryData(collectBatchRows())) {
      monthNote.textContent = 'Batches dated to ' + MONTH_NAMES[m] + ' ' + year +
        ' — amounts kept. Enter a total volume to re-randomize.';
      rerollBtn.hidden = true;
    } else {
      monthNote.textContent = days + ' day rows for ' + MONTH_NAMES[m] + ' ' + year +
        ' — enter a total volume to fill the amounts.';
      rerollBtn.hidden = true;
    }
  }

  function applyMonth() {
    syncPeriodFromMonth();
    // The batch / volume machinery is merchant-only; the bank statement just
    // takes the period from the picker (its transactions are entered by hand).
    if (template !== 'bank') {
      // Suppress the per-input preview rebuild while we mutate many fields; the
      // single onChange() at the end regenerates the preview once from the
      // finished state (fee-scaling dispatches input events that would
      // otherwise trigger a storm of intermediate rebuilds).
      suppressChange = true;
      try {
        var newVol = fmt.toNum(volumeInput.value);
        if (template === 'processing') {
          // Card volumes are the basis the fees are computed against; capture it
          // before redistributing so fees scale by the same factor and stay in
          // step with the new monthly volume. Fall back to the batch volume when
          // a statement carries no card-type breakdown.
          var oldBasis = sumCardVolumes() || sumBatchVolumes();
          regenerateBatches();
          distributeCardTypes(newVol);
          if (newVol > 0 && oldBasis > 0) scaleProcessingFees(newVol / oldBasis);
        } else {
          var oldSales = sumTransactionVolumes();
          regenerateBatches();
          if (newVol > 0 && oldSales > 0) scaleBillingVolumes(newVol / oldSales);
        }
      } finally {
        suppressChange = false;
      }
    }
    renderPickerLabel();
    updateMonthNote();
    onChange();
  }

  function setMonth(m, y) {
    monthSel.value = String(m);
    yearInput.value = String(y);
    applyMonth();
  }

  volumeInput.addEventListener('input', function () {
    clearTimeout(volumeDebounce);
    volumeDebounce = setTimeout(applyMonth, 600);
  });
  rerollBtn.addEventListener('click', applyMonth);

  /* --- the stepper + popover control ---------------------------------- */

  var mpLabelText = $('mp-label-text');
  var mpLabel = $('mp-label');
  var mpPop = $('mp-pop');
  var mpYearLabel = $('mp-year');
  var mpGrid = $('mp-grid');
  var popYear = null;

  function renderPickerLabel() {
    mpLabelText.textContent = MONTH_NAMES[selectedMonth()] + ' ' + selectedYear();
  }

  MONTH_NAMES.forEach(function (name, idx) {
    var b = el('button', {
      type: 'button',
      class: 'mp-month',
      text: name.slice(0, 3),
      'aria-label': name
    });
    b.addEventListener('click', function () {
      setMonth(idx, popYear);
      closePop();
      mpLabel.focus();
    });
    mpGrid.appendChild(b);
  });

  function renderPop() {
    mpYearLabel.textContent = String(popYear);
    mpGrid.querySelectorAll('.mp-month').forEach(function (b, idx) {
      b.classList.toggle('selected',
        popYear === selectedYear() && idx === selectedMonth());
    });
  }

  function openPop() {
    popYear = selectedYear();
    renderPop();
    mpPop.hidden = false;
    mpLabel.setAttribute('aria-expanded', 'true');
  }

  function closePop() {
    mpPop.hidden = true;
    mpLabel.setAttribute('aria-expanded', 'false');
  }

  mpLabel.addEventListener('click', function () {
    if (mpPop.hidden) openPop(); else closePop();
  });
  $('mp-year-prev').addEventListener('click', function () { popYear--; renderPop(); });
  $('mp-year-next').addEventListener('click', function () { popYear++; renderPop(); });
  $('mp-prev').addEventListener('click', function () {
    var m = selectedMonth() - 1;
    setMonth(m < 0 ? 11 : m, m < 0 ? selectedYear() - 1 : selectedYear());
  });
  $('mp-next').addEventListener('click', function () {
    var m = selectedMonth() + 1;
    setMonth(m > 11 ? 0 : m, m > 11 ? selectedYear() + 1 : selectedYear());
  });
  document.addEventListener('click', function (e) {
    if (!mpPop.hidden && !e.target.closest('.month-picker')) closePop();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !mpPop.hidden) {
      closePop();
      mpLabel.focus();
    }
  });

  /* ------------------------------------------------------------------ *
   * Logo upload
   * ------------------------------------------------------------------ */

  var logoDataUrl = null;
  var logoDrop = $('logo-drop');
  var logoInput = $('logo-input');

  logoDrop.addEventListener('click', function (e) {
    if (e.target.id === 'logo-remove') return;
    logoInput.click();
  });
  logoDrop.addEventListener('keydown', function (e) {
    if (e.target !== logoDrop) return; // e.g. the Remove button handles itself
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      logoInput.click();
    }
  });
  ['dragover', 'dragenter'].forEach(function (evt) {
    logoDrop.addEventListener(evt, function (e) {
      e.preventDefault();
      logoDrop.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    logoDrop.addEventListener(evt, function (e) {
      e.preventDefault();
      logoDrop.classList.remove('dragover');
    });
  });
  logoDrop.addEventListener('drop', function (e) {
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) acceptLogoFile(file);
  });
  logoInput.addEventListener('change', function () {
    if (logoInput.files && logoInput.files[0]) acceptLogoFile(logoInput.files[0]);
    logoInput.value = '';
  });
  $('logo-remove').addEventListener('click', function () {
    setLogo(null);
    onChange();
  });

  var logoErrorTimer = null;
  function logoError(msg) {
    var note = $('logo-error');
    note.textContent = msg;
    note.hidden = false;
    clearTimeout(logoErrorTimer);
    logoErrorTimer = setTimeout(function () { note.hidden = true; }, 5000);
  }

  // Normalize any browser-supported image to PNG via canvas, downscaled to
  // a size comfortably above the cover logo box's print resolution.
  function acceptLogoFile(file) {
    if (!/^image\//.test(file.type)) {
      logoError('Please choose an image file (PNG, JPEG, SVG or WebP).');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var MAX_W = 1400, MAX_H = 560;
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) { logoError('That image could not be read.'); return; }
        var scale = Math.min(1, MAX_W / w, MAX_H / h);
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setLogo(canvas.toDataURL('image/png'));
        onChange();
      };
      img.onerror = function () { logoError('That image could not be read.'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function setLogo(dataUrl) {
    logoDataUrl = dataUrl;
    $('logo-empty').hidden = !!dataUrl;
    $('logo-preview').hidden = !dataUrl;
    if (dataUrl) $('logo-img').src = dataUrl;
    // The logo persists under its own key so a quota failure here never
    // takes down form-data persistence.
    try {
      if (dataUrl) localStorage.setItem(LOGO_KEY, dataUrl);
      else localStorage.removeItem(LOGO_KEY);
    } catch (e) {
      logoError('The logo is too large to remember between visits, but it will be used for this session.');
    }
  }

  /* ------------------------------------------------------------------ *
   * Form <-> data
   * ------------------------------------------------------------------ */

  function lines(textareaValue) {
    return String(textareaValue).split('\n')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function collectData() {
    var categories = {};
    feeContainer.querySelectorAll('.fee-cat').forEach(function (card) {
      var items = [];
      card.querySelectorAll('tbody tr').forEach(function (tr) {
        var v = tr.querySelectorAll('input');
        items.push({
          description: v[0].value,
          count: v[1].value,
          volume: v[2].value,
          rate: v[3].value,
          fee: v[4].value,
          // Derived amounts stay empty in the data — the engine re-derives
          // them, so rows keep auto-calculating after a reload.
          amount: v[5].classList.contains('is-derived') ? '' : v[5].value
        });
      });
      categories[card.getAttribute('data-key')] = {
        included: card.querySelector('.fee-cat-head input[type=checkbox]').checked,
        items: items
      };
    });

    var batches = [];
    batchBody.querySelectorAll('tr').forEach(function (tr) {
      var v = tr.querySelectorAll('input');
      batches.push({
        date: v[0].value,
        number: v[1].value,
        salesCount: v[2].value,
        salesAmount: v[3].value,
        refundCount: v[4].value,
        refundAmount: v[5].value
      });
    });

    var cardTypes = [];
    cardTypeBody.querySelectorAll('tr').forEach(function (tr) {
      var v = tr.querySelectorAll('input');
      cardTypes.push({ name: v[0].value, items: v[1].value, amount: v[2].value,
        refundItems: v[3].value, refundAmount: v[4].value });
    });
    var fees2 = [];
    fees2Body.querySelectorAll('tr').forEach(function (tr) {
      var v = tr.querySelectorAll('input'); // group, desc, volume, rate, total
      fees2.push({
        group: v[0].value,
        type: tr.querySelector('select').value,
        description: v[1].value,
        volume: v[2].value,
        rate: v[3].value,
        total: v[4].classList.contains('is-derived') ? '' : v[4].value
      });
    });
    function simpleRows(tbody) {
      var out = [];
      tbody.querySelectorAll('tr').forEach(function (tr) {
        var v = tr.querySelectorAll('input');
        out.push({ date: v[0].value, description: v[1].value, amount: v[2].value });
      });
      return out;
    }
    function bankCheckRows() {
      var out = [];
      bkCheckBody.querySelectorAll('tr').forEach(function (tr) {
        var v = tr.querySelectorAll('input');
        out.push({ date: v[0].value, number: v[1].value, amount: v[2].value });
      });
      return out;
    }

    return {
      template: template,
      check: {
        payerName: $('chk-payer-name').value.trim(),
        payerAddress: lines($('chk-payer-address').value),
        bankName: $('chk-bank-name').value.trim(),
        checkNumber: $('chk-check-number').value.trim(),
        fraction: $('chk-fraction').value.trim(),
        date: $('chk-date').value,
        payTo: $('chk-pay-to').value.trim(),
        amount: $('chk-amount').value,
        memo: $('chk-memo').value.trim(),
        routingNumber: $('chk-routing').value.trim(),
        accountNumber: $('chk-account').value.trim(),
        voided: $('chk-void').checked,
        logo: checkLogoUrl
      },
      letter: {
        bankName: $('lt-bank-name').value.trim(),
        bankAddress: $('lt-bank-address').value.trim(),
        bankPhone: $('lt-bank-phone').value.trim(),
        date: $('lt-date').value,
        salutation: $('lt-salutation').value.trim(),
        holderName: $('lt-holder-name').value.trim(),
        accountLabel: $('lt-account-label').value.trim(),
        accountType: $('lt-account-type').value.trim(),
        holderAddress1: $('lt-holder-address1').value.trim(),
        holderAddress2: $('lt-holder-address2').value.trim(),
        sinceYear: $('lt-since-year').value.trim(),
        balance: $('lt-balance').value,
        thirdParty: $('lt-third-party').value.trim(),
        authAction: $('lt-auth-action').value.trim(),
        accountNumber: $('lt-account-number').value.trim(),
        routingNumber: $('lt-routing-number').value.trim(),
        signerName: $('lt-signer-name').value.trim(),
        signerTitle: $('lt-signer-title').value.trim(),
        contactPhone: $('lt-contact-phone').value.trim()
      },
      bank: {
        bankName: $('bk-name').value.trim(),
        accountType: $('bk-account-type').value.trim(),
        accountNumber: $('bk-account-number').value.trim(),
        bankPhone: $('bk-phone').value.trim(),
        bankAddress: lines($('bk-address').value),
        bankWebsite: $('bk-website').value.trim(),
        holderName: $('bk-holder-name').value.trim(),
        holderAddress: lines($('bk-holder-address').value),
        beginningBalance: $('bk-beginning').value,
        fees: $('bk-fees').value,
        credits: simpleRows(bkCreditBody),
        debits: simpleRows(bkDebitBody),
        checks: bankCheckRows()
      },
      style2: {
        processorLine: $('p-processor-line').value.trim(),
        addressee: lines($('p-addressee').value),
        location: lines($('p-location').value),
        merchantNumber: $('p-merchant-number').value.trim(),
        customerService: $('p-customer-service').value.trim(),
        statementSeq: $('p-seq').value.trim(),
        tinLabel: $('p-tin').value.trim(),
        ytdReportable: $('p-ytd').value,
        importantInfo: $('p-important').value,
        cardTypes: cardTypes,
        fees: fees2,
        thirdParty: simpleRows(thirdPartyBody),
        adjustments: simpleRows(adjustmentsBody)
      },
      remitAddress: lines($('remit-address').value),
      coverNotice: $('cover-notice').value.trim(),
      notices: $('notices').value,
      billTo: lines($('bill-to').value),
      details: {
        statementNumber: $('d-statement-number').value.trim(),
        issueDate: $('d-issue-date').value.trim(),
        paymentTerms: $('d-payment-terms').value.trim(),
        billingId: $('d-billing-id').value.trim(),
        billingAccountNumber: $('d-billing-account').value.trim(),
        productId: $('d-product-id').value.trim()
      },
      periodStart: $('period-start').value,
      periodEnd: $('period-end').value,
      statementMonth: {
        month: monthSel.value,
        year: yearInput.value,
        volume: volumeInput.value
      },
      totalSales: $('total-sales').value,
      transactionCount: $('transaction-count').value,
      summaryAuto: $('summary-auto').checked,
      currency: $('currency').value.trim() || 'USD',
      taxRate: $('tax-rate').value,
      feesCollected: $('fees-collected').value,
      categories: categories,
      batches: batches
    };
  }

  function applyData(data) {
    setTemplate(data.template, true);
    var bk = data.bank || SAMPLE.bank;
    $('bk-name').value = bk.bankName || '';
    $('bk-account-type').value = bk.accountType || '';
    $('bk-account-number').value = bk.accountNumber || '';
    $('bk-phone').value = bk.bankPhone || '';
    $('bk-address').value = (bk.bankAddress || []).join('\n');
    $('bk-website').value = bk.bankWebsite || '';
    $('bk-holder-name').value = bk.holderName || '';
    $('bk-holder-address').value = (bk.holderAddress || []).join('\n');
    $('bk-beginning').value = bk.beginningBalance || '';
    $('bk-fees').value = bk.fees || '';
    bkCreditBody.innerHTML = '';
    (bk.credits || []).forEach(function (r) {
      bkCreditBody.appendChild(buildBankTxRow(r, 'bk-credit-add', 'Credit'));
    });
    bkDebitBody.innerHTML = '';
    (bk.debits || []).forEach(function (r) {
      bkDebitBody.appendChild(buildBankTxRow(r, 'bk-debit-add', 'Debit'));
    });
    bkCheckBody.innerHTML = '';
    (bk.checks || []).forEach(function (r) {
      bkCheckBody.appendChild(buildBankCheckRow(r));
    });

    var ck = data.check || SAMPLE.check;
    $('chk-payer-name').value = ck.payerName || '';
    $('chk-payer-address').value = (ck.payerAddress || []).join('\n');
    $('chk-bank-name').value = ck.bankName || '';
    $('chk-check-number').value = ck.checkNumber || '';
    $('chk-fraction').value = ck.fraction || '';
    $('chk-date').value = ck.date || '';
    $('chk-pay-to').value = ck.payTo || '';
    $('chk-amount').value = ck.amount || '';
    // Drop the retired default memo wherever it comes from (including data
    // persisted before it was removed) so it never repopulates the FOR line.
    $('chk-memo').value = /^direct deposit\s*\/\s*ach setup$/i.test((ck.memo || '').trim())
      ? '' : (ck.memo || '');
    $('chk-routing').value = ck.routingNumber || '';
    $('chk-account').value = ck.accountNumber || '';
    $('chk-void').checked = ck.voided !== false;
    checkLogoUrl = ck.logo || null;

    var lt = data.letter || SAMPLE.letter;
    $('lt-bank-name').value = lt.bankName || '';
    $('lt-bank-address').value = lt.bankAddress || '';
    $('lt-bank-phone').value = lt.bankPhone || '';
    $('lt-date').value = lt.date || '';
    $('lt-salutation').value = lt.salutation || '';
    $('lt-holder-name').value = lt.holderName || '';
    $('lt-account-label').value = lt.accountLabel || '';
    $('lt-account-type').value = lt.accountType || '';
    $('lt-holder-address1').value = lt.holderAddress1 || '';
    $('lt-holder-address2').value = lt.holderAddress2 || '';
    $('lt-since-year').value = lt.sinceYear || '';
    $('lt-balance').value = lt.balance || '';
    $('lt-third-party').value = lt.thirdParty || '';
    $('lt-auth-action').value = lt.authAction || '';
    $('lt-account-number').value = lt.accountNumber || '';
    $('lt-routing-number').value = lt.routingNumber || '';
    $('lt-signer-name').value = lt.signerName || '';
    $('lt-signer-title').value = lt.signerTitle || '';
    $('lt-contact-phone').value = lt.contactPhone || '';

    var s2 = data.style2 || SAMPLE.style2;
    $('p-processor-line').value = s2.processorLine || '';
    $('p-addressee').value = (s2.addressee || []).join('\n');
    $('p-location').value = (s2.location || []).join('\n');
    $('p-merchant-number').value = s2.merchantNumber || '';
    $('p-customer-service').value = s2.customerService || '';
    $('p-seq').value = s2.statementSeq ||
      String(100000 + Math.floor(Math.random() * 900000));
    $('p-tin').value = s2.tinLabel || '';
    $('p-ytd').value = s2.ytdReportable || '';
    $('p-important').value = s2.importantInfo || '';
    cardTypeBody.innerHTML = '';
    (s2.cardTypes || []).forEach(function (c) {
      cardTypeBody.appendChild(buildCardTypeRow(c));
    });
    fees2Body.innerHTML = '';
    (s2.fees || []).forEach(function (f) {
      fees2Body.appendChild(buildFees2Row(f));
    });
    thirdPartyBody.innerHTML = '';
    (s2.thirdParty || []).forEach(function (r) {
      thirdPartyBody.appendChild(buildSimpleRow(r, 'thirdparty-add', 'Third party transaction'));
    });
    adjustmentsBody.innerHTML = '';
    (s2.adjustments || []).forEach(function (r) {
      adjustmentsBody.appendChild(buildSimpleRow(r, 'adjustments-add', 'Adjustment'));
    });

    $('remit-address').value = (data.remitAddress || []).join('\n');
    $('cover-notice').value = data.coverNotice || '';
    $('notices').value = data.notices || '';
    $('bill-to').value = (data.billTo || []).join('\n');
    var d = data.details || {};
    $('d-statement-number').value = d.statementNumber || '';
    $('d-issue-date').value = d.issueDate || '';
    $('d-payment-terms').value = d.paymentTerms || '';
    $('d-billing-id').value = d.billingId || '';
    $('d-billing-account').value = d.billingAccountNumber || '';
    $('d-product-id').value = d.productId || '';
    $('period-start').value = data.periodStart || '';
    $('period-end').value = data.periodEnd || '';
    var sm = data.statementMonth || {};
    var periodMatch = /^(\d{4})-(\d{2})-\d{2}$/.exec(data.periodStart || '');
    monthSel.value = hasText(sm.month) ? sm.month
      : (periodMatch ? String(Number(periodMatch[2]) - 1) : monthSel.value);
    yearInput.value = hasText(sm.year) ? sm.year
      : (periodMatch ? periodMatch[1] : String(new Date().getFullYear()));
    volumeInput.value = sm.volume || '';
    renderPickerLabel();
    $('total-sales').value = data.totalSales || '';
    $('transaction-count').value = data.transactionCount || '';
    $('summary-auto').checked = data.summaryAuto !== false;
    $('currency').value = data.currency || 'USD';
    $('tax-rate').value = data.taxRate || '0';
    $('fees-collected').value = data.feesCollected || '';

    feeContainer.querySelectorAll('.fee-cat').forEach(function (card) {
      var key = card.getAttribute('data-key');
      var def = StatementPDF.CATEGORY_ORDER.filter(function (d) { return d.key === key; })[0];
      var cat = (data.categories || {})[key] || { included: true, items: [] };
      var toggle = card.querySelector('.fee-cat-head input[type=checkbox]');
      toggle.checked = cat.included !== false;
      card.classList.toggle('off', !toggle.checked);
      var tbody = card.querySelector('tbody');
      tbody.innerHTML = '';
      (cat.items || []).forEach(function (item) {
        tbody.appendChild(buildFeeRow(item, def ? def.name : ''));
      });
    });

    batchBody.innerHTML = '';
    (data.batches || []).forEach(function (b) {
      batchBody.appendChild(buildBatchRow(b));
    });
    // after the batch rows exist, so the note reflects the applied data
    updateMonthNote();
  }

  /* ------------------------------------------------------------------ *
   * Live readouts + preview
   * ------------------------------------------------------------------ */

  var statusEl = $('preview-status');
  var frame = $('preview-frame');
  var currentUrl = null;
  var currentBytes = null;
  var debounceTimer = null;
  var genChain = Promise.resolve();

  // Some browsers (notably iOS Safari) cannot display PDFs inline; give
  // them an "Open PDF" fallback instead of a dead frame.
  var pdfInline = typeof navigator.pdfViewerEnabled === 'boolean'
    ? navigator.pdfViewerEnabled
    : !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!pdfInline) {
    frame.hidden = true;
    $('preview-fallback').hidden = false;
    $('preview-open').addEventListener('click', function () {
      if (currentUrl) window.open(currentUrl, '_blank');
    });
  }

  function refreshReadouts(data, totals) {
    // per-category totals
    feeContainer.querySelectorAll('.fee-cat').forEach(function (card) {
      var key = card.getAttribute('data-key');
      var cat = totals.categories.filter(function (c) { return c.key === key; })[0];
      card.querySelector('.fee-cat-total').innerHTML =
        'Total <strong>' + fmt.amount(cat ? cat.total : 0) + '</strong>';
    });
    // batch nets — computed from each row's own inputs so the readout stays
    // aligned even for rows computeTotals filters out
    batchBody.querySelectorAll('tr').forEach(function (tr) {
      var v = tr.querySelectorAll('input');
      var net = tr.querySelector('.cell-net');
      if (net) net.textContent = fmt.amount(fmt.toNum(v[3].value) - fmt.toNum(v[5].value));
    });
    // summary auto values
    if (data.summaryAuto) {
      $('total-sales').value = fmt.amount(totals.autoTotalSales);
      $('transaction-count').value = fmt.int(totals.autoTransactionCount);
    }
    var autoTitle = 'Calculated from the batch details (or the Transaction Fees items when there are no batches) — turn off “Calculate automatically” to edit';
    [$('total-sales'), $('transaction-count')].forEach(function (field) {
      field.readOnly = data.summaryAuto;
      field.classList.toggle('is-auto', data.summaryAuto);
      field.title = data.summaryAuto ? autoTitle : '';
    });
    // totals readout
    $('ro-subtotal').textContent = fmt.currency(totals.subtotal);
    $('ro-tax').textContent = fmt.currency(totals.tax);
    $('ro-collected').textContent = totals.showCollected
      ? fmt.currency(-totals.feesCollected) : '$0.00';
    $('ro-due').textContent = fmt.currency(totals.amountDue);
    $('preview-filename').textContent = filenameFor(data);

    // style-2 readouts
    var t2 = StatementPDF2.computeTotals(data.style2);
    cardTypeBody.querySelectorAll('tr').forEach(function (tr) {
      var v = tr.querySelectorAll('input');
      var items = Math.round(fmt.toNum(v[1].value));
      var amount = fmt.toNum(v[2].value);
      var cell = tr.querySelector('.cell-net');
      if (cell) cell.textContent = items > 0 ? '$' + fmt.money(amount / items) : '—';
    });
    $('cardtype-total').innerHTML = 'Submitted <strong>$' +
      fmt.money(t2.cardTotal.net) + '</strong>';
    $('fees2-total').innerHTML = 'Fees <strong>' + StatementPDF2.format.usd(t2.feesTotal) +
      '</strong> · Funded <strong>' + StatementPDF2.format.usd(t2.fundedTotal) + '</strong>';

    // bank readouts
    var t3 = StatementBank.computeTotals(data.bank);
    var u3 = StatementBank.format.usd;
    $('bk-ro-credits').textContent = u3(t3.creditsTotal);
    $('bk-ro-debits').textContent = u3(t3.debitsTotal);
    $('bk-ro-checks').textContent = u3(t3.checksTotal);
    $('bk-ro-ending').textContent = u3(t3.ending);
  }

  function filenameFor(data) {
    var acct;
    if (data.template === 'check') {
      var ck = data.check || {};
      var nm = (ck.payerName || 'Voided_Check').replace(/[^\w-]+/g, '_')
        .replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Check';
      var cn = String(ck.checkNumber || '').replace(/[^\w]/g, '');
      return 'Voided_Check_' + nm + (cn ? '_' + cn : '') + '.pdf';
    }
    if (data.template === 'letter') {
      var lt = data.letter || {};
      var ln = (lt.holderName || 'Bank_Letter').replace(/[^\w-]+/g, '_')
        .replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Bank_Letter';
      return 'Bank_Letter_' + ln + '.pdf';
    }
    if (data.template === 'bank') {
      acct = ((data.bank.accountNumber || 'Statement').replace(/[^\w-]+/g, '')) || 'Statement';
    } else if (data.template === 'processing') {
      acct = ((data.style2.merchantNumber || 'Statement').replace(/[^\w-]+/g, '')) || 'Statement';
    } else {
      acct = ((data.details.billingAccountNumber || 'Statement').replace(/[^\w-]+/g, '')) || 'Statement';
    }
    var m = /^(\d{4})-(\d{2})-\d{2}$/.exec(data.periodStart || '');
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];
    var suffix = m ? months[Number(m[2]) - 1] + '_' + m[1] : 'Statement';
    return (acct && acct !== 'Statement' ? 'Statement_' + acct + '_' : 'Statement_') +
      suffix + '.pdf';
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // Repaint a logo image as black ink only (used by the voided check, which is
  // rendered entirely in black). Colour is removed by luminance; ink pixels are
  // pushed toward solid black while near-white background is left untouched, so
  // a coloured wordmark reads as a clean black logo. Alpha is preserved. Any
  // failure resolves the original data URL so generation never breaks.
  function toBlackLogo(dataUrl) {
    return new Promise(function (resolve) {
      try {
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;
            if (!w || !h) { resolve(dataUrl); return; }
            var cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            var ctx = cv.getContext('2d');
            ctx.drawImage(img, 0, 0);
            var id = ctx.getImageData(0, 0, w, h);
            var p = id.data;
            for (var i = 0; i < p.length; i += 4) {
              var lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
              // near-white stays background; everything darker becomes black ink
              var v = lum >= 208 ? lum : lum * 0.4;
              p[i] = p[i + 1] = p[i + 2] = v;
            }
            ctx.putImageData(id, 0, 0);
            resolve(cv.toDataURL('image/png'));
          } catch (e) { resolve(dataUrl); }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      } catch (e) { resolve(dataUrl); }
    });
  }

  var FONTS = {
    light: base64ToBytes(window.STATEMENT_FONTS.light),
    bold: base64ToBytes(window.STATEMENT_FONTS.bold),
    book: base64ToBytes(window.STATEMENT_FONTS.book)
  };
  var FONTS2 = {
    sans: base64ToBytes(window.STATEMENT_FONTS.sans),
    sansBold: base64ToBytes(window.STATEMENT_FONTS.sansBold),
    sansBoldItalic: base64ToBytes(window.STATEMENT_FONTS.sansBoldItalic)
  };

  function dataForPdf() {
    var data = collectData();
    if (data.template === 'check') {
      var ck = data.check;
      // split the address textarea into the engine's up-to-3 lines
      var addr = ck.payerAddress || [];
      ck.payerAddress1 = addr[0] || '';
      ck.payerAddress2 = addr[1] || '';
      ck.payerAddress3 = addr[2] || '';
      ck.template = 'check';
      return ck;
    }
    if (data.template === 'letter') {
      var lt = data.letter;
      lt.template = 'letter';
      return lt;
    }
    if (data.template === 'bank') {
      var bk = data.bank;
      bk.periodStart = data.periodStart;
      bk.periodEnd = data.periodEnd;
      bk.template = 'bank';
      return bk;
    }
    if (data.template === 'processing') {
      var s2 = data.style2;
      s2.periodStart = data.periodStart;
      s2.periodEnd = data.periodEnd;
      s2.batches = data.batches;
      s2.template = 'processing';
      return s2;
    }
    var totals = StatementPDF.computeTotals(data);
    if (data.summaryAuto) {
      data.totalSales = totals.autoTotalSales;
      data.transactionCount = totals.autoTransactionCount;
    }
    return data;
  }

  function showPdf(url) {
    if (!pdfInline) return;
    var target = url + '#toolbar=0&navpanes=0';
    // location.replace keeps regenerations out of the session history.
    try {
      frame.contentWindow.location.replace(target);
    } catch (e) {
      frame.src = target;
    }
  }

  // One generation at a time; every call resolves with the bytes of the
  // render that includes the form state at (or after) the time of the call.
  function generateNow() {
    var run = genChain.then(function () {
      statusEl.textContent = 'Updating…';
      statusEl.classList.add('busy');
      var data = dataForPdf();
      var logo = logoDataUrl
        ? { bytes: base64ToBytes(logoDataUrl.split(',')[1]), mime: 'image/png' }
        : null;
      if (data.template === 'check') {
        // the check's bank mark comes from its own uploaded-check logo, not the
        // statement branding logo — and it is repainted to black ink so the
        // whole check renders in black only
        return (checkLogoUrl ? toBlackLogo(checkLogoUrl) : Promise.resolve(null))
          .then(function (blackUrl) {
            var ckLogo = blackUrl
              ? { bytes: base64ToBytes(blackUrl.split(',')[1]), mime: 'image/png' }
              : null;
            return CheckPDF.generate(data, {
              pdfLib: window.PDFLib,
              fontkit: window.fontkit,
              fonts: { sans: FONTS2.sans, sansBold: FONTS2.sansBold },
              logo: ckLogo
            });
          });
      }
      if (data.template === 'letter') {
        return LetterPDF.generate(data, {
          pdfLib: window.PDFLib,
          fontkit: window.fontkit,
          fonts: { sans: FONTS2.sans, sansBold: FONTS2.sansBold },
          logo: null
        });
      }
      if (data.template === 'bank') {
        return StatementBank.generate(data, {
          pdfLib: window.PDFLib,
          fontkit: window.fontkit,
          fonts: { sans: FONTS2.sans, sansBold: FONTS2.sansBold },
          logo: logo
        });
      }
      if (data.template === 'processing') {
        return StatementPDF2.generate(data, {
          pdfLib: window.PDFLib,
          fontkit: window.fontkit,
          fonts: FONTS2,
          logo: logo
        });
      }
      return StatementPDF.generate(data, {
        pdfLib: window.PDFLib,
        fontkit: window.fontkit,
        fonts: FONTS,
        logo: logo
      });
    }).then(function (bytes) {
      currentBytes = bytes;
      var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      showPdf(url);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = url;
      statusEl.textContent = 'Ready';
      statusEl.classList.remove('busy');
      return bytes;
    }, function (err) {
      console.error(err);
      statusEl.textContent = 'Couldn’t generate — check the form values';
      statusEl.classList.remove('busy');
      throw err;
    });
    genChain = run.then(null, function () { /* keep the chain alive */ });
    return run;
  }

  var suppressChange = false;
  function onChange() {
    if (suppressChange) return;
    var data = collectData();
    var totals = StatementPDF.computeTotals(data);
    refreshReadouts(data, totals);
    persist(data);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(generateNow, 400);
  }

  // Always regenerates first so the download reflects the latest edits.
  function download() {
    clearTimeout(debounceTimer);
    var buttons = [$('btn-download'), $('btn-download-top')];
    buttons.forEach(function (b) { b.disabled = true; });
    generateNow().then(function (bytes) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      a.download = filenameFor(collectData());
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    }).catch(function () { /* status pill already reports the failure */
    }).then(function () {
      buttons.forEach(function (b) { b.disabled = false; });
    });
  }

  /* ------------------------------------------------------------------ *
   * Persistence
   * ------------------------------------------------------------------ */

  function persist(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: data }));
    } catch (e) { /* storage full or unavailable — non-fatal */ }
  }

  function restore() {
    var restored = false;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === 'object' && saved.data) {
          applyData(saved.data);
          restored = true;
        }
      }
    } catch (e) { /* fall through to sample */ }
    try {
      var logo = localStorage.getItem(LOGO_KEY);
      logoDataUrl = null;
      if (typeof logo === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(logo)) {
        logoDataUrl = logo;
      }
      $('logo-empty').hidden = !!logoDataUrl;
      $('logo-preview').hidden = !logoDataUrl;
      if (logoDataUrl) $('logo-img').src = logoDataUrl;
    } catch (e) { /* no logo */ }
    return restored;
  }

  /* ------------------------------------------------------------------ *
   * Events + boot
   * ------------------------------------------------------------------ */

  document.addEventListener('input', function (e) {
    if (e.target.closest('.form-pane')) onChange();
  });
  document.addEventListener('change', function (e) {
    if (e.target.closest('.form-pane')) onChange();
  });

  $('btn-download').addEventListener('click', download);
  $('btn-download-top').addEventListener('click', download);

  // Two-step reset instead of a native confirm() dialog.
  var resetBtn = $('btn-reset');
  var resetArmedTimer = null;
  resetBtn.addEventListener('click', function () {
    if (!resetBtn.classList.contains('armed')) {
      resetBtn.classList.add('armed');
      resetArmedTimer = setTimeout(disarmReset, 4000);
      return;
    }
    disarmReset();
    applyData(SAMPLE);
    setLogo(null);
    onChange();
  });
  function disarmReset() {
    clearTimeout(resetArmedTimer);
    resetBtn.classList.remove('armed');
  }

  /* ------------------------------------------------------------------ *
   * Dark-mode toggle
   * ------------------------------------------------------------------ */

  var THEME_KEY = 'statement-studio-theme';
  var themeBtn = $('btn-theme');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');

  function effectiveDark() {
    var set = document.documentElement.getAttribute('data-theme');
    if (set === 'dark') return true;
    if (set === 'light') return false;
    return !!(prefersDark && prefersDark.matches);
  }
  function syncThemeButton() {
    var dark = effectiveDark();
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    themeBtn.title = dark ? 'Light mode' : 'Dark mode';
    // keep the mobile status-bar / PWA chrome in step with the theme
    if (themeMeta) themeMeta.setAttribute('content', dark ? '#1c1c1e' : '#f5f5f7');
  }
  themeBtn.addEventListener('click', function () {
    var next = effectiveDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode */ }
    syncThemeButton();
  });
  // Follow the OS setting live while the user hasn't made an explicit choice.
  if (prefersDark && prefersDark.addEventListener) {
    prefersDark.addEventListener('change', function () {
      if (!document.documentElement.getAttribute('data-theme')) syncThemeButton();
    });
  }
  syncThemeButton();

  /* ------------------------------------------------------------------ *
   * Statement import
   * ------------------------------------------------------------------ */

  var importDrop = $('import-drop');
  var importInput = $('import-input');
  var importErrorTimer = null;
  var importBusy = false;

  function importError(msg) {
    $('import-note').hidden = true;
    var note = $('import-error');
    note.textContent = msg;
    note.hidden = false;
    clearTimeout(importErrorTimer);
    importErrorTimer = setTimeout(function () { note.hidden = true; }, 7000);
  }

  // Immediate, always-visible progress so a slow read never looks like
  // "nothing happened".
  function importStatus(msg) {
    $('import-error').hidden = true;
    var note = $('import-note');
    note.textContent = msg;
    note.hidden = false;
  }

  // Read a File to bytes. Blob.arrayBuffer() is unavailable on older iOS
  // Safari, so fall back to FileReader there.
  function readFileBytes(file) {
    if (typeof file.arrayBuffer === 'function') {
      return file.arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
    }
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(new Uint8Array(fr.result)); };
      fr.onerror = function () { reject(fr.error || new Error('Could not read the file.')); };
      try { fr.readAsArrayBuffer(file); } catch (e) { reject(e); }
    });
  }

  // Pull the statement's OWN logo out of an uploaded PDF so the regenerated
  // statement keeps the same brand mark. Finds the image sitting in the
  // masthead band of page 1 (top-left for most processors, top-right for some
  // banks; the top-most image when there are several), then renders just that
  // rectangle to a PNG. Best-effort: resolves to null when there is no clear
  // logo, and never rejects into the import path.
  function extractStatementLogo(bytes, pdfjsLib) {
    return pdfjsLib.getDocument({ data: bytes }).promise.then(function (doc) {
      return doc.getPage(1).then(function (page) {
        var base = page.getViewport({ scale: 1 });
        var PW = base.width, PH = base.height;
        return page.getOperatorList().then(function (ops) {
          var OPS = pdfjsLib.OPS;
          function mul(m, n) {
            return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
              m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
              m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
          }
          var ctm = [1, 0, 0, 1, 0, 0], stack = [], cands = [];
          for (var i = 0; i < ops.fnArray.length; i++) {
            var fn = ops.fnArray[i], a = ops.argsArray[i];
            if (fn === OPS.save) stack.push(ctm.slice());
            else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
            else if (fn === OPS.transform) ctm = mul(ctm, a);
            else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
              var w = Math.hypot(ctm[0], ctm[1]), h = Math.hypot(ctm[2], ctm[3]);
              cands.push({ w: w, h: h, x: ctm[4], yTop: PH - ctm[5] - h });
            }
          }
          // masthead band, not a hairline/barcode, not a full-width banner
          var pick = cands.filter(function (c) {
            return c.yTop < PH * 0.28 && c.w >= 14 && c.h >= 10 && c.w < PW * 0.85 &&
              (Math.max(c.w, c.h) / Math.min(c.w, c.h)) < 12;
          }).sort(function (a, b) { return a.yTop - b.yTop || (b.w * b.h) - (a.w * a.h); })[0];
          if (!pick) return null;
          var scale = 3, vp = page.getViewport({ scale: scale });
          var cv = document.createElement('canvas');
          cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
          return page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise
            .then(function () {
              var pad = 2;
              var sx = Math.max(0, Math.floor((pick.x - pad) * scale));
              var sy = Math.max(0, Math.floor((pick.yTop - pad) * scale));
              var sw = Math.min(cv.width - sx, Math.ceil((pick.w + pad * 2) * scale));
              var sh = Math.min(cv.height - sy, Math.ceil((pick.h + pad * 2) * scale));
              if (sw < 1 || sh < 1) return null;
              var crop = document.createElement('canvas');
              crop.width = sw; crop.height = sh;
              crop.getContext('2d').drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh);
              return crop.toDataURL('image/png');
            });
        });
      });
    });
  }

  function acceptImportFile(file) {
    // Guard the whole path so a failure always surfaces a message rather
    // than silently doing nothing.
    try {
      if (importBusy) return;
      if (!file) { importError('No file was received — try choosing the PDF again.'); return; }
      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name || '')) {
        importError('Please choose a statement PDF.');
        return;
      }
      if (!window.pdfjsLib || !window.StatementImport) {
        importError('The PDF reader is still loading — wait a moment, then try again.');
        return;
      }

      importBusy = true;
      importDrop.classList.add('busy');
      importStatus('Reading “' + (file.name || 'statement.pdf') + '” …');

      // Absolute worker URL resolves correctly under subpaths and when the
      // app runs as an installed PWA.
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          new URL('vendor/pdfjs.worker.min.js', document.baseURI).href;
      } catch (e) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs.worker.min.js';
      }

      readFileBytes(file).then(function (bytes) {
        // parsePdf hands its buffer to pdf.js (which may detach it); keep an
        // untouched copy so the logo can be extracted from the same PDF after.
        var forLogo = bytes.slice(0);
        return StatementImport.parsePdf(bytes, window.pdfjsLib).then(function (parsed) {
          return { parsed: parsed, forLogo: forLogo };
        });
      }).then(function (res) {
        var parsed = res.parsed;
        // The legacy billing layout no longer has a tab; importing one would
        // land the UI on a tab-less billing state. Recognise it and report it
        // as unsupported rather than loading it.
        if (parsed.template === 'billing') {
          importError('That looks like an older billing statement, which this tool ' +
            'no longer generates. Try a card-processing or bank statement, or use the ' +
            'Voided Check / Bank Letter tabs.');
          return;
        }
        // overlay the parsed statement on a fresh copy of the sample so the
        // other template's fields keep sensible defaults
        var base = JSON.parse(JSON.stringify(SAMPLE));
        Object.keys(parsed).forEach(function (k) { base[k] = parsed[k]; });
        applyData(base);
        onChange();

        // Carry over the uploaded statement's own logo (best-effort; the import
        // has already succeeded, so a failure here just leaves the logo as-is).
        extractStatementLogo(res.forLogo, window.pdfjsLib).then(function (url) {
          if (url) { setLogo(url); onChange(); }
        }).catch(function () { /* no logo to carry over */ });
        var note = $('import-note');
        // Label the statement by its true month — the same value the month
        // picker is set to. Bank periods often begin on the last day of the
        // prior month, so statementMonth (derived from the period end) is
        // authoritative; fall back to the period start only when it is absent.
        var sm = base.statementMonth || {};
        var period = (hasText(sm.month) && hasText(sm.year))
          ? MONTH_NAMES[Number(sm.month)] + ' ' + sm.year
          : (base.periodStart
            ? new Date(base.periodStart + 'T00:00:00').toLocaleDateString(undefined,
              { month: 'long', year: 'numeric' })
            : '');
        var kind, detail;
        if (base.template === 'bank') {
          kind = 'bank';
          var bk = base.bank || {};
          var n = (bk.credits || []).length + (bk.debits || []).length + (bk.checks || []).length;
          detail = n + ' transaction' + (n === 1 ? '' : 's');
        } else {
          kind = base.template === 'processing' ? 'card processing' : 'billing';
          detail = (base.batches || []).length + ' batches';
        }
        note.textContent = 'Imported ' + kind + ' statement' +
          (period ? ' — ' + period : '') + ' · ' + detail +
          '. Every field below is editable — check the values against your statement.';
        note.hidden = false;
      }).catch(function (err) {
        console.error('Statement import failed:', err);
        importError('Couldn’t read that statement — it doesn’t match a supported layout. ' +
          'Make sure it’s a text-based PDF (not a scan or photo).');
      }).then(function () {
        importBusy = false;
        importDrop.classList.remove('busy');
      });
    } catch (err) {
      console.error('Statement import failed:', err);
      importBusy = false;
      importDrop.classList.remove('busy');
      importError('Something went wrong reading that file — try again.');
    }
  }

  // Open the picker, but ignore the input's own click bubbling back up to the
  // drop zone (it is a child element) — that re-entrancy makes the picker
  // fail to open on some mobile browsers.
  function openImportPicker(e) {
    if (e && e.target === importInput) return;
    importInput.click();
  }
  importDrop.addEventListener('click', openImportPicker);
  importDrop.addEventListener('keydown', function (e) {
    if (e.target !== importDrop) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      importInput.click();
    }
  });
  ['dragover', 'dragenter'].forEach(function (evt) {
    importDrop.addEventListener(evt, function (e) {
      e.preventDefault();
      importDrop.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    importDrop.addEventListener(evt, function (e) {
      e.preventDefault();
      importDrop.classList.remove('dragover');
    });
  });
  importDrop.addEventListener('drop', function (e) {
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) acceptImportFile(file);
  });
  importInput.addEventListener('change', function () {
    if (importInput.files && importInput.files[0]) acceptImportFile(importInput.files[0]);
    importInput.value = '';
  });

  /* ------------------------------------------------------------------ *
   * Voided-check upload (visual reference for the manual fields)
   * ------------------------------------------------------------------ */

  var checkDrop = $('check-drop');
  var checkInput = $('check-input');

  function checkNote(msg) {
    var n = $('check-note'); n.textContent = msg; n.hidden = false;
    $('check-error').hidden = true;
  }
  function checkErr(msg) {
    var e = $('check-error'); e.textContent = msg; e.hidden = false;
    $('check-note').hidden = true;
  }
  function showCheckRef(dataUrl) {
    $('check-ref').src = dataUrl;
    $('check-ref-wrap').hidden = false;
    checkNote('Reference loaded. Check photos can’t be read automatically — copy the '
      + 'routing and account numbers from it into the fields below and they transpose '
      + 'onto the preview.');
  }

  // Render an uploaded check (PDF or image) to a picture shown as a reference
  // beside the form. Photos of checks carry no readable text, so nothing is
  // auto-filled; this just lets you read the numbers off your own check.
  function acceptCheckFile(file) {
    if (!file) return;
    var isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name || '');
    var isImg = /^image\//.test(file.type);
    if (!isPdf && !isImg) { checkErr('Please choose a check PDF or image.'); return; }
    checkNote('Reading the check …');
    if (isImg) {
      var reader = new FileReader();
      reader.onload = function () { showCheckRef(reader.result); };
      reader.onerror = function () { checkErr('That image could not be read.'); };
      reader.readAsDataURL(file);
      return;
    }
    readFileBytes(file).then(function (bytes) {
      return window.pdfjsLib.getDocument({ data: bytes }).promise;
    }).then(function (doc) {
      return doc.getPage(1);
    }).then(function (page) {
      var v0 = page.getViewport({ scale: 1 });
      var scale = Math.min(3, 1400 / Math.max(v0.width, v0.height));
      var vp = page.getViewport({ scale: scale });
      var cv = document.createElement('canvas');
      cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      return page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise
        .then(function () { showCheckRef(cv.toDataURL('image/png')); });
    }).catch(function () { checkErr('Couldn’t read that check file.'); });
  }

  checkDrop.addEventListener('click', function (e) {
    if (e && e.target === checkInput) return;
    checkInput.click();
  });
  checkDrop.addEventListener('keydown', function (e) {
    if (e.target !== checkDrop) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); checkInput.click(); }
  });
  ['dragover', 'dragenter'].forEach(function (evt) {
    checkDrop.addEventListener(evt, function (e) { e.preventDefault(); checkDrop.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    checkDrop.addEventListener(evt, function (e) { e.preventDefault(); checkDrop.classList.remove('dragover'); });
  });
  checkDrop.addEventListener('drop', function (e) {
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) acceptCheckFile(file);
  });
  checkInput.addEventListener('change', function () {
    if (checkInput.files && checkInput.files[0]) acceptCheckFile(checkInput.files[0]);
    checkInput.value = '';
  });

  /* ------------------------------------------------------------------ *
   * Bank-letter upload (visual reference for the manual fields)
   * ------------------------------------------------------------------ */

  var letterDrop = $('letter-drop');
  var letterInput = $('letter-input');

  function letterNote(msg) {
    var n = $('letter-note'); n.textContent = msg; n.hidden = false;
    $('letter-error').hidden = true;
  }
  function letterErr(msg) {
    var e = $('letter-error'); e.textContent = msg; e.hidden = false;
    $('letter-note').hidden = true;
  }
  function showLetterRef(dataUrl) {
    $('letter-ref').src = dataUrl;
    $('letter-ref-wrap').hidden = false;
    letterNote('Reference loaded. Letter photos can’t be read automatically — copy the '
      + 'details from it into the fields below and they render onto a clean letter.');
  }
  function acceptLetterFile(file) {
    if (!file) return;
    var isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name || '');
    var isImg = /^image\//.test(file.type);
    if (!isPdf && !isImg) { letterErr('Please choose a bank-letter PDF or image.'); return; }
    letterNote('Reading the letter …');
    if (isImg) {
      var reader = new FileReader();
      reader.onload = function () { showLetterRef(reader.result); };
      reader.onerror = function () { letterErr('That image could not be read.'); };
      reader.readAsDataURL(file);
      return;
    }
    readFileBytes(file).then(function (bytes) {
      return window.pdfjsLib.getDocument({ data: bytes }).promise;
    }).then(function (doc) {
      return doc.getPage(1);
    }).then(function (page) {
      var v0 = page.getViewport({ scale: 1 });
      var scale = Math.min(3, 1400 / Math.max(v0.width, v0.height));
      var vp = page.getViewport({ scale: scale });
      var cv = document.createElement('canvas');
      cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      return page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise
        .then(function () { showLetterRef(cv.toDataURL('image/png')); });
    }).catch(function () { letterErr('Couldn’t read that letter file.'); });
  }

  letterDrop.addEventListener('click', function (e) {
    if (e && e.target === letterInput) return;
    letterInput.click();
  });
  letterDrop.addEventListener('keydown', function (e) {
    if (e.target !== letterDrop) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); letterInput.click(); }
  });
  ['dragover', 'dragenter'].forEach(function (evt) {
    letterDrop.addEventListener(evt, function (e) { e.preventDefault(); letterDrop.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    letterDrop.addEventListener(evt, function (e) { e.preventDefault(); letterDrop.classList.remove('dragover'); });
  });
  letterDrop.addEventListener('drop', function (e) {
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) acceptLetterFile(file);
  });
  letterInput.addEventListener('change', function () {
    if (letterInput.files && letterInput.files[0]) acceptLetterFile(letterInput.files[0]);
    letterInput.value = '';
  });

  // Permanent brand mark beside the site name (baked in via brand.data.js),
  // mirrored into the browser-tab favicon so both show the same logo.
  if (typeof window.BRAND_LOGO === 'string' && window.BRAND_LOGO.indexOf('data:image/') === 0) {
    var brandImg = $('brand-logo');
    brandImg.src = window.BRAND_LOGO;
    brandImg.hidden = false;
    $('brand-mark').classList.add('has-logo');
    var favicon = $('favicon');
    if (favicon) {
      favicon.type = 'image/png';
      favicon.href = window.BRAND_LOGO;
    }
  }

  // PWA: offline support via a network-first service worker (https only;
  // localhost counts as secure for development).
  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('Service worker registration failed:', err);
    });
  }

  if (!restore()) applyData(SAMPLE);
  // Billing no longer has a tab; a restored billing session opens on the check
  // tab instead of a tab-less state (its data stays in the hidden fields).
  if (template === 'billing') setTemplate('check', true);
  onChange();
})();
