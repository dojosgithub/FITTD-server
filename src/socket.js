// socket.js
import { Server } from 'socket.io'

let io

export const init = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Specify the client origin explicitly
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type', 'Origin', 'Accept', 'Access-Control-Allow-Request-Method'],
    },
  })
  return io
}

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!')
  }
  return io
}
