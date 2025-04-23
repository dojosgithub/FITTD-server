import mongoose, { Schema, model } from 'mongoose'
import { CAR_STATUS, DOC_STATUS } from '../utils/user'
import Joi, { object } from 'joi'
import mongoosePaginate from 'mongoose-paginate-v2'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'

export const userChallengeProgressSchema = new Schema(
  {
    challenge: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    finishedAt: Date,

    dailyProgress: [
      {
        exerciseStatus: [
          {
            exerciseId: {
              type: Schema.Types.ObjectId,
              ref: 'Exercise',
            },
            isFinished: {
              type: Boolean,
              default: false,
            },
            timeTaken: Number,
            caloriesBurnt: Number,
          },
        ],
        completionInPercent: Number,
        isAttempted: {
          type: Boolean,
          default: false,
        },
        dayName: String,
        date: {
          type: Date,
          default: Date.now,
        },
        attemptedAt: {
          type: Date,
        },
      },
    ],

    totalProgress: Number,

    points: Number,

    totalTime: String,

    challengeType: String,

    startDateTime: {
      type: Date,
    },
  },
  { versionKey: false, timestamps: true }
)

userChallengeProgressSchema.plugin(aggregatePaginate)

export const UserChallengeProgress = model('UserChallengeProgress', userChallengeProgressSchema)
