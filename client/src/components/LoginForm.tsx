import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface LoginFormProps {
  onLogin: (user: any) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [sections, setSections] = useState<string[]>([]);
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedUsername, setSelectedUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();

  useEffect(() => {
    fetchSections();
  }, []);

  useEffect(() => {
    if (selectedSection) {
      fetchUsers(selectedSection);
    } else {
      setUsers([]);
      setSelectedUsername("");
    }
  }, [selectedSection]);

  const fetchSections = async () => {
    try {
      setLoadingSections(true);
      const response = await fetch('/api/auth/sections', { credentials: 'include' });
      if (response.ok) {
        const sectionsData = await response.json();
        setSections(sectionsData);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load sections"
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to connect to server"
      });
    } finally {
      setLoadingSections(false);
    }
  };

  const fetchUsers = async (section: string) => {
    try {
      setLoadingUsers(true);
      const response = await fetch(`/api/auth/users/${encodeURIComponent(section)}`, { credentials: 'include' });
      if (response.ok) {
        const usersData = await response.json();
        setUsers(usersData);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load users"
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users"
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSection || !selectedUsername || !password) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select section, username, and enter password"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Use the useAuth login() which correctly includes credentials so the
      // session cookie is stored by the browser.
      const data = await login({
        section: selectedSection,
        username: selectedUsername,
        password,
      });

      toast({
        title: "Success",
        description: "Logged in successfully"
      });
      onLogin(data?.user ?? data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "فشل تسجيل الدخول",
        description: error?.message || "يرجى التحقق من اسم المستخدم وكلمة المرور"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 mobile-padding py-6 sm:py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">تسجيل الدخول</CardTitle>
          <CardDescription>أدخل بياناتك للوصول إلى النظام</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="section">القسم</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection} disabled={loadingSections}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingSections ? "تحميل الأقسام..." : "اختر القسم"} />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <Select
                value={selectedUsername}
                onValueChange={setSelectedUsername}
                disabled={!selectedSection || loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedSection
                      ? "اختر القسم أولاً"
                      : loadingUsers
                        ? "تحميل المستخدمين..."
                        : "اختر اسم المستخدم"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.username}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !selectedSection || !selectedUsername || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
