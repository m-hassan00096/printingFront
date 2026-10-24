import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

export function NotFoundPage() {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <Card className="w-full max-w-md rounded-2xl text-center">
        <CardHeader>
          <p className="text-sm font-bold text-muted-foreground">404</p>
          <CardTitle className="text-2xl">الصفحة غير موجودة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">الرابط الذي فتحته غير موجود أو تم نقله.</p>
          <Button asChild><Link to="/">العودة إلى البداية</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
