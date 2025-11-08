// Stripe service for subscription management - uses blueprint:javascript_stripe
import Stripe from "stripe";
import type { IStorage } from "./storage";
import type { User } from "@shared/schema";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
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
   * Create a subscription for a user with a specific plan
   */
  async createSubscription(
    userId: string,
    planId: string
  ): Promise<{ subscriptionId: string; clientSecret: string }> {
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

    // Create Stripe subscription with setup intent for payment collection
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
    });

    // Calculate period dates - handle incomplete subscriptions
    const currentPeriodStart = (stripeSubscription as any).current_period_start
      ? new Date((stripeSubscription as any).current_period_start * 1000)
      : new Date();
    const currentPeriodEnd = (stripeSubscription as any).current_period_end
      ? new Date((stripeSubscription as any).current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now

    // Create subscription record in our database
    await this.storage.createSubscription({
      userId,
      planId,
      stripeSubscriptionId: stripeSubscription.id,
      status: "pending",
      currentPeriodStart,
      currentPeriodEnd,
      basePrice: plan.monthlyPrice,
      totalPrice: plan.monthlyPrice,
      billingCycle: "monthly",
    });

    // For default_incomplete subscriptions, manually create a payment intent for the invoice
    const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
    
    if (!invoice) {
      throw new Error("No invoice found for subscription");
    }

    // Create a PaymentIntent for the invoice to collect payment upfront
    const paymentIntent = await stripe.paymentIntents.create({
      amount: invoice.amount_due,
      currency: invoice.currency || 'usd',
      customer: customerId,
      metadata: {
        subscriptionId: stripeSubscription.id,
        invoiceId: invoice.id,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    const clientSecret = paymentIntent.client_secret;
    if (!clientSecret) {
      throw new Error("Failed to create payment intent - no client_secret");
    }

    // Create audit log
    await this.storage.createAuditLog({
      userId,
      action: "subscription_created",
      resourceId: stripeSubscription.id,
      details: { planId, planName: plan.name, price: plan.monthlyPrice },
    });

    return {
      subscriptionId: stripeSubscription.id,
      clientSecret,
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

    // Create audit log
    await this.storage.createAuditLog({
      userId: user.id,
      action: "payment_succeeded",
      resourceId: invoice.id,
      details: { amount: (invoice.amount_paid / 100).toFixed(2), currency: invoice.currency },
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

    // Create audit log
    await this.storage.createAuditLog({
      userId: user.id,
      action: "payment_failed",
      resourceId: invoice.id,
      details: { amount: (invoice.amount_due / 100).toFixed(2), currency: invoice.currency },
    });
  }
}
