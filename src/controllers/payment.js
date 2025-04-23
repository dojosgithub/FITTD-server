// * Libraries
import { StatusCodes } from 'http-status-codes'
import _, { isEmpty } from 'lodash'

// * Models
import { User, Subscription, Assessment } from '../models'

// * Utilities
// import TenantDB from '../utils/tenantDB'
import Email from '../utils/email'
import { sortByFirstDate, sortByLatestDate, toObjectId } from '../utils/misc'
import { stripe } from '../utils/stripe'

// * Middlewares
import { asyncMiddleware } from '../middlewares'

// * Services
import {
  createStripePaymentIntent,
  getAllStripePrices,
  getAllStripeProducts,
  getPaymentStatusOfCurrentSubscription,
  getStripeCustomerInvoices,
  getUserSubscriptionRoleDetailsById,
  webhook_CustomerSubscriptionDeleted,
  webhook_CustomerSubscriptionTrialCreated,
  webhook_CustomerSubscriptionUpdated,
  webhook_sendInvoicePaidEmail,
  webhook_updateUserSubscriptionPaymentStatus,
} from '../services'

export const CONTROLLER_PAYMENT = {
  getUserSubscriptionPaymentStatus: asyncMiddleware(async (req, res) => {
    const token = req.decodedRoleToken
    const { subscription } = await getUserSubscriptionRoleDetailsById(token)

    const response = await getPaymentStatusOfCurrentSubscription({ role: token.role, subscription })

    res.status(StatusCodes.OK).json(response)
  }),

  // getStripeBillingPortalLink: asyncMiddleware(async (req, res) => {
  //   const { origin } = req.query
  //   const { _id } = req.decodedRoleToken
  //   const db = await new TenantDB(req.currentDB)
  //   const _User_SubscriptionRoleModel = await db.User_SubscriptionRoleModel()

  //   const { user, stripeCustomer = null } = await _User_SubscriptionRoleModel
  //     .findById(_id)
  //     .populate({ path: 'user', model: User, select: 'stripeCustomer' })

  //   const stripeCustomerId = stripeCustomer || user?.stripeCustomer

  //   console.log('stripeCustomerId', stripeCustomerId, 'OFFER', stripeCustomer, user?.stripeCustomer)
  //   if (isEmpty(stripeCustomerId))
  //     return res.status(StatusCodes.BAD_REQUEST).json({ message: 'User is not a stripe customer' })

  //   const session = await stripe.billingPortal.sessions.create({
  //     customer: stripeCustomerId,
  //     return_url: origin + '/dashboard/user/account/',
  //   })
  //   res.status(StatusCodes.OK).json(session)

  //   //   case 'invoice.paid':
  //   //     await SubscriptionModel.findOneAndUpdate(
  //   //       {
  //   //         stripeCustomerId: dataObject.customer,
  //   //       },
  //   //       { status: 'active' }
  //   //     )
  //   //     break
  //   //   case 'customer.subscription.updated':
  //   //   case 'customer.subscription.deleted':
  //   //     await SubscriptionModel.findOneAndUpdate(
  //   //       {
  //   //         stripeCustomerId: dataObject.customer,
  //   //       },
  //   //       {
  //   //         status: dataObject.status,
  //   //         plan: dataObject.items.data[0].price.nickname,
  //   //       }
  //   //     )
  //   //     break
  // }),
  getStripePaymentPlans: asyncMiddleware(async (req, res) => {
    const { withPrices } = req.query

    let products

    if (!isEmpty(withPrices) && withPrices === 'true') products = await getAllStripePrices()
    else products = await getAllStripeProducts()

    const sorted = sortByFirstDate(products.data, 'created')
    res.status(StatusCodes.OK).json(sorted)
  }),
  getStripeClientPublishableKey: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.OK).json({
      publishableKey: process.env.STRIPE_PUBLISH_KEY,
    })
  }),
  updateCustomerPaymentMethod: asyncMiddleware(async (req, res) => {
    const { customerId, paymentMethodId } = req.body

    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })

    // For Detaching
    // const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId)

    const customer = await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    res.sendStatus(StatusCodes.OK)
  }),
  createClientSubscription: asyncMiddleware(async (req, res) => {
    const { customerId, priceId } = req.body
    const { sanitizeCompanyName } = req.decodedRoleToken
    // const sanitizeCompanyName = 'uz-ulummky'
    console.log('customerId', customerId)

    // To cancel trial period immediatly
    // stripe.subscriptions.update('sub_49ty4767H20z6a', {
    //   trial_end: 'now',
    // });
    // const endDate = new Date(Date.now())
    // endDate.setDate(endDate.getDate() + 14)

    const subscriptionDoc = await Subscription.findOne({ sanitizeCompanyName })
    console.log('subscriptionDoc', subscriptionDoc)

    let trialPeriodDays = 14
    if (!isEmpty(subscriptionDoc)) {
      const { stripeSubscription, trialDaysCanceledRemaining, inTrial } = subscriptionDoc
      trialPeriodDays = trialDaysCanceledRemaining
    }
    // const trialEnd =
    //   trialDaysCanceledRemaining === 0
    //     ? 'now'
    //     : Math.floor(new Date(Date.now() + trialDaysCanceledRemaining * 24 * 60 * 60 * 1000).getTime() / 1000)

    // subscription = await stripe.subscriptions.update(stripeSubscription, {
    //   items: [
    //     {
    //       price: priceId,
    //     },
    //   ],
    //   expand: ['latest_invoice.payment_intent'],
    //   trial_end: trialEnd,
    // })
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        sanitizeCompanyName,
      },
      // trial_end: 1610403705, // to enable trial period of this subscription
      trial_period_days: trialPeriodDays,
    })

    console.log('STRIPE subscription', subscription)
    const trialEnd = subscription?.trial_end === null ? null : new Date(subscription?.trial_end * 1000)
    console.log('Trial END', trialEnd)

    res.status(StatusCodes.CREATED).json({
      subscriptionId: subscription.id,
      clientSecret: subscription?.latest_invoice?.payment_intent?.client_secret,
      status: subscription.status,
      // trialEnd,
      // subscription,
    })
  }),
  endClientTrialSubscription: asyncMiddleware(async (req, res) => {
    const { customerId, subscriptionId } = req.body
    const { sanitizeCompanyName } = req.decodedRoleToken
    // const sanitizeCompanyName = 'uz-ulummky'
    console.log('customerId', customerId)

    const userSubscriptions = await stripe.subscriptions.list({
      // limit: 3,
      customer: customerId,
      // status: 'canceled' || 'trialing',
    })

    console.log('userSubscriptions', userSubscriptions)
    // To cancel trial period immediatly
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      trial_end: 'now',
    })
    // const endDate = new Date(Date.now())
    // endDate.setDate(endDate.getDate() + 14)

    // console.log('subscription', subscription)
    res.status(StatusCodes.CREATED).json({
      subscriptionUpdated: updatedSubscription,
      // clientSecret: updatedSubscription?.latest_invoice?.payment_intent?.client_secret,
      subscriptionStatus: updatedSubscription.status,
      userSubscriptions,
      // trial_end: !isEmpty(subscription?.trial_end) ? new Date(subscription?.trial_end * 1000) : null,
    })
  }),
  // TODO USER CANCELS SUBSCRIPTION
  // app.post('/cancel-subscription', async (req, res) => {
  //   // Delete the subscription
  //   const deletedSubscription = await stripe.subscriptions.del(
  //     req.body.subscriptionId
  //   );
  //   res.send(deletedSubscription);
  // });
  // TODO USER CHANGES PLAN
  // app.post('/update-subscription', async (req, res) => {
  //   const subscription = await stripe.subscriptions.retrieve(
  //     req.body.subscriptionId
  //   );
  //   const updatedSubscription = await stripe.subscriptions.update(
  //     req.body.subscriptionId,
  //     {
  //       cancel_at_period_end: false,
  //       items: [
  //         {
  //           id: subscription.items.data[0].id,
  //           price: "price_H1NlVtpo6ubk0m",
  //         },
  //       ],
  //     }
  //   );

  //   res.send(updatedSubscription);
  // });
  sendPaymentIntentClientSecret: asyncMiddleware(async (req, res) => {
    const { plan, email, customer } = req.body
    const paymentIntent = await createStripePaymentIntent({ plan, email, customer })
    res.status(StatusCodes.CREATED).json(paymentIntent.client_secret)
  }),
  stripeWebhookSecure: asyncMiddleware(async (req, res) => {
    let event = req.body
    const signature = req.header('Stripe-Signature')
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret)
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`, err.message)
      return res.status(StatusCodes.BAD_REQUEST).send(`Webhook error: ${err.message} `)
    }

    const dataObject = event.data.object

    switch (event.type) {
      case 'customer.subscription.deleted':
        console.log('🔔Customer subscription deleted', dataObject)
        // endDate: dataObject.ended_at
        if (event.req != null) {
          console.log(`🔔  Subscription cancelled Manually`)

          // handle a subscription cancelled by your request
          // from above.
          // await SubscriptionModel.findOneAndUpdate(
          //       {
          //         stripeCustomerId: dataObject.customer,
          //       },
          //       {
          //         status: dataObject.status,
          //         plan: dataObject.items.data[0].price.nickname,
          //       }
          //     )
        } else {
          console.log(`🔔  Subscription cancelled Automatically`)

          // handle subscription cancelled automatically based
          // upon your subscription settings.
          // await SubscriptionModel.findOneAndUpdate(
          //       {
          //         stripeCustomerId: dataObject.customer,
          //       },
          //       {
          //         status: dataObject.status,
          //         plan: dataObject.items.data[0].price.nickname,
          //       }
          //     )
        }
        await webhook_CustomerSubscriptionDeleted(dataObject)

        break

      // case 'customer.subscription.trial_will_end':
      // Trial will be expired soon in 3 days
      // await webhook_CustomerSubscriptionTrialCreated(dataObject)
      // break

      case 'customer.subscription.created':
        if (dataObject.status === 'trialing') await webhook_CustomerSubscriptionTrialCreated(dataObject)

        break
      case 'customer.subscription.updated':
        // IF CUSTOMER CANCELS AN ONGOING SUBSCRIPTION, THIS EVENT WILL BE FIRED ONLY

        console.log('🔔Customer subscription updated', dataObject)
        if (event.data.previous_attributes.status === 'incomplete') {
          console.log('🔔Customer subscription first time status updated')
          // return null
        }

        // await SubscriptionModel.findOneAndUpdate(
        //       {
        //         stripeCustomerId: dataObject.customer,
        //       },
        //       {
        //         status: dataObject.status,
        //         plan: dataObject.items.data[0].price.nickname,
        //       }
        //     )
        await webhook_CustomerSubscriptionUpdated(dataObject)

        break

      case 'checkout.session.completed':
        console.log(`🔔  Stripe session completed`)
        if (dataObject.payment_status === 'paid') {
          console.log(`🔔  Stripe session Payment received!`, dataObject)

          if (dataObject.mode === 'subscription') {
            await webhook_updateUserSubscriptionPaymentStatus(dataObject)
          }
        }

        break

      // TODO payment_intent.succeeded
      // TODO charge.succeeded

      // TODO
      case 'payment_intent.payment_failed': {
        console.log(`🔔  Stripe session Payment failed!`)
        // either card declines or insufficient amount
        // Send an email to the customer asking them to retry their order
        // emailCustomerAboutFailedPayment(session);
        break
      }

      case 'invoice.payment_succeeded':
        console.log('invoice.payment_succeeded', dataObject)

        if (dataObject['billing_reason'] == 'subscription_update') {
          console.log('🔔 invoice on subscription update', dataObject)
          if (dataObject.paid) await webhook_sendInvoicePaidEmail(dataObject)
        }

        if (dataObject['billing_reason'] == 'subscription_create') {
          const subscription_id = dataObject['subscription']
          const payment_intent_id = dataObject['payment_intent']

          if (payment_intent_id !== null) {
            console.log('🔔 invoice payment_succeeded', dataObject)
            if (dataObject.paid) await webhook_sendInvoicePaidEmail(dataObject)

            const payment_intent = await stripe.paymentIntents.retrieve(payment_intent_id)
            if (!isEmpty(payment_intent)) {
              const subscription = await stripe.subscriptions.update(subscription_id, {
                default_payment_method: payment_intent.payment_method,
              })
            }
          }
          //? Trial period subscription added, setupIntent created, no need to send invoice paid email or update subscription with payment intent
        }

        break

      // TODO
      case 'invoice.payment_failed':
        console.log(`🔔  Customer card verification failed`)
        // If the payment fails or the customer does not have a valid payment method,
        //  an invoice.payment_failed event is sent, the subscription becomes past_due.
        // Use this webhook to notify your user that their payment has
        // failed and to retrieve new card details.
        break
      default:
        // Unexpected event type
        console.log(`⚠️ Unhandled event type ${event.type}.`)
    }
    // Return a 200 response to acknowledge receipt of the event
    res.sendStatus(StatusCodes.OK)
  }),
}
