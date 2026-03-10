import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn, ArrowRight, QrCode, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function BoxVerification() {
  const navigate = useNavigate();
  const { boxId } = useParams<{ boxId: string }>();
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = "Internal QR Code | AliCargo CRM";
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-10 bg-card border-border max-w-md w-full">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" aria-hidden="true" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <section className="w-full max-w-lg">
        <Card className="p-6 sm:p-8 bg-card border-border">
          <header className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <QrCode className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                Internal box QR code
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                This QR is for internal warehouse scanning inside the AliCargo CRM.
              </p>
            </div>
          </header>

          <div className="mt-6 space-y-4">
            {boxId && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Scanned code</p>
                <p className="text-sm font-mono text-foreground break-all">{boxId}</p>
              </div>
            )}

            {user ? (
              <Button
                className="w-full min-h-[48px] gap-2"
                onClick={() => navigate("/crm/boxes")}
              >
                Open Boxes
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                className="w-full min-h-[48px] gap-2"
                onClick={() => navigate("/auth")}
              >
                Staff login
                <LogIn className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}

            <p className="text-xs text-muted-foreground">
              If you are not a staff member, you can ignore this page.
            </p>
          </div>
        </Card>
      </section>
    </main>
  );
}
