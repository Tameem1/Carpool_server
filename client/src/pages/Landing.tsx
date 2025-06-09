import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Car, Users, Shield, Clock } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 mobile-safe-area">
          <div className="text-center">
            <div className="flex justify-center mb-4 sm:mb-6">
              <Car className="h-12 w-12 sm:h-16 sm:w-16 text-primary" />
            </div>
            <h1 className="responsive-text-2xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
              مرحباً بك في وصلني عالنادي
            </h1>
            <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 max-w-3xl mx-auto px-4">
              منصة التنسيق الذكي لمشاركة الرحلات التي تربط السائقين والركاب
              لحلول نقل فعالة ومستدامة.
            </p>
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3 sm:px-8 touch-friendly"
              onClick={() => window.location.href = "/api/login"}
            >
              ابدأ الآن
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mobile-safe-area">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="responsive-text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              لماذا تختار وصلني عالنادي؟
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 px-4">
              استمتع بتنسيق مشاركة الرحلات السلس مع منصتنا الشاملة
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <Card className="text-center">
              <CardContent className="p-4 sm:p-6">
                <div className="bg-primary/10 w-12 h-12 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">دعم متعدد الأدوار</h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                  أدوار المدير والسائق والراكب مع تجارب مخصصة لكل نوع مستخدم
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <div className="bg-secondary/10 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">المطابقة الذكية</h3>
                <p className="text-gray-600 text-sm">
                  خوارزمية متقدمة تطابق الركاب مع السائقين ضمن نوافذ زمنية ±٢ ساعة
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <div className="bg-success/10 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-success" />
                </div>
                <h3 className="text-lg font-semibold mb-2">الإشعارات الفورية</h3>
                <p className="text-gray-600 text-sm">
                  إشعارات تيليجرام فورية لجميع تحديثات الرحلات والطلبات
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-6">
                <div className="bg-warning/10 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Car className="h-8 w-8 text-warning" />
                </div>
                <h3 className="text-lg font-semibold mb-2">إدارة الرحلات</h3>
                <p className="text-gray-600 text-sm">
                  إدارة كاملة لدورة حياة الرحلة مع دعم الجدولة المتكررة
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 mobile-safe-area">
          <div className="text-center">
            <h2 className="responsive-text-2xl font-bold text-white mb-3 sm:mb-4">
              هل أنت مستعد لبدء رحلتك؟
            </h2>
            <p className="text-base sm:text-xl text-blue-100 mb-6 sm:mb-8 px-4">
              انضم إلى الآلاف من المستخدمين الذين يشاركون الرحلات بذكاء
            </p>
            <Button 
              size="lg" 
              variant="secondary" 
              className="bg-white text-primary hover:bg-gray-100 touch-friendly px-6 py-3 sm:px-8"
              onClick={() => window.location.href = "/api/login"}
            >
              سجل الدخول للمتابعة
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
