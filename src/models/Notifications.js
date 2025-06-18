import mongoose, { Schema, model } from 'mongoose'
const receiverSchema = new Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isUnRead: { type: Boolean, default: true },
  },
  { _id: false } // This disables _id inside each receiver object
)
export const notificationsSchema = new Schema(
  {
    message: { type: String, required: true },
    title: { type: String, required: true },
    receivers: [receiverSchema],
  },
  { versionKey: false, timestamps: true }
)

// notifications.index({ expireAt: 1 }, { expireAfterSeconds: 0 })

export const Notification = model('Notification', notificationsSchema)
