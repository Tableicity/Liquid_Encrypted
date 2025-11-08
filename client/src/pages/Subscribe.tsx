import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, Lock } from "lucide-react";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error("Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY");
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

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

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "?payment=success",
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    } else {
      toast({
        title: "Payment Successful",
        description: "You are now subscribed!",
      });
      onSuccess();
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
            Processing...
          </>
        ) : (
          "Confirm Subscription"
        )}
      </Button>
    </form>
  );
}

function CheckoutWrapper({ clientSecret, onSuccess }: { clientSecret: string; onSuccess: () => void }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Complete Your Subscription</CardTitle>
          <CardDescription>Enter your payment details to activate your plan</CardDescription>
        </CardHeader>
        <CardContent>
          <CheckoutForm onSuccess={onSuccess} />
        </CardContent>
      </Card>
    </Elements>
  );
}

export default function Subscribe({ onSuccess }: SubscribeProps) {
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscriptions/plans"],
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiRequest("POST", "/api/subscriptions/create", { planId });
      return await res.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      toast({
        title: "Subscription created",
        description: "Please complete your payment",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create subscription",
        description: error.message,
        variant: "destructive",
      });
      setSelectedPlanId(null);
    },
  });

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    createSubscriptionMutation.mutate(planId);
  };

  if (plansLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (clientSecret) {
    return (
      <div className="min-h-screen p-8">
        <CheckoutWrapper clientSecret={clientSecret} onSuccess={onSuccess} />
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
                  disabled={createSubscriptionMutation.isPending && selectedPlanId === plan.id}
                  data-testid={`button-select-${plan.planType}`}
                >
                  {createSubscriptionMutation.isPending && selectedPlanId === plan.id ? (
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
