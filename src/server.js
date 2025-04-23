import express from 'express'
import path from 'path'
import cookieParser from 'cookie-parser'
import logger from 'morgan'
import cors from 'cors'
import routes from './routes'
import { errorHandler, decodeRoleTokenMiddleware } from './middlewares'
import { connectMongoDB } from './config/dbConnection'
import { corsConfig } from './config/cors'
import passport from 'passport'
import session from 'express-session'
// import passport.js
import './utils/passport.js'
// import sse from './config/sse'
import { CONTROLLER_PAYMENT } from './controllers'
import fs from 'fs'
// import secretsManager from './config/secretsManager'
import dotenv from 'dotenv'
import configSwagger from './config/swagger'

import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { init } from './socket'
import { setupSocketEventHandlers } from './socketEvents'
import { task } from './utils/cron'
import { challengeTask } from './utils/challenge-cron'
import { initializeFirebase } from './utils/firebase'

// For Socket.io
global.serverRoot = path.resolve(__dirname)

const app = express()

// For Socket.io
const server = createServer(app)
init(server)
// Setup Socket.IO event handlers
setupSocketEventHandlers()
initializeFirebase()
const PORT = process.env.PORT || 3000
const PUBLIC_PATH = path.join(__dirname, 'public')
connectMongoDB()

app.use(express.static(PUBLIC_PATH))
app.use(logger('dev'))
app.use(cookieParser())
app.use(cors(corsConfig))
app.post(
  '/api/payment/stripe/webhook',
  express.raw({ type: 'application/json' }),
  CONTROLLER_PAYMENT.stripeWebhookSecure
)
app.use(express.json({ limit: '50mb', extended: true }))
app.use(decodeRoleTokenMiddleware)
app.use(
  session({
    secret: process.env.SESSION_SECRET, // session secret
    resave: false,
    saveUninitialized: false,
  })
)
// initialize passport and session
app.use(passport.initialize())
app.use(passport.session())
// app.get(
//   '/api/stream',
//   (req, res, next) => {
//     res.flush = () => {}
//     next()
//   },
//   sse.init
// )
// app.get(
//   '/auth/google',
//   passport.authenticate('google', {
//     scope: ['email', 'profile'],
//   })
// )

// app.get(
//   '/auth/google/callback',
//   passport.authenticate('google', {
//     access_type: 'offline',
//     scope: ['email', 'profile'],
//   }),
//   (req, res) => {
//     if (!req.user) {
//       res.status(400).json({ error: 'Authentication failed' })
//     }
//     // return user details
//     res.status(200).json(req.user)
//   }
// )
app.use('/api-docs', configSwagger)
app.use('/api', routes)
app.use(errorHandler)

app.get('/ping', (req, res) => res.send('Ping Successfulls 😄'))

server.listen(PORT, async () => {
  // app.listen(PORT, '0.0.0.0', '0', async () => {
  task.start()
  challengeTask.start()
  console.log(`[⚡️ server]: Server running on port ${PORT} | Environment: ${process.env.NODE_ENV}`)
})

export default server
