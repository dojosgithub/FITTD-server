import { isEmpty } from 'lodash'
import mongoose from 'mongoose'
import { User } from '../models'
import { createUser } from '../services'
import { generatePassword } from '../utils'

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
    // role: { name: SYSTEM_STAFF_ROLE.SSA, shortName: getRoleShortName(USER_TYPES.SYS, SYSTEM_STAFF_ROLE.SSA) }, // 'System Admin'
    // address: '',
    password: '$Google123',
    // userTypes: [USER_TYPES.SYS],
  }
  // await createAdmin({ adminUserDetails })

  console.log('[🌱 seeded successfully]')
}

export const createAdmin = async ({ adminUserDetails }) => {
  console.log('[🌱 seeding-admin-data]')

  let { email, firstName, lastName, password } = adminUserDetails

  const userExists = await User.findOne({ email })

  if (!isEmpty(userExists)) return

  const hasedPassword = await generatePassword(password)

  const newUser = await createUser({
    firstName,
    lastName,
    email,
    password: hasedPassword,
  })
  console.log('newUser', newUser)

  await newUser.save()
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
