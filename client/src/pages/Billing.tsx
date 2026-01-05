import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Calendar, HardDrive, Check, AlertTriangle, ArrowUpRight, X } from "lucide-react";
import { format } from "date-fns";

let stripePromise: Promise<Stripe | null> | null = null;

interface SubscriptionDetails {
  id: string;
  status: string;
  planId: string;
  billingCycle: string;
  basePrice: string;
  storageAddonGb: number;
  storageAddonPrice: string;
  totalPrice: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan?: {
    id: string;
    name: string;
    planType: string;
    storageBaseGb: number;
    maxDocuments: number | null;
    supportLevel: string;
    features: string[];
    monthlyPrice: string;
  };
}

interface SubscriptionPlan {
  id: string;
  name: string;
  planType: string;
  monthlyPrice: string;
  storageBaseGb: number;
  features: string[];
}

interface StorageInfo {
  usedGb: number;
  allocatedGb: number;
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
}

function UpdatePaymentForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const updatePaymentMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const res = await apiRequest("POST", "/api/subscriptions/update-payment", { paymentMethodId });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment Method Updated",
        description: "Your payment method has been updated successfully.",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: window.location.origin,
      },
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    if (setupIntent?.payment_method) {
      const paymentMethodId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;
      updatePaymentMutation.mutate(paymentMethodId);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || isProcessing} data-testid="button-confirm-payment-update">
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            "Update Payment Method"
          )}
        </Button>
      </div>
    </form>
  );
}

