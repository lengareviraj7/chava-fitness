import mongoose from 'mongoose';
import { normalizeDupKey } from '../utils/dupKey.js';

const variantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    flavour: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: null,
    },
    mrp: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    minStockLevel: {
      type: Number,
      default: 5,
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    hsn: {
      type: String,
      required: true,
      trim: true,
      default: '21069099',
    },
    gstRate: {
      type: Number,
      required: true,
      min: 0,
      max: 28,
      default: 0,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    dupKey: {
      type: String,
      default: '',
    },
    trackExpiry: {
      type: Boolean,
      default: true,
    },
    lowStockLimit: {
      type: Number,
      default: 3,
      min: 0,
    },
    variants: [variantSchema],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

productSchema.pre('save', function (next) {
  if (this.brand || this.name || this.category) {
    this.dupKey = normalizeDupKey(this.brand, this.name, this.category);
  }
  next();
});

productSchema.index({ name: 'text', brand: 'text', description: 'text' });
productSchema.index({ 'variants.sku': 1 }, { unique: true });
productSchema.index(
  { 'variants.barcode': 1 },
  { unique: true, partialFilterExpression: { 'variants.barcode': { $type: 'string', $gt: '' } } }
);
productSchema.index(
  { dupKey: 1 },
  { unique: true, partialFilterExpression: { isActive: true, dupKey: { $type: 'string', $gt: '' } } }
);

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
