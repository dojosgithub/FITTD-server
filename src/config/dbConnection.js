import { isEmpty } from 'lodash'
import mongoose, { Connection, connections, createConnection } from 'mongoose'
import {
  Subscription,
  generatedAssessmentSchema,
  User_SubscriptionRole,
  User,
  Exercise,
  Badge,
  Challenge,
} from '../models'
import { adminDeleteCognitoUser, createCognitoUser, createSubscription, createUser } from '../services'
import {
  SYSTEM_STAFF_ROLE,
  SYSTEM_USER_ROLE,
  USER_ROLE,
  USER_TYPES,
  generatePassword,
  getRoleShortName,
} from '../utils'

import badges from '../../badgesData.json'
import exercise from '../../exerciseData.json'

// Suppress Mongoose Deprecation Warning
mongoose.set('strictQuery', true)

// console.log(data)
export const mongodbOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // connectTimeoutMS: 20000,
  serverSelectionTimeoutMS: 5000, // Increase the timeout from the default 30000ms
  autoIndex: true,
  maxPoolSize: 1000,
}

export const seedData = async () => {
  console.log('[🌱 seeding]')

  const adminUserDetails = {
    firstName: 'fatik',
    lastName: 'khan',
    email: process.env.SYSTEM_ADMIN_EMAIL, // change only email whenever you want to create another SSA
    role: { name: SYSTEM_STAFF_ROLE.SSA, shortName: getRoleShortName(USER_TYPES.SYS, SYSTEM_STAFF_ROLE.SSA) }, // 'System Admin'
    address: '',
    password: '$Google123',
    userTypes: [USER_TYPES.SYS],
  }
  // await createCGAAdmin({ adminUserDetails })
  // await createZealAdmin({ adminUserDetails })
  // await createBCSAdmin({ adminUserDetails }) // Create Biddi Cars System Admin

  // updateZealUsers()

  // await insertBadges(badges)
  // await insertExercise(exercise)

  console.log('[🌱 seeded successfully]')
}

export const deleteCGAAdminById = async (id) => {
  const adminRootUser = await User.findById(id)
  const userRoleDoc = await User_SubscriptionRole.findOne({ user: id })
  console.log('adminRootUser', adminRootUser, 'userRoleDoc', userRoleDoc)
  // Delete user from cognito
  const cognitoResponse = await adminDeleteCognitoUser({
    email: adminRootUser.email,
    sub: adminRootUser.cognitoSub,
  })
  console.log('DELETED COGNITO', cognitoResponse)
  // Delete user doc
  const deletedUserDoc = await User.deleteOne({ _id: id })
  console.log('DELETED USER', deletedUserDoc)
  // Delete user role doc
  const deletedDoc = await User_SubscriptionRole.deleteOne({ user: id })
  console.log('DELETED deletedDoc', deletedDoc)
}

export const createZealAdmin = async ({ adminUserDetails }) => {
  console.log('[🌱 seeding-admin-data]')

  let { email, firstName, lastName, userTypes, role, password } = adminUserDetails

  const userExists = await User.findOne({ email })

  if (!isEmpty(userExists)) return

  const hasedPassword = await generatePassword(password)

  // const password = await generatePassword()

  const newUser = await createUser({
    firstName,
    lastName,
    email,
    role,
    userTypes,
    accountType: 'Zeal-Admin-Account',
    password: hasedPassword,
  })
  console.log('newUser', newUser)

  await newUser.save()
}

export const updateZealUsers = async () => {
  console.log('[🌱 seeding-admin-data]')

  const updateResult = await Challenge.deleteMany({ challengeCreator: '66a8a5a384b1c19e93dce0fd' })

  console.log('updateResult', updateResult)
}

export const insertBadges = async (data) => {
  console.log('[🌱 seeding-exercises]')
  await Badge.insertMany(data)
  // console.log(data)
}

export const insertExercise = async (data) => {
  console.log('[🌱 seeding-exercises]')
  await Exercise.insertMany(data)
  // console.log(data)
}

export const connectMongoDB = () => {
  // const certFileBuf = fs.readFileSync(<path to CA cert file>);

  mongoose.connect(
    process.env.MONGO_URI,
    mongodbOptions
    // , {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
    // // server: { sslCA: certFileBuf }
    // }
  )
  const db = mongoose.connection

  db.on('error', console.error.bind(console, '[❌ database] Connection error'))
  db.once('open', async function () {
    console.log('[🔌 database] Connected')
    try {
      // await seedData()
    } catch (error) {
      console.error('[🌱 seeding] Error', error)
    }
  })
}
