import { Schema, model } from 'mongoose'

export const totpSchema = new Schema(
  {
    token: String,
    email: String,
    mobile: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 180, // Document expires 120 seconds (2 minutes) after creation
    },
  },
  { versionKey: false, timestamps: true }
)

export const TOTP = model('TOTP', totpSchema)
