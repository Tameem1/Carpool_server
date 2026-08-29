import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginFormProps {
  onLogin?: (user: any) => void;
}

/**
 * Evally's brand mark — the same open book it shows on its own login screen,
 * in its own blue. Keeping it identical here means the button looks like the
 * page it hands you to.
 */
function EvallyMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#009EF7"
      strokeWidth={1.5}
      aria-hidden="true"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

export function LoginForm(_props: LoginFormProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 mobile-padding py-10">
      <Card className="w-full max-w-md sm:min-w-[420px] min-h-[400px] flex flex-col justify-center gap-2 border-slate-200 shadow-lg">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#009EF7]/10">
            <EvallyMark className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">تسجيل الدخول</CardTitle>
            <CardDescription className="text-base">
              الدخول عبر حساب إفالي
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
              <EvallyMark className="h-6 w-6 shrink-0" />
              <span>تسجيل الدخول عن طريق evally</span>
            </a>
          </Button>

          <p className="mt-5 text-center text-xs leading-6 text-slate-500">
            سيتم تحويلك إلى إفالي لإتمام تسجيل الدخول، ثم تعود إلى هنا.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
