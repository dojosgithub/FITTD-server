import mongoose, { Schema, model } from 'mongoose'
import { CAR_STATUS, DOC_STATUS } from '../utils/user'
import Joi, { object } from 'joi'
import mongoosePaginate from 'mongoose-paginate-v2'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'

export const exerciseSchema = new Schema(
  {
    name: String,

    description: String,

    targetMuscle: String,

    category: String,

    rest: String,

    files: Object,
  },
  { versionKey: false, timestamps: true }
)

exerciseSchema.plugin(aggregatePaginate)

export const Exercise = model('Exercise', exerciseSchema)
