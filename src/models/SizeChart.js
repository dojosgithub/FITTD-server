import mongoose, { Schema, model } from 'mongoose'

const SizeChartSchema = new Schema(
  {
    brand: { type: String, required: true, unique: true },
    sizeChart: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
)

export const SizeChart = model('SizeChart', SizeChartSchema)
