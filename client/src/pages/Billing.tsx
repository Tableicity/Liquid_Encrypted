import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Loader2, CreditCard, Calendar, HardDrive, Check, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

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
    name: string;
    planType: string;
    storageBaseGb: number;
    maxDocuments: number | null;
    supportLevel: string;
    features: string[];
  };
}

interface StorageInfo {
  usedGb: number;
  allocatedGb: number;
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
}

export default function Billing() {
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery<{
    subscription: SubscriptionDetails | null;
  }>({
    queryKey: ["/api/subscriptions/current"],
  });

  const { data: storageData, isLoading: storageLoading } = useQuery<StorageInfo>({
    queryKey: ["/api/storage/usage"],
  });

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
    canceled: "bg-red-500/10 text-red-600 border-red-500/20",
    past_due: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    trialing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  const storagePercentUsed = storageData?.percentUsed || 0;
  const storageUsedGb = storageData?.usedGb || 0;
  const storageTotalGb = storageData?.allocatedGb || subscription.plan?.storageBaseGb || 0;

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

            {subscription.cancelAtPeriodEnd && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
                <p className="text-sm text-yellow-600">
                  Your subscription will be canceled at the end of the current billing period.
                </p>
              </div>
            )}
          </CardContent>
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
                  {subscription.cancelAtPeriodEnd 
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

      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>Contact support for billing questions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            For billing inquiries, plan changes, or cancellation requests, please contact our support team.
          </p>
          <Button variant="outline" data-testid="button-contact-support">
            Contact Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
