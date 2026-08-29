import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userRoles } from "@shared/schema";

const assignRoleSchema = z.object({
  userId: z.string().min(1, "المستخدم مطلوب"),
  role: z.enum(userRoles),
});

type AssignRoleFormData = z.infer<typeof assignRoleSchema>;

interface PublicUser {
  id: string;
  name: string;
  group: string;
  groupLabel?: string | null;
  role: string;
}

interface AddUserDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AddUserDialog({ open, onClose }: AddUserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<PublicUser[]>({
    queryKey: ["/api/users"],
    enabled: open,
  });

  const form = useForm<AssignRoleFormData>({
    resolver: zodResolver(assignRoleSchema),
    defaultValues: {
      userId: "",
      role: "user",
    },
  });

  const handleSubmit = async (data: AssignRoleFormData) => {
    try {
      await apiRequest("PATCH", `/api/users/${data.userId}/role`, { role: data.role });
      toast({
        title: "تم تحديث الدور",
        description: "تم تعيين الدور بنجاح.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      form.reset();
      onClose();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في تعيين الدور",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">تعيين دور مستخدم</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المستخدم</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="اختر مستخدماً" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} · {user.groupLabel || user.group}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الدور</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {userRoles.map((role) => (
                          <SelectItem key={role} value={role}>{role === "admin" ? "مدير" : "مستخدم"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button type="submit">حفظ الدور</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
