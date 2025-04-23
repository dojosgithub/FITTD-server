import mongoose, { Schema, model } from 'mongoose'
import { DOC_STATUS } from '../utils/user'

export const totpSchema = new Schema(
  {
    token: String,
    // expireAt: {
    //   type: Date,
    //   default: null,
    // },
    email: String,
  },
  { versionKey: false, timestamps: true }
)

// totpSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 })

export const TOTP = model('TOTP', totpSchema)
