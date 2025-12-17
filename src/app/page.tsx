import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 space-y-8">
      <div className="text-center space-y-4 max-w-2xl">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight lg:text-7xl">
          Quiz Platform
        </h1>
        <p className="text-xl text-muted-foreground">
          A secure, Quiz environment for students and professionals.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 w-full max-w-3xl">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              Student Portal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Access your assigned tests, view your history, and get AI-powered feedback on your performance.
            </p>
            <Link href="/dashboard" className="block">
              <Button className="w-full" size="lg">
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-destructive" />
              Admin Portal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Manage tests, upload documents, grade subjective answers, and monitor student progress.
            </p>
            <Link href="/admin" className="block">
              <Button variant="secondary" className="w-full" size="lg">
                Admin Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <footer className="text-sm text-muted-foreground mt-12">
        &copy; 2025 Quiz Platform. All rights reserved.
      </footer>
    </div>
  );
}
