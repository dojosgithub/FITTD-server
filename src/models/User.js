import mongoose, { Schema, model } from 'mongoose'
import { DOC_STATUS, USER_ROLE } from '../utils/user'
import crypto from 'crypto'
import Joi from 'joi'
import mongoosePaginate from 'mongoose-paginate-v2'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'

export const userSchema = new Schema(
  {
    firstName: String,
    lastName: String,
    email: {
      type: String,
      required: true,
      unique: true,
    },
    gender: String,
    file: Object,
    age: String,
    weight: {
      value: String,
      unit: {
        type: String,
        enum: ['imperial', 'metric'],
      },
    },
    height: {
      value: String,
      unit: {
        type: String,
        enum: ['imperial', 'metric'],
      },
    },
    followers: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    following: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    password: { type: String, select: false },
    location: String,
    username: String,
    accountType: String,
    about: String,
    role: Object,
    userTypes: Array,
    refreshTokens: [String],

    challenges: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Challenge',
      },
    ],

    badges: [
      {
        badgeId: {
          type: Schema.Types.ObjectId,
          ref: 'Badge',
        },
        name: String,
        quantity: Number,
        _type: String,
        image: String,
      },
    ],

    lastActive: {
      type: Date,
    },

    points: {
      type: Number,
      default: 0,
    },

    fcmToken: String,
    totalCaloriesBurnt: {
      type: Number,
      default: 0,
    },
    totalTimeInSeconds: {
      type: Number,
      default: 0,
    },

    level: {
      type: String,
      default: 'Beginner',
    },
  },
  { versionKey: false, timestamps: true }
)

userSchema.methods.createEmailVerifyToken = function () {
  const emailToken = crypto.randomBytes(32).toString('hex')

  this.emailToken = crypto.createHash('sha256').update(emailToken).digest('hex')

  return emailToken
}

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex')

  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex')

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000

  return resetToken
}

export const validateRegistration = (obj) => {
  const schema = Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    email: Joi.string().email({ minDomainSegments: 2 }).required(),
    password: Joi.string().required(),
    gender: Joi.string(),
    age: Joi.string(),
    location: Joi.string(),
    username: Joi.string(),
    about: Joi.string(),
    weight: Joi.object({
      value: Joi.number(),
      unit: Joi.string().valid('imperial', 'metric'),
    }),
    height: Joi.object({
      value: Joi.number(),
      unit: Joi.string().valid('imperial', 'metric'),
    }),
  }).options({ abortEarly: false })

  return schema.validate(obj)
}
userSchema.plugin(mongooseAggregatePaginate)

export const User = model('User', userSchema)
