import mongoose, { model } from 'mongoose'

var Schema = mongoose.Schema
export const errorLogSchema = new Schema(
  {
    message: String,
    timeStamp: String,
    apiPath: String,
    apiMethod: String,
    apiHost: String,
    file: String,
    line: String,
    db: String,
  },
  { versionKey: false, capped: { max: 1000 }, timestamps: true }
)
// module.exports = model('ErrorLog', errorLogSchema)
// module.exports = errorLogSchema;
export const ErrorLog = model('ErrorLog', errorLogSchema)
