import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  User,
  Phone,
  Save,
  Send,
  Link2,
  Link2Off,
  Copy,
  CheckCheck,
  Loader2,
} from "lucide-react";
import AddUserDialog from "@/components/AddUserDialog";

export function UserProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    phoneNumber: "",
  });

  const [showAddUser, setShowAddUser] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({ phoneNumber: user.phoneNumber || "" });
    }
  }, [user]);

  // ── Profile update ────────────────────────────────────────────────────────

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("PATCH", "/api/users/profile", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "تم التحديث",
        description: "تم تحديث ملفك الشخصي بنجاح.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل تحديث الملف الشخصي",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  // ── Telegram linking ──────────────────────────────────────────────────────

  const { data: telegramStatus, isLoading: statusLoading } = useQuery<{
    linked: boolean;
    telegramUsername: string | null;
    linkedAt: string | null;
  }>({
    queryKey: ["/api/telegram/status"],
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  const connectMutation = useMutation({
    mutationFn: async (): Promise<{ code: string }> => {
      const res = await apiRequest("POST", "/api/telegram/connect", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل توليد الكود",
        variant: "destructive",
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/telegram/unlink", {});
    },
    onSuccess: () => {
      toast({
        title: "تم إلغاء الربط",
        description: "تم إلغاء ربط حساب تيليغرام بنجاح.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل إلغاء الربط",
        variant: "destructive",
      });
    },
  });

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "تعذر النسخ",
        description: "انسخ الكود يدوياً",
        variant: "destructive",
      });
    }
  };

  if (!user) return <div>يرجى تسجيل الدخول لعرض ملفك الشخصي.</div>;

  const isLinked = telegramStatus?.linked ?? false;
  const pendingCode = connectMutation.data?.code;

  return (
    <div className="max-w-2xl mx-auto mobile-padding py-3 sm:py-6 lg:py-8 space-y-6">
      {/* Admin Add User Button */}
      {user.role === "admin" && (
        <div className="flex justify-end">
          <Button
            onClick={() => setShowAddUser(true)}
            className="bg-primary hover:bg-primary/90"
          >
            إضافة مستخدم
          </Button>
        </div>
      )}

      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            الملف الشخصي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarImage src={(user as any).profileImageUrl || ""} />
              <AvatarFallback className="text-lg">
                {user.username?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold">{user.username}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                الدور: {user.role}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                القسم: {user.section}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input
                  id="username"
                  value={user?.username || ""}
                  readOnly
                  disabled
                  className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">
                  لا يمكن تغيير اسم المستخدم
                </p>
              </div>
              <div>
                <Label htmlFor="section">القسم</Label>
                <Input
                  id="section"
                  value={user?.section || ""}
                  readOnly
                  disabled
                  className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">
                  لا يمكن تغيير القسم
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                رقم الهاتف
              </Label>
              <Input
                id="phoneNumber"
                data-testid="input-phone-number"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value,
                  }))
                }
                placeholder="+966-5X-XXXXXXX"
              />
              <p className="text-xs text-gray-500 mt-1">
                رقم هاتفك سيظهر للسائق عند انضمامك لرحلته
              </p>
            </div>

            <Button
              type="submit"
              data-testid="button-save-profile"
              disabled={updateProfileMutation.isPending}
              className="w-full"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {updateProfileMutation.isPending
                ? "جاري الحفظ..."
                : "حفظ الملف الشخصي"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Telegram card ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-[#2AABEE]" />
            تيليغرام
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </div>
          ) : isLinked ? (
            /* ─── Connected state ─── */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    متصل
                  </span>
                  {telegramStatus?.telegramUsername && (
                    <Badge variant="secondary" className="text-xs">
                      @{telegramStatus.telegramUsername}
                    </Badge>
                  )}
                </div>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0">
                  مرتبط
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ستصلك إشعارات الرحلات تلقائياً على تيليغرام.
              </p>
              <Button
                data-testid="button-unlink-telegram"
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={() => unlinkMutation.mutate()}
                disabled={unlinkMutation.isPending}
              >
                {unlinkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2Off className="h-4 w-4 mr-2" />
                )}
                إلغاء ربط تيليغرام
              </Button>
            </div>
          ) : pendingCode ? (
            /* ─── Code shown, waiting for user to send it to bot ─── */
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-sm text-blue-700 dark:text-blue-400">
                  في انتظار التأكيد
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">الخطوات:</p>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                  <li>افتح تيليغرام وابحث عن البوت</li>
                  <Button variant="outline" asChild>
                    <a
                      href="https://t.me/Nadi_car_bot"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      فتح البوت
                    </a>
                  </Button>
                  <li>
                    اضغط <strong>Start</strong> أو أرسل{" "}
                    <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                      /start
                    </code>
                  </li>
                  <li>أرسل الكود التالي في محادثة البوت:</li>
                </ol>
              </div>

              <div className="flex items-center gap-2">
                <code
                  data-testid="text-verification-code"
                  className="flex-1 text-center text-2xl font-mono font-bold tracking-widest p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600"
                >
                  {pendingCode}
                </code>
                <Button
                  data-testid="button-copy-code"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyCode(pendingCode)}
                  className="shrink-0"
                >
                  {copied ? (
                    <CheckCheck className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                ينتهي الكود خلال 10 دقائق. إذا انتهت الصلاحية، اضغط «ربط
                تيليغرام» مجدداً.
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    connectMutation.reset();
                    queryClient.invalidateQueries({
                      queryKey: ["/api/telegram/status"],
                    });
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  data-testid="button-refresh-status"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    queryClient.invalidateQueries({
                      queryKey: ["/api/telegram/status"],
                    })
                  }
                >
                  تحقق من الاتصال
                </Button>
              </div>
            </div>
          ) : (
            /* ─── Disconnected state ─── */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    غير متصل
                  </span>
                </div>
                <Badge variant="outline" className="text-xs text-gray-500">
                  غير مرتبط
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                اربط حساب تيليغرام لتلقي إشعارات فورية عن الرحلات والطلبات.
              </p>
              <Button
                data-testid="button-connect-telegram"
                className="w-full bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                {connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                ربط تيليغرام
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {user.role === "admin" && (
        <AddUserDialog
          open={showAddUser}
          onClose={() => setShowAddUser(false)}
        />
      )}
    </div>
  );
}
