import { Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginFormProps {
  onLogin?: (user: any) => void;
}

/**
 * Evally's mark: four chevrons facing out from a common centre, drawn in
 * Evally's own blue. It rides on the button only — the card itself is ours.
 */
function EvallyMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#009EF7"
      strokeWidth={1.8}
      aria-hidden="true"
      className={className}
    >
      <path d="M8.5 7 L12 3.5 L15.5 7" />
      <path d="M17 8.5 L20.5 12 L17 15.5" />
      <path d="M15.5 17 L12 20.5 L8.5 17" />
      <path d="M7 15.5 L3.5 12 L7 8.5" />
    </svg>
  );
}

export function LoginForm(_props: LoginFormProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 mobile-padding py-10">
      <Card className="w-full max-w-md sm:min-w-[420px] min-h-[400px] flex flex-col justify-center gap-2 border-slate-200 shadow-lg">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <Car className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">تسجيل الدخول</CardTitle>
            <CardDescription className="text-base">
              الدخول عبر حساب evally
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <Button
            variant="outline"
            className="h-14 w-full gap-3 rounded-xl border-slate-300 bg-white text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            asChild
          >
            <a href="/api/auth/login">
              <EvallyMark className="h-7 w-7 shrink-0" />
              <span>تسجيل الدخول عن طريق evally</span>
            </a>
          </Button>

          <p className="mt-5 text-center text-xs leading-6 text-slate-500">
            سيتم تحويلك إلى evally لإتمام تسجيل الدخول، ثم تعود إلى هنا.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
