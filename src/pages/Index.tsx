import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Network, Database, Layout, BookOpen, Download, MousePointer, TestTube, GitBranch, Store, Sparkles } from "lucide-react";

const Index = () => {
  const deliverables = [
    {
      icon: Network,
      title: "BPMN 2.0 Diagrammalari",
      description: "9 ta to'liq biznes jarayon diagrammalari",
      count: "9 ta diagram",
      link: "/bpmn",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Layout,
      title: "C4 Arxitektura",
      description: "Tizim arxitekturasi: Context, Container, Component",
      count: "3 ta daraja",
      link: "/c4-architecture",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Database,
      title: "Ma'lumotlar Bazasi ERD",
      description: "To'liq ma'lumotlar bazasi sxemasi",
      count: "Barcha jadvallar",
      link: "/erd",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: Layout,
      title: "Wireframe'lar",
      description: "22 ta yuqori sifatli responsive ekranlar",
      count: "22 ta ekran",
      link: "/wireframes",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: MousePointer,
      title: "UI Architecture Design",
      description: "Har bir tugma va funksiyaning batafsil rejalashtirilishi",
      count: "12 sahifa",
      link: "/ui-architecture",
      color: "from-violet-500 to-purple-500"
    },
    {
      icon: BookOpen,
      title: "SRS Hujjat",
      description: "35 sahifali to'liq texnik xujjat (O'zbek + Ingliz)",
      count: "35 sahifa",
      link: "/srs",
      color: "from-indigo-500 to-blue-500"
    },
    {
      icon: TestTube,
      title: "2-Bosqich Test Rejasi",
      description: "48 ta test senariysii va qabul mezoni",
      count: "12 modul",
      link: "/phase2-testing",
      color: "from-emerald-500 to-green-500"
    },
    {
      icon: GitBranch,
      title: "Ish Jarayoni Tekshirish",
      description: "BPMN jarayonlarini baholash va validatsiya hujjati",
      count: "9 jarayon",
      link: "/flow-validation",
      color: "from-rose-500 to-pink-500"
    },
    {
      icon: Store,
      title: "Marketplace Integratsiya",
      description: "Uzum Market & Yandex Market API integratsiya rejasi",
      count: "15-20 kun",
      link: "/marketplace-integration",
      color: "from-amber-500 to-orange-500"
    },
    {
      icon: Sparkles,
      title: "Phase 7 & 8 Test Checklist",
      description: "Marketplace va AI funksiyalari uchun batafsil test rejasi",
      count: "45+ test",
      link: "/phase78-testing",
      color: "from-violet-500 to-fuchsia-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AliBrand CRM & AI Logistics Platform
            </h1>
            <p className="text-muted-foreground mt-2">1-Bosqich: Discovery & Texnik Spetsifikatsiya (5 kun)</p>
          </div>
          <Link to="/pdf-export" target="_blank">
            <Button size="lg" className="gap-2">
              <Download className="h-5 w-5" />
              PDF Hisobot
            </Button>
          </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-block px-4 py-2 bg-primary/10 rounded-full mb-6">
            <span className="text-primary font-semibold">Professional Outsourcing Company</span>
          </div>
          <h2 className="text-5xl font-bold mb-6 leading-tight">
            1-Bosqich Yetkazib Berish
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            53 kunlik loyihaning birinchi bosqichi uchun to'liq texnik hujjatlar paketi.
            Mijoz tasdiqlashi uchun tayyor professional formatda.
          </p>
        </div>


        {/* Deliverables Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-16">
          <Card className="p-8 text-center bg-white border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-5xl font-bold text-primary mb-3">9</div>
            <div className="text-sm text-muted-foreground">BPMN Diagrammalari</div>
          </Card>
          <Card className="p-8 text-center bg-white border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-5xl font-bold text-primary mb-3">3</div>
            <div className="text-sm text-muted-foreground">C4 Daraja</div>
          </Card>
          <Card className="p-8 text-center bg-white border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-5xl font-bold text-primary mb-3">22</div>
            <div className="text-sm text-muted-foreground">Wireframe'lar</div>
          </Card>
          <Card className="p-8 text-center bg-white border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-5xl font-bold text-primary mb-3">12</div>
            <div className="text-sm text-muted-foreground">UI Architecture</div>
          </Card>
          <Card className="p-8 text-center bg-white border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-5xl font-bold text-primary mb-3">35</div>
            <div className="text-sm text-muted-foreground">SRS Sahifalari</div>
          </Card>
        </div>

        {/* Deliverables Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {deliverables.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link to={item.link} key={index}>
                <Card className="p-8 h-full bg-white border border-gray-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
                  <div className="flex items-start gap-6">
                    <div className="p-4 rounded-xl bg-primary/10">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>
                        <span className="text-xs font-semibold px-3 py-1 bg-primary/10 text-primary rounded-full">
                          {item.count}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-6 text-center text-muted-foreground">
          <p>© 2025 Professional Outsourcing Company | AliBrand CRM Platform</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
