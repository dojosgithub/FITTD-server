import mongoose, { Schema, model } from 'mongoose'
import { DOC_STATUS, USER_ROLE } from '../utils/user'
import crypto from 'crypto'
import Joi from 'joi'
import mongoosePaginate from 'mongoose-paginate-v2'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'

export const groupSchema = new Schema(
  {
    groupName: String,
    age: String,
    level: String,
    groupDescription: String,
    files: Object,
    groupAdmin: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    groupMembers: [
      {
        memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        joinDate: { type: Date, default: Date.now },
      },
    ],
    post: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Post',
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
      },
    ],
  },
  { versionKey: false, timestamps: true }
)

// export const validateRegistration = (obj) => {
//   const schema = Joi.object({
//     name: Joi.string().required(),
//     city: Joi.string().required(),
//     state: Joi.string().required(),
//     address: Joi.string(),
//     phoneNumber: Joi.string(),
//     status: Joi.string().required(),
//     watchList: Joi.array(),
//     purchases: Joi.array(),
//     activeAuctions: Joi.array(),
//     cars: Joi.array(),
//     auctions: Joi.array(),
//     notifications: Joi.array(),
//     registrationNumber: Joi.string().required(),
//     documents: Joi.array(),
//   }).options({ abortEarly: false })

//   return schema.validate(obj)
// }

// groupSchema.plugin(mongoosePaginate)

groupSchema.plugin(aggregatePaginate)

export const Group = model('Group', groupSchema)
