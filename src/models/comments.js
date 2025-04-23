import mongoose, { Schema, model } from 'mongoose'
import { CAR_STATUS, DOC_STATUS } from '../utils/user'
import Joi from 'joi'
import mongoosePaginate from 'mongoose-paginate-v2'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'

export const commentSchema = new Schema(
  {
    comment: String,

    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    commentOwner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { versionKey: false, timestamps: true }
)

// export const validateRegistration = (obj) => {
//   const schema = Joi.object({
//     vin: Joi.string().required(),
//     make: Joi.string().required(),
//     model: Joi.string().required(),
//     year: Joi.string().required(),
//     miles: Joi.string().required(),
//     color: Joi.string().required(),
//     fuelType: Joi.string().required(),
//     bodyType: Joi.string().required(),
//     specs: Joi.object(),
//     description: Joi.string(),
//     city: Joi.string().required(),
//     state: Joi.string().required(),
//     status: Joi.string(),
//     trim: Joi.string(),
//     owner: Joi.string(),
//     files: Joi.object(),
//     features: Joi.object(),
//   }).options({ abortEarly: false })

//   return schema.validate(obj)
// }

// carSchema.plugin(mongoosePaginate)
commentSchema.plugin(aggregatePaginate)

export const Comment = model('Comment', commentSchema)
