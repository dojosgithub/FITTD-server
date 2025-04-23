import mongoose, { Schema, model } from 'mongoose'
import { CAR_STATUS, DOC_STATUS } from '../utils/user'
import Joi, { object } from 'joi'
import mongoosePaginate from 'mongoose-paginate-v2'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'

export const challengeSchema = new Schema(
  {
    name: String,
    challengeCreator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    image: String,
    badgeCriteria: String,
    challengeStart: {
      type: Date,
    },
    challengeEnd: {
      type: Date,
    },
    type: String,
    exerciseType: String,
    status: String,
    isFeatured: {
      type: Boolean,
      default: false,
    },
    activeDays: [
      {
        dayName: String,
        isActive: {
          type: Boolean,
          default: false,
        },
        date: {
          type: Date,
        },
        weekNumber: Number,
      },
    ],
    user: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    exercise: [
      {
        exerciseId: {
          type: Schema.Types.ObjectId,
          ref: 'Exercise',
        },
        reps: Number,
        sets: Number,
        duration: Number,
        _type: String,
      },
    ],
    badge: {
      type: Schema.Types.ObjectId,
      ref: 'Badge',
    },
    group: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
    },
  },
  { versionKey: false, timestamps: true }
)

challengeSchema.plugin(aggregatePaginate)

export const Challenge = model('Challenge', challengeSchema)
