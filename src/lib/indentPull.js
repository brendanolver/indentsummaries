'use strict';
const { amGetAllPages } = require('./amClient');

const ONLINE_STORE_CUSTOMER_ID = '1068'; // "WNDRR ONLINE STORE" — tracked separately in the Online Order column, excluded from indent totals
const ONLINE_STORE_WAREHOUSE_ID = '1002'; // "Shopify Online Store" in AM's warehouses list — excluded line-by-line below,
// regardless of which customer the order is under, since these lines are fulfilled from
// the online store's own stock pool rather than needing new production.

// Never real indent/PO demand — excluded from every pull, regardless of report type.
const GLOBALLY_EXCLUDED_CUSTOMER_IDS = new Set([
  '2264', // ONLINE SALES
  '2346', // STOCK ADJUST
  '1077', // WNDRR PROMO
  '2356', // ICONIC ONLINE SALES
]);

function isQuickfillOrder(order) {
  return /quickfill/i.test(order.customer_po || '') || /quickfill/i.test(order.department_number || '');
}

function colourFromWebTitle(product) {
  const w = product.web_title || '';
  const d = product.description || '';
  return w.startsWith(d + ' - ') ? w.slice(d.length + 3).trim() : '';
}

async function buildStyleMap(collections) {
  const styleMap = {};
  for (const collection of collections) {
    const products = await amGetAllPages('products', { group: collection });
    products.forEach((p) => {
      const style = p.style_number || '';
      if (!style) return;
      styleMap[style] = {
        collection: p.collection || collection,
        category: p.category || '',
        desc: p.description || '',
        colour: colourFromWebTitle(p),
      };
    });
  }
  return styleMap;
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38', '40', 'OS'];

// Shared order-item crawl: fetches open orders scoped to collections/date range, with
// the same Quickfill/globally-excluded-customer/online-store-customer/online-store-
// warehouse exclusions, then consolidates by style/size. `includeItem` decides which
// order-item lines qualify (this is the only
// thing that differs between pullIndentSummary and pullPOSummary).
async function pullOrderItems({
  collections, sellDateFrom, sellDateTo, includeItem, trackAccounts,
  excludeOnlineStore = true, excludeOrderIds = [],
}) {
  if (!Array.isArray(collections) || collections.length === 0) {
    throw new Error('At least one collection is required');
  }

  const styleMap = await buildStyleMap(collections);
  const validStyles = new Set(Object.keys(styleMap));
  const excludeIds = new Set((excludeOrderIds || []).map(String));

  const orders = await amGetAllPages('orders', { is_open: '1' });

  const pivotMap = {}; // style -> { style, desc, colours:Set, collection, category, sizes, accounts:Map<customerId,{name,units}> }
  const sizesFound = new Set();

  orders.forEach((order) => {
    if (sellDateFrom && (order.date_internal || '') < sellDateFrom) return;
    if (sellDateTo && (order.date_internal || '') > sellDateTo) return;
    if (excludeOnlineStore && order.customer_id === ONLINE_STORE_CUSTOMER_ID) return; // WNDRR ONLINE STORE — tracked separately
    if (GLOBALLY_EXCLUDED_CUSTOMER_IDS.has(order.customer_id)) return;
    if (excludeIds.has(String(order.order_id))) return;
    if (isQuickfillOrder(order)) return;
    (order.order_items || []).forEach((item) => {
      if (item.warehouse_id === ONLINE_STORE_WAREHOUSE_ID) return; // fulfilled from online store stock, not new demand
      if (!includeItem(item)) return;

      const style = item.style_number || '';
      if (!validStyles.has(style)) return;

      const size = (item.size || '').toUpperCase();
      if (!size) return;

      const units = parseInt(item.qty_open, 10) || 0;
      if (units <= 0) return;

      const meta = styleMap[style];
      if (!pivotMap[style]) {
        pivotMap[style] = {
          style,
          desc: meta.desc,
          colours: new Set(),
          collection: meta.collection,
          category: meta.category,
          sizes: {},
          accounts: new Map(), // customer_id -> { name, units }
        };
      }
      const colour = item.attr_2 || meta.colour;
      if (colour) pivotMap[style].colours.add(colour);
      pivotMap[style].sizes[size] = (pivotMap[style].sizes[size] || 0) + units;
      if (trackAccounts && order.customer_id) {
        const accts = pivotMap[style].accounts;
        const entry = accts.get(order.customer_id) || { name: order.customer_name || order.customer_id, units: 0 };
        entry.units += units;
        accts.set(order.customer_id, entry);
      }
      sizesFound.add(size);
    });
  });

  const sizeColumns = SIZE_ORDER.filter((s) => sizesFound.has(s));

  const pivotRows = Object.values(pivotMap).map((r) => ({
    style: r.style,
    desc: r.desc,
    colour: [...r.colours].join(', '),
    collection: r.collection,
    category: r.category,
    sizes: r.sizes,
    ...(trackAccounts ? {
      accounts: r.accounts.size,
      accountBreakdown: [...r.accounts.values()].sort((a, b) => b.units - a.units),
    } : {}),
  }));

  return { pivotRows, sizeColumns };
}

async function pullIndentSummary({ collections, sellDateFrom, sellDateTo }) {
  if (!sellDateFrom) {
    throw new Error('sellDateFrom is required');
  }
  return pullOrderItems({
    collections,
    sellDateFrom,
    sellDateTo: sellDateTo || null,
    includeItem: (item) => !item.purchase_order_id, // exclude lines that already have a PO raised
    trackAccounts: true,
    excludeOnlineStore: true, // WNDRR ONLINE STORE tracked separately on the indent report
  });
}

// All open Sales Order lines for the selected collections placed within the given date
// range (either end optional), regardless of whether a Purchase Order has been
// individually raised against the line in ApparelMagic — unlike pullIndentSummary,
// this isn't scoped to "still needs a PO". The whole range is optional (omit both to
// include every open order).
async function pullPOSummary({ collections, sellDateFrom, sellDateTo, excludeOrderIds }) {
  return pullOrderItems({
    collections,
    sellDateFrom: sellDateFrom || null,
    sellDateTo: sellDateTo || null,
    includeItem: () => true,
    trackAccounts: false,
    excludeOnlineStore: false, // WNDRR ONLINE STORE units are real production commitments here
    excludeOrderIds,
  });
}

module.exports = { pullIndentSummary, pullPOSummary, ONLINE_STORE_CUSTOMER_ID };
