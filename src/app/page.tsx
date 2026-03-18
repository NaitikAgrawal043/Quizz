import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, ShieldCheck, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-5xl space-y-12 sm:space-y-16">
        
        {/* Header Section */}
        <div className="text-center space-y-6 max-w-3xl mx-auto mt-8 sm:mt-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
            Quiz Platform
          </h1>
          
          <p className="text-lg sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A secure and comprehensive environment for administering exams, managing performance, and delivering actionable student feedback.
          </p>
        </div>

        {/* Portal Cards */}
        <div className="grid gap-6 md:gap-8 md:grid-cols-2 w-full max-w-4xl relative z-20">
          
          {/* Student Card */}
          <Card className="flex flex-col h-full border-border/60 hover:border-primary/50 hover:shadow-md transition-all duration-200 bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                <div className="p-2 rounded-md bg-primary/10 text-primary">
                  <GraduationCap className="h-5 w-5" />
                </div>
                Student Portal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 flex flex-col flex-1 justify-between">
              <p className="text-muted-foreground text-base leading-relaxed">
                Access assigned tests, view detailed historical performance, and receive AI-driven feedback to improve outcomes.
              </p>
              <Link href="/dashboard" className="block mt-auto w-full">
                <Button className="w-full text-base h-11" size="lg">
                  Access Portal
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Admin Card */}
          <Card className="flex flex-col h-full border-border/60 hover:border-primary/50 hover:shadow-md transition-all duration-200 bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                <div className="p-2 rounded-md bg-secondary text-secondary-foreground">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                Admin Portal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 flex flex-col flex-1 justify-between">
              <p className="text-muted-foreground text-base leading-relaxed">
                Manage test assignments, securely handle assessment materials, and monitor overarching student performance metrics.
              </p>
              <Link href="/admin" className="block mt-auto w-full">
                <Button variant="outline" className="w-full text-base h-11" size="lg">
                  Admin Login
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

        </div>
      </div>

      <footer className="mt-20 sm:mt-24 text-sm text-muted-foreground text-center relative z-20 pb-8">
        &copy; {new Date().getFullYear()} Quiz Platform. Engineered for excellence.
      </footer>
    </div>
  );
}
