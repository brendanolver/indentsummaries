'use strict';
const { amGetAllPages } = require('./amClient');

const ONLINE_STORE_CUSTOMER_ID = '1068'; // "WNDRR ONLINE STORE" — tracked separately in the Online Order column, excluded from indent totals

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

// Shared order-item crawl: fetches open orders scoped to collections/sellDate, with the
// same Quickfill/online-store exclusions, then consolidates by style/size. `includeItem`
// decides which order-item lines qualify (this is the only thing that differs between
// pullIndentSummary and pullPOSummary).
async function pullOrderItems({ collections, sellDate, includeItem, trackAccounts }) {
  if (!Array.isArray(collections) || collections.length === 0) {
    throw new Error('At least one collection is required');
  }
  if (!sellDate) {
    throw new Error('sellDate is required');
  }

  const styleMap = await buildStyleMap(collections);
  const validStyles = new Set(Object.keys(styleMap));

  const orders = await amGetAllPages('orders', { is_open: '1' });

  const pivotMap = {}; // style -> { style, desc, colours:Set, collection, category, sizes, accounts:Set }
  const sizesFound = new Set();

  orders.forEach((order) => {
    if ((order.date_internal || '') < sellDate) return;
    if (order.customer_id === ONLINE_STORE_CUSTOMER_ID) return; // WNDRR ONLINE STORE — tracked separately
    if (isQuickfillOrder(order)) return;
    (order.order_items || []).forEach((item) => {
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
          accounts: new Set(),
        };
      }
      const colour = item.attr_2 || meta.colour;
      if (colour) pivotMap[style].colours.add(colour);
      pivotMap[style].sizes[size] = (pivotMap[style].sizes[size] || 0) + units;
      if (trackAccounts && order.customer_id) pivotMap[style].accounts.add(order.customer_id);
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
    ...(trackAccounts ? { accounts: r.accounts.size } : {}),
  }));

  return { pivotRows, sizeColumns };
}

async function pullIndentSummary({ collections, sellDate }) {
  return pullOrderItems({
    collections,
    sellDate,
    includeItem: (item) => !item.purchase_order_id, // exclude lines that already have a PO raised
    trackAccounts: true,
  });
}

// Mirror of pullIndentSummary: consolidates only the order-item lines that DO already
// have a purchase order raised — i.e. what's already committed to production, as
// opposed to what still needs a PO ("Need to Buy").
async function pullPOSummary({ collections, sellDate }) {
  return pullOrderItems({
    collections,
    sellDate,
    includeItem: (item) => !!item.purchase_order_id,
    trackAccounts: false,
  });
}

module.exports = { pullIndentSummary, pullPOSummary, ONLINE_STORE_CUSTOMER_ID };
