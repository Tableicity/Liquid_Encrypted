import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building2, ArrowLeft, Loader2 } from "lucide-react";

const createOrgSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  slug: z.string().min(2, "Slug must be at least 2 characters").max(50)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
});

type CreateOrgData = z.infer<typeof createOrgSchema>;

interface CreateOrganizationProps {
  onNavigate: (page: string) => void;
  onOrgCreated: (org: { id: string; name: string; slug: string; type: string }) => void;
}

export default function CreateOrganization({ onNavigate, onOrgCreated }: CreateOrganizationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateOrgData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const watchName = form.watch("name");

  const createMutation = useMutation({
    mutationFn: async (data: CreateOrgData) => {
      const res = await apiRequest("POST", "/api/organizations", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({
        title: "Organization Created",
        description: `${data.organization.name} is ready to use.`,
      });
      onOrgCreated(data.organization);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Organization",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateSlug = () => {
    const slug = watchName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    form.setValue("slug", slug);
  };

  return (
    <div className="max-w-xl mx-auto">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => onNavigate("dashboard")}
        data-testid="button-back-dashboard"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            <div>
              <CardTitle data-testid="text-create-org-title">Create Organization</CardTitle>
              <CardDescription>
                Production organizations let you collaborate with team members and manage documents separately from your sandbox.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Acme Corp"
                        data-testid="input-org-name"
                        {...field}
                        onBlur={() => {
                          field.onBlur();
                          if (!form.getValues("slug")) {
                            generateSlug();
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="acme-corp"
                        data-testid="input-org-slug"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Unique identifier used in URLs. Only lowercase letters, numbers, and hyphens.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
                data-testid="button-create-org"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4 mr-2" />
                    Create Organization
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
