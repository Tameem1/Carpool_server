import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginFormProps {
  onLogin?: (user: any) => void;
}

export function LoginForm(_props: LoginFormProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 mobile-padding py-6 sm:py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">تسجيل الدخول</CardTitle>
          <CardDescription>الدخول عبر حساب إفالي</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" asChild>
            <a href="/api/auth/login">الدخول عبر إفالي</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
