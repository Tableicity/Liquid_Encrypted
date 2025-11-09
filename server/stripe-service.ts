// Stripe service for subscription management - uses blueprint:javascript_stripe
import Stripe from "stripe";
import type { IStorage } from "./storage";
import type { User } from "@shared/schema";
import { createAuditLog } from "./utils/auditLog";

// Use TESTING keys in development, LIVE keys in production
const isTestMode = process.env.NODE_ENV !== "production";
const stripeSecretKey = isTestMode 
  ? (process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)
  : process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(`Missing required Stripe secret: ${isTestMode ? "TESTING_STRIPE_SECRET_KEY" : "STRIPE_SECRET_KEY"}`);
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-11-20.acacia",
});

export class StripeService {
  constructor(private storage: IStorage) {}

  /**
   * Get or create a Stripe customer for a user
   */
  async getOrCreateCustomer(user: User): Promise<string> {
    // Return existing customer if already created
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullName || undefined,
      metadata: {
        userId: user.id,
      },
    });

    // Update user with Stripe customer ID
    await this.storage.updateUser(user.id, {
      stripeCustomerId: customer.id,
    });

    return customer.id;
  }

  /**
   * Create a SetupIntent for collecting payment method
   * Step 1 of two-step subscription flow
   */
  async createSetupIntent(userId: string): Promise<{ clientSecret: string }> {
    const user = await this.storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Ensure user has a Stripe customer ID
    const customerId = await this.getOrCreateCustomer(user);

    // Create SetupIntent to collect payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        userId: user.id,
      },
    });

    if (!setupIntent.client_secret) {
      throw new Error("SetupIntent has no client_secret");
    }

    // Create comprehensive audit log
    await createAuditLog(this.storage, {
      actorId: userId,
      actorEmail: user.email,
      actorRole: user.role,
      action: "SETUP_INTENT_CREATED",
      resourceType: "payment_method",
      resourceId: setupIntent.id,
      result: "success",
      metadata: {
        customerId,
        message: "SetupIntent created for payment method collection",
      }
    });

    return {
      clientSecret: setupIntent.client_secret,
    };
  }

  /**
   * Create a subscription for a user with a specific plan and payment method
   * Step 2 of two-step subscription flow (after SetupIntent completes)
   */
  async createSubscription(
    userId: string,
    planId: string,
    paymentMethodId: string
  ): Promise<{ subscriptionId: string }> {
    const user = await this.storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const plan = await this.storage.getSubscriptionPlan(planId);
    if (!plan) {
      throw new Error("Subscription plan not found");
    }

    // Ensure user has a Stripe customer ID
    const customerId = await this.getOrCreateCustomer(user);

    // Check if user already has an active subscription
    const existingSubscription = await this.storage.getSubscriptionByUserId(userId);
    if (existingSubscription && existingSubscription.status === "active") {
      throw new Error("User already has an active subscription");
    }

    // Attach payment method to customer and set as default
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create Stripe Price
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: Math.round(parseFloat(plan.monthlyPrice) * 100), // Convert to cents
      recurring: {
        interval: "month",
      },
      product_data: {
        name: plan.name,
      },
    });

    // Create subscription with the payment method already attached
    // Stripe will automatically charge it and activate the subscription
    console.log("[DEBUG] Creating subscription with planId:", planId, "price:", price.id);
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      default_payment_method: paymentMethodId,
      expand: ["latest_invoice.payment_intent"],
    });

    console.log("[DEBUG] Stripe subscription created:", {
      id: stripeSubscription.id,
      status: stripeSubscription.status,
      current_period_start: stripeSubscription.current_period_start,
      current_period_end: stripeSubscription.current_period_end,
      hasCurrentPeriodStart: !!stripeSubscription.current_period_start,
      hasCurrentPeriodEnd: !!stripeSubscription.current_period_end,
    });

    // Calculate period dates - with validation
    const periodStartTimestamp = stripeSubscription.current_period_start;
    const periodEndTimestamp = stripeSubscription.current_period_end;
    
    if (!periodStartTimestamp || !periodEndTimestamp) {
      throw new Error("Subscription period dates not set by Stripe");
    }
    
    const currentPeriodStart = new Date(periodStartTimestamp * 1000);
    const currentPeriodEnd = new Date(periodEndTimestamp * 1000);
    
    // Validate dates are valid
    if (isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
      throw new Error("Invalid subscription period dates from Stripe");
    }

    // Determine initial status - should be "active" if payment succeeds immediately
    const initialStatus = stripeSubscription.status === "active" ? "active" : "incomplete";

    // Create subscription record in our database
    await this.storage.createSubscription({
      userId,
      planId,
      stripeSubscriptionId: stripeSubscription.id,
      status: initialStatus,
      currentPeriodStart,
      currentPeriodEnd,
      basePrice: plan.monthlyPrice,
      totalPrice: plan.monthlyPrice,
      billingCycle: "monthly",
    });

    // Create comprehensive audit log
    await createAuditLog(this.storage, {
      actorId: userId,
      actorEmail: user.email,
      actorRole: user.role,
      action: "SUBSCRIPTION_CREATED",
      resourceType: "subscription",
      resourceId: stripeSubscription.id,
      result: "success",
      metadata: {
        planId,
        planName: plan.name,
        price: plan.monthlyPrice,
        billingCycle: "monthly",
        initialStatus,
      }
    });

    return {
      subscriptionId: stripeSubscription.id,
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async handleSubscriptionUpdate(stripeSubscription: Stripe.Subscription): Promise<void> {
    const customerId = stripeSubscription.customer as string;
    
    // Find user by Stripe customer ID - need to iterate since we don't have getUserByStripeCustomerId
    const allUsers = await this.storage.getAllUsers();
    const user = allUsers.find((u: User) => u.stripeCustomerId === customerId);

    if (!user) {
      console.error(`User not found for Stripe customer ${customerId}`);
      return;
    }

    const subscription = await this.storage.getSubscriptionByUserId(user.id);
    if (!subscription) {
      console.error(`Subscription not found for user ${user.id}`);
      return;
    }

    const currentPeriodStart = new Date((stripeSubscription as any).current_period_start * 1000);
    const currentPeriodEnd = new Date((stripeSubscription as any).current_period_end * 1000);

    await this.storage.updateSubscription(subscription.id, {
      status: stripeSubscription.status,
      currentPeriodStart,
      currentPeriodEnd,
    });
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const customerId = stripeSubscription.customer as string;
    
    const allUsers = await this.storage.getAllUsers();
    const user = allUsers.find((u: User) => u.stripeCustomerId === customerId);

    if (!user) {
      console.error(`User not found for Stripe customer ${customerId}`);
      return;
    }

    const subscription = await this.storage.getSubscriptionByUserId(user.id);
    if (!subscription) {
      console.error(`Subscription not found for user ${user.id}`);
      return;
    }

    await this.storage.updateSubscription(subscription.id, {
      status: "canceled",
    });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    
    const allUsers = await this.storage.getAllUsers();
    const user = allUsers.find((u: User) => u.stripeCustomerId === customerId);

    if (!user) {
      console.error(`User not found for Stripe customer ${customerId}`);
      return;
    }

    const subscription = await this.storage.getSubscriptionByUserId(user.id);

    // Record payment in payments table
    await this.storage.createPayment({
      userId: user.id,
      subscriptionId: subscription?.id || null,
      stripePaymentIntentId: ((invoice as any).payment_intent as string) || null,
      status: "succeeded",
      amount: (invoice.amount_paid / 100).toFixed(2), // Convert from cents
      currency: invoice.currency || "usd",
    });

    // Update subscription status to active
    if (subscription) {
      await this.storage.updateSubscription(subscription.id, {
        status: "active",
      });
    }

    // Create comprehensive audit log
    await createAuditLog(this.storage, {
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "PAYMENT_SUCCEEDED",
      resourceType: "payment",
      resourceId: invoice.id,
      result: "success",
      metadata: {
        amount: (invoice.amount_paid / 100).toFixed(2),
        currency: invoice.currency,
        subscriptionId: subscription?.id,
        source: "stripe_webhook",
      }
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    
    const allUsers = await this.storage.getAllUsers();
    const user = allUsers.find((u: User) => u.stripeCustomerId === customerId);

    if (!user) {
      console.error(`User not found for Stripe customer ${customerId}`);
      return;
    }

    const subscription = await this.storage.getSubscriptionByUserId(user.id);

    // Record failed payment
    await this.storage.createPayment({
      userId: user.id,
      subscriptionId: subscription?.id || null,
      stripePaymentIntentId: ((invoice as any).payment_intent as string) || null,
      status: "failed",
      amount: (invoice.amount_due / 100).toFixed(2),
      currency: invoice.currency || "usd",
    });

    // Update subscription status
    if (subscription) {
      await this.storage.updateSubscription(subscription.id, {
        status: "past_due",
      });
    }

    // Create comprehensive audit log
    await createAuditLog(this.storage, {
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "PAYMENT_FAILED",
      resourceType: "payment",
      resourceId: invoice.id,
      result: "failure",
      metadata: {
        amount: (invoice.amount_due / 100).toFixed(2),
        currency: invoice.currency,
        subscriptionId: subscription?.id,
        source: "stripe_webhook",
      }
    });
  }
}
