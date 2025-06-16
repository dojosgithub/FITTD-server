import mongoose, { Schema, model } from 'mongoose'
import crypto from 'crypto'
import Joi from 'joi'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'

// User schema
export const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      // required: true,
      select: false,
    },
    image: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    accountType: { type: String, default: 'FITTD' },
    measurements: { type: mongoose.Schema.Types.ObjectId, ref: 'UserMeasurement', default: null },
    fcmToken: { type: String, default: null },
  },
  { versionKey: false, timestamps: true }
)

// Email verification token method
userSchema.methods.createEmailVerifyToken = function () {
  const emailToken = crypto.randomBytes(32).toString('hex')
  this.emailToken = crypto.createHash('sha256').update(emailToken).digest('hex')
  return emailToken
}

// Password reset token method
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex')
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex')
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000
  return resetToken
}

// Joi validation schema
export const validateRegistration = (obj) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email({ minDomainSegments: 2 }).required(),
    // mobile: Joi.string().required(),
    password: Joi.string().required(),
  }).options({ abortEarly: false })

  return schema.validate(obj)
}

// Plugins
userSchema.plugin(mongooseAggregatePaginate)

export const User = model('User', userSchema)
