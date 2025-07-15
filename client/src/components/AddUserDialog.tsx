import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { userRoles } from "@shared/schema";

const addUserSchema = z.object({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  section: z.string().min(1, "القسم مطلوب"),
  password: z.string().min(6, "كلمة المرور مطلوبة (6 أحرف على الأقل)"),
  phoneNumber: z.string().optional(),
  role: z.enum(userRoles).default("user"),
});

type AddUserFormData = z.infer<typeof addUserSchema>;

interface AddUserDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AddUserDialog({ open, onClose }: AddUserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      username: "",
      section: "",
      password: "",
      phoneNumber: "",
      role: "user",
    },
  });

  const handleSubmit = async (data: AddUserFormData) => {
    try {
      await apiRequest("POST", "/api/users", data);
      toast({
        title: "تم إنشاء المستخدم",
        description: "تم إنشاء المستخدم بنجاح.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      form.reset();
      onClose();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء المستخدم",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">إنشاء مستخدم جديد</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم المستخدم</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="اسم المستخدم" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="section"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>القسم</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="القسم" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>كلمة المرور</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} placeholder="كلمة المرور" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم الهاتف (اختياري)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="+1-555-0101" />
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
                          <SelectItem key={role} value={role}>{role}</SelectItem>
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
              <Button type="submit">إنشاء المستخدم</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 