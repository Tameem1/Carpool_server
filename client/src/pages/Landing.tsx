import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Car, Users, Shield, Clock } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <Car className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              مرحباً بك في رايد شير برو
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              منصة التنسيق الذكي لمشاركة الرحلات التي تربط السائقين والركاب
              لحلول نقل فعالة ومستدامة.
            </p>
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3"
              onClick={() => window.location.href = "/api/login"}
            >
              ابدأ الآن
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              لماذا تختار رايد شير برو؟
            </h2>
            <p className="text-lg text-gray-600">
              استمتع بتنسيق مشاركة الرحلات السلس مع منصتنا الشاملة
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center">
              <CardContent className="p-6">
                <div className="bg-primary/10 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">دعم متعدد الأدوار</h3>
                <p className="text-gray-600 text-sm">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              هل أنت مستعد لبدء رحلتك؟
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              انضم إلى الآلاف من المستخدمين الذين يشاركون الرحلات بذكاء
            </p>
            <Button 
              size="lg" 
              variant="secondary" 
              className="bg-white text-primary hover:bg-gray-100"
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
