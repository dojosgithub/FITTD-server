// Using ES6 module import syntax
import { schedule } from 'node-cron'
import { sendIncompleteMeasurementReminders } from '../services'

// "0 0 * * 0", Every sunday at 00:00 - Required
// "59 14 * * 1", Every monday at 14:59
// "* * * * * *", Every second
// "* * * * *", Every minute
// 0 0 0 * * *, Every Midnight
// 0 0 * * *, every 24 hour

// Define the task using ES6 arrow function syntax
export const task = schedule(
  '0 0 0 * * *', // Every 24 hours
  // '* * * * *', // Every Minute
  () => {
    // if (process.env.NODE_ENV) automatedEmails()
    console.log('CRON JOB RUNNING!!!')
    StreakMasterBadge()
    sendIncompleteMeasurementReminders()
  },
  { timezone: 'America/New_York' }
)

async function StreakMasterBadge() {
  try {
    console.log('cron job running')
  } catch (e) {
    console.log('CRON JOB ERROR:', e)
  }
}
