'use strict';
const { amGetAllPages } = require('./amClient');

const QUICKFILL_WAREHOUSE_ID = '1002'; // "Shopify Online Store" in AM's warehouses list

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

async function pullIndentSummary({ collections, sellDate }) {
  if (!Array.isArray(collections) || collections.length === 0) {
    throw new Error('At least one collection is required');
  }
  if (!sellDate) {
    throw new Error('sellDate is required');
  }

  const styleMap = await buildStyleMap(collections);
  const validStyles = new Set(Object.keys(styleMap));

  const orders = await amGetAllPages('orders', { is_open: '1' });

  const pivotMap = {}; // style -> { style, desc, colours:Set, collection, category, sizes }
  const sizesFound = new Set();

  orders.forEach((order) => {
    if ((order.date_internal || '') < sellDate) return;
    (order.order_items || []).forEach((item) => {
      const warehouseId = item.warehouse_id || order.warehouse_id;
      if (warehouseId === QUICKFILL_WAREHOUSE_ID) return; // Quickfill / online store
      if (item.purchase_order_id) return; // PO already raised against this line

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
        };
      }
      const colour = item.attr_2 || meta.colour;
      if (colour) pivotMap[style].colours.add(colour);
      pivotMap[style].sizes[size] = (pivotMap[style].sizes[size] || 0) + units;
      sizesFound.add(size);
    });
  });

  const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38', '40', 'OS'];
  const sizeColumns = SIZE_ORDER.filter((s) => sizesFound.has(s));

  const pivotRows = Object.values(pivotMap).map((r) => ({
    style: r.style,
    desc: r.desc,
    colour: [...r.colours].join(', '),
    collection: r.collection,
    category: r.category,
    sizes: r.sizes,
  }));

  return { pivotRows, sizeColumns };
}

module.exports = { pullIndentSummary, QUICKFILL_WAREHOUSE_ID };
