import mongoose, { Schema, model } from 'mongoose'
import { CAR_STATUS, DOC_STATUS } from '../utils/user'
import Joi, { object } from 'joi'
import mongoosePaginate from 'mongoose-paginate-v2'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'

export const badgeSchema = new Schema(
  {
    name: String,

    image: String,

    key: String,

    description: String,

    type: String,
  },
  { versionKey: false, timestamps: true }
)

badgeSchema.plugin(aggregatePaginate)

export const Badge = model('Badge', badgeSchema)
