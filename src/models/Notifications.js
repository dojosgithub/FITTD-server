import mongoose, { Schema, model } from 'mongoose'
import { DOC_STATUS } from '../utils/user'

export const notificationsSchema = new Schema(
  {
    avatarUrl: String,
    type: String,
    category: Array,
    isUnRead: { type: Boolean, default: true },
    message: String,
    title: String,
    recivers: Array,
    ctaId: String,
  },
  { versionKey: false, timestamps: true }
)

// notifications.index({ expireAt: 1 }, { expireAfterSeconds: 0 })

export const Notification = model('Notification ', notificationsSchema)
