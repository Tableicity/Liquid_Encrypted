import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, Lock } from "lucide-react";

// Stripe promise will be initialized after fetching the publishable key from backend
let stripePromise: Promise<Stripe | null> | null = null;

interface SubscriptionPlan {
  id: string;
  name: string;
  planType: string;
  monthlyPrice: string;
  storageBaseGb: number;
  storageAddonGb: number;
  features: string[];
  isPopular?: boolean;
}

interface SubscribeProps {
  onSuccess: () => void;
}

function PaymentMethodForm({
  selectedPlanId,
  onSuccess,
}: {
  selectedPlanId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const createSubscriptionMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const res = await apiRequest("POST", "/api/subscriptions/create", {
        planId: selectedPlanId,
        paymentMethodId,
      });
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
      toast({
        title: "Subscription Activated!",
        description: "Your subscription is now active. Redirecting...",
      });
      // Force a full page reload to ensure all UI elements refresh properly
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Subscription Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

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
        title: "Payment Method Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    if (setupIntent?.payment_method) {
      const paymentMethodId =
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method.id;
      createSubscriptionMutation.mutate(paymentMethodId);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || isProcessing}
        data-testid="button-confirm-payment"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {createSubscriptionMutation.isPending ? "Activating Subscription..." : "Processing..."}
          </>
        ) : (
          "Confirm Subscription"
        )}
      </Button>
    </form>
  );
}

function PaymentMethodWrapper({
  clientSecret,
  selectedPlanId,
  onSuccess,
}: {
  clientSecret: string;
  selectedPlanId: string;
  onSuccess: () => void;
}) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Complete Your Subscription</CardTitle>
          <CardDescription>Enter your payment details to activate your plan</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentMethodForm selectedPlanId={selectedPlanId} onSuccess={onSuccess} />
        </CardContent>
      </Card>
    </Elements>
  );
}

export default function Subscribe({ onSuccess }: SubscribeProps) {
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);

  // Fetch Stripe configuration from backend
  const { data: stripeConfig, isLoading: stripeConfigLoading } = useQuery<{ publishableKey: string }>({
    queryKey: ["/api/config/stripe"],
  });

  // Initialize Stripe with the publishable key from backend
  useEffect(() => {
    if (stripeConfig?.publishableKey && !stripePromise) {
      stripePromise = loadStripe(stripeConfig.publishableKey);
    }
  }, [stripeConfig]);

  // Check for existing subscription (don't block if this fails)
  const { data: currentSubscription } = useQuery<{
    subscription: {
      status: string;
      plan?: { name: string };
      storageQuota: number;
      currentPeriodEnd: string;
    } | null;
  }>({
    queryKey: ["/api/subscriptions/current"],
    retry: false,
    staleTime: 0, // Always refetch to get latest status
  });

  const { data: plans, isLoading: plansLoading, error: plansError } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscriptions/plans"],
  });

  const createSetupIntentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscriptions/setup-intent", {});
      return await res.json();
    },
    onSuccess: (data) => {
      setSetupClientSecret(data.clientSecret);
      toast({
        title: "Ready for Payment",
        description: "Please enter your payment method to continue",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive",
      });
      setSelectedPlanId(null);
    },
  });

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    createSetupIntentMutation.mutate();
  };

  // Show active subscription status if user already has one
  if (currentSubscription?.subscription?.status === "active") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <Check className="w-12 h-12 text-green-500" />
            </div>
            <CardTitle className="text-center text-2xl">Subscription Active</CardTitle>
            <CardDescription className="text-center">
              You already have an active subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-semibold">
                {currentSubscription.subscription.plan?.name || "Current Plan"}
              </p>
              <p className="text-muted-foreground mt-2">
                Storage: {currentSubscription.subscription.storageQuota} GB
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Renews: {new Date(currentSubscription.subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => window.history.back()}>
              Go Back
            </Button>
            <Button className="flex-1" onClick={onSuccess}>
              Continue to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (plansLoading || stripeConfigLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show error if plans failed to load
  if (plansError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to Load Plans</CardTitle>
            <CardDescription>
              Unable to fetch subscription plans. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Error: {plansError instanceof Error ? plansError.message : "Unknown error"}
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => window.location.reload()} className="w-full">
              Reload Page
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Show message if no plans available
  if (!plans || plans.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <CardTitle>No Plans Available</CardTitle>
            <CardDescription>
              There are currently no subscription plans available. Please check back later.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => window.location.reload()} className="w-full">
              Reload Page
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (setupClientSecret && selectedPlanId) {
    return (
      <div className="min-h-screen p-8">
        <PaymentMethodWrapper
          clientSecret={setupClientSecret}
          selectedPlanId={selectedPlanId}
          onSuccess={onSuccess}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Lock className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Choose Your Plan</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Select the perfect plan for your secure document storage needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans?.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${
                plan.planType === "business" ? "border-primary shadow-lg scale-105" : ""
              }`}
              data-testid={`card-plan-${plan.planType}`}
            >
              {plan.planType === "business" && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" data-testid="badge-popular">
                  Most Popular
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">
                      ${parseFloat(plan.monthlyPrice).toFixed(0)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span>
                      {plan.storageBaseGb} GB secure storage
                      {plan.storageAddonGb > 0 && ` + ${plan.storageAddonGb} GB bonus`}
                    </span>
                  </div>
                  {plan.planType === "personal" && (
                    <>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>AES-256 encryption</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>8-fragment distribution</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Story-based authentication</span>
                      </div>
                    </>
                  )}
                  {plan.planType === "business" && (
                    <>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Everything in Personal</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Priority support</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Advanced analytics</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Team collaboration</span>
                      </div>
                    </>
                  )}
                  {plan.planType === "enterprise" && (
                    <>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Everything in Business</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Custom storage limits</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Dedicated support</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>SLA guarantee</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        <span>Custom integrations</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.planType === "business" ? "default" : "outline"}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={createSetupIntentMutation.isPending && selectedPlanId === plan.id}
                  data-testid={`button-select-${plan.planType}`}
                >
                  {createSetupIntentMutation.isPending && selectedPlanId === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    `Select ${plan.name}`
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>All plans include quantum-resistant encryption and story-based authentication</p>
          <p className="mt-2">30-day money-back guarantee • Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}
