import { getIO } from './socket.js'

export const setupSocketEventHandlers = () => {
  const io = getIO()

  io.on('connection', (socket) => {
    console.log('A user connected')

    // Handling "joinAuction" event
    socket.on('joinAuction', (auctionId) => {
      console.log(`User ${socket.id} joining auction: ${auctionId}`)
      socket.join(auctionId)
    })

    // Add more event handlers here
  })
}
