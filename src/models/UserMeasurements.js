// models/UserMeasurement.js
import mongoose, { model, Schema } from 'mongoose'

export const createMeasurementSchema = (valueType = Number) =>
  new Schema(
    {
      value: { type: valueType, required: true },
      unit: { type: String, enum: ['cm', 'inch'], required: true },
    },
    { _id: false }
  ) // Prevents creating an extra _id for nested fields
const measurementSchema = createMeasurementSchema()
const stringMeasurementsSchema = createMeasurementSchema(String)
const userMeasurementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  fit: { type: String, enum: ['tight', 'loose', 'fitted'], required: true },

  height: measurementSchema,

  upperBody: {
    bust: measurementSchema, // Women only
    bandSize: measurementSchema, // Women only
    cupSize: stringMeasurementsSchema, // Women only

    chest: measurementSchema, // Men only
    shoulderWidth: measurementSchema, // Men only
    bicep: measurementSchema, // Men only

    sleevesLength: measurementSchema,
    torsoHeight: measurementSchema,
  },

  lowerBody: {
    waist: measurementSchema,
    hip: measurementSchema,
    inseam: measurementSchema,
    legLength: measurementSchema,
    thighCircumference: measurementSchema, // Men only
  },

  footMeasurement: {
    footLength: measurementSchema,
    footWidth: measurementSchema,
  },

  handMeasurement: {
    handLength: measurementSchema,
    handWidth: measurementSchema,
  },

  headMeasurement: {
    headCircumference: measurementSchema,
  },

  faceMeasurement: {
    faceLength: measurementSchema,
    faceWidth: measurementSchema,
  },
})
export const UserMeasurement = model('UserMeasurement', userMeasurementSchema)
