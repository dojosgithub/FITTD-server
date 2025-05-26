import mongoose, { Schema, model } from 'mongoose'

const productMetricsSchema = new Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    clickCount: { type: Number, default: 0 },
  },
  { versionKey: false, timestamps: true }
)

export const ProductMetrics = model('ProductMetrics', productMetricsSchema)