export default function Billing() {
  const { toast } = useToast();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);

  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery<{
    subscription: SubscriptionDetails | null;
  }>({
    queryKey: ["/api/subscriptions/current"],
  });

  const { data: storageData, isLoading: storageLoading } = useQuery<StorageInfo>({
    queryKey: ["/api/storage/usage"],
  });

  const { data: plansData, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscriptions/cancel", {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
      setShowCancelDialog(false);
      toast({
        title: "Subscription Canceled",
        description: `Your subscription will end on ${format(new Date(data.canceledAt), "MMM d, yyyy")}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setupPaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscriptions/update-payment-setup", {});
      return await res.json();
    },
    onSuccess: (data) => {
      setPaymentClientSecret(data.clientSecret);
      setShowPaymentDialog(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenPaymentDialog = () => {
    setupPaymentMutation.mutate();
  };

  const handlePaymentSuccess = () => {
    setShowPaymentDialog(false);
    setPaymentClientSecret(null);
    queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
  };

  if (subscriptionLoading || storageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-spinner" />
      </div>
    );
  }

  const subscription = subscriptionData?.subscription;

  if (!subscription) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Billing & Subscription</h1>
          <p className="text-muted-foreground">Manage your subscription and billing</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
            <p className="text-muted-foreground text-center mb-4">
              You don't have an active subscription. Subscribe to a plan to start using Liquid Encrypt.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-600 border-green-500/20",
    canceling: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    canceled: "bg-red-500/10 text-red-600 border-red-500/20",
    past_due: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    trialing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  const storagePercentUsed = storageData?.percentUsed || 0;
  const storageUsedGb = storageData?.usedGb || 0;
  const storageTotalGb = storageData?.allocatedGb || subscription.plan?.storageBaseGb || 0;

  const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  if (stripePublishableKey && !stripePromise) {
    stripePromise = loadStripe(stripePublishableKey);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and billing</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-current-plan">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Plan
              </CardTitle>
              <Badge className={statusColors[subscription.status] || ""} data-testid="badge-subscription-status">
                {subscription.status === "active" && <Check className="w-3 h-3 mr-1" />}
                {subscription.status === "canceling" && <AlertTriangle className="w-3 h-3 mr-1" />}
                {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </Badge>
            </div>
            <CardDescription>Your subscription details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-xl font-bold" data-testid="text-plan-name">
                {subscription.plan?.name || "Unknown Plan"}
              </h3>
              <p className="text-muted-foreground capitalize">
                {subscription.billingCycle} billing
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Price</span>
                <span data-testid="text-base-price">${parseFloat(subscription.basePrice).toFixed(2)}/mo</span>
              </div>
              {subscription.storageAddonGb > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage Add-on ({subscription.storageAddonGb} GB)</span>
                  <span>${parseFloat(subscription.storageAddonPrice).toFixed(2)}/mo</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span data-testid="text-total-price">${parseFloat(subscription.totalPrice).toFixed(2)}/mo</span>
              </div>
            </div>

            {(subscription.cancelAtPeriodEnd || subscription.status === "canceling") && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
                <p className="text-sm text-yellow-600">
                  Your subscription will be canceled at the end of the current billing period.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenPaymentDialog}
              disabled={setupPaymentMutation.isPending}
              data-testid="button-update-payment"
            >
              {setupPaymentMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              Update Payment
            </Button>
            {subscription.status === "active" && !subscription.cancelAtPeriodEnd && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                className="text-destructive hover:text-destructive"
                data-testid="button-cancel-subscription"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel Subscription
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card data-testid="card-billing-period">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Billing Period
            </CardTitle>
            <CardDescription>Current billing cycle information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period Start</span>
                <span data-testid="text-period-start">
                  {format(new Date(subscription.currentPeriodStart), "MMM d, yyyy")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period End</span>
                <span data-testid="text-period-end">
                  {format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Invoice</span>
                <span data-testid="text-next-invoice">
                  {subscription.cancelAtPeriodEnd || subscription.status === "canceling"
                    ? "N/A (Canceled)" 
                    : format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-storage-usage">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Storage Usage
          </CardTitle>
          <CardDescription>Your encrypted storage consumption</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{storageUsedGb.toFixed(2)} GB used</span>
              <span>{storageTotalGb} GB total</span>
            </div>
            <Progress 
              value={storagePercentUsed} 
              className={storagePercentUsed > 90 ? "bg-red-100" : ""} 
              data-testid="progress-storage"
            />
            <p className="text-xs text-muted-foreground">
              {storagePercentUsed.toFixed(1)}% of your storage quota used
            </p>
          </div>

          {storagePercentUsed > 80 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
              <p className="text-sm text-yellow-600">
                You're running low on storage. Consider upgrading your plan or adding more storage.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {!plansLoading && plansData && plansData.length > 0 && (
        <Card data-testid="card-available-plans">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5" />
              Available Plans
            </CardTitle>
            <CardDescription>Compare and upgrade your subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {plansData.map((plan) => {
                const isCurrentPlan = subscription.plan?.id === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-lg border ${isCurrentPlan ? "border-primary bg-primary/5" : "border-border"}`}
                    data-testid={`plan-card-${plan.planType}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{plan.name}</h4>
                      {isCurrentPlan && (
                        <Badge variant="default" className="text-xs">Current</Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold mb-2">
                      ${parseFloat(plan.monthlyPrice).toFixed(2)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    <p className="text-sm text-muted-foreground mb-3">
                      {plan.storageBaseGb} GB storage
                    </p>
                    <ul className="space-y-1">
                      {plan.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                      {plan.features.length > 3 && (
                        <li className="text-sm text-muted-foreground">
                          +{plan.features.length - 3} more features
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {subscription.plan?.features && subscription.plan.features.length > 0 && (
        <Card data-testid="card-plan-features">
          <CardHeader>
            <CardTitle>Plan Features</CardTitle>
            <CardDescription>What's included in your {subscription.plan.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 md:grid-cols-2">
              {subscription.plan.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription? You'll continue to have access until the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Canceling...
                </>
              ) : (
                "Cancel Subscription"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Payment Method</DialogTitle>
            <DialogDescription>
              Enter your new payment details below.
            </DialogDescription>
          </DialogHeader>
          {paymentClientSecret && stripePromise && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: paymentClientSecret,
                appearance: { theme: "stripe" },
              }}
            >
              <UpdatePaymentForm
                onSuccess={handlePaymentSuccess}
                onCancel={() => setShowPaymentDialog(false)}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
