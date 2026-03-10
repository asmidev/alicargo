import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Smartphone, Monitor, QrCode, Package, TrendingUp, Users, Search, Download, Upload, Eye, Check, AlertTriangle, MapPin, Settings, BarChart, DollarSign, Edit, Trash, Save, X, Plus, Menu, MousePointer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Wireframes = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  const wireframes = [
    {
      id: 1,
      title: "Login / Autentifikatsiya",
      description: "Email/parol va rollarga asoslangan kirish tizimi",
      role: "Barcha rollar",
      priority: "High",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] flex items-center justify-center p-6">
          <div className="w-96 space-y-6">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-[#D91A2C] to-[#E6323F] rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-[#D91A2C]/20">
                <div className="text-white font-bold text-2xl">AC</div>
              </div>
              <h2 className="text-white text-2xl font-bold mb-2">AliBrand CRM</h2>
              <p className="text-slate-400 text-sm">Tizimga kirish</p>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <div className="text-slate-300 text-xs mb-2 font-medium">Email</div>
                <div className="h-12 bg-[#1E293B] border border-slate-700 rounded-xl px-4 flex items-center">
                  <span className="text-slate-500 text-sm">email@example.com</span>
                </div>
              </div>
              <div className="relative">
                <div className="text-slate-300 text-xs mb-2 font-medium">Parol</div>
                <div className="h-12 bg-[#1E293B] border border-slate-700 rounded-xl px-4 flex items-center">
                  <span className="text-slate-500 text-sm">••••••••</span>
                </div>
              </div>
              <button className="w-full h-12 bg-gradient-to-r from-[#D91A2C] to-[#E6323F] text-white rounded-xl font-semibold shadow-lg shadow-[#D91A2C]/30 hover:shadow-[#D91A2C]/50 transition-all">
                Kirish
              </button>
              <div className="text-center">
                <button className="text-[#E8B923] text-sm hover:underline">
                  Parolni unutdingizmi?
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: "Xitoy Filiali Dashboard",
      description: "Mahsulotlar statistika va umumiy ko'rinish",
      role: "china_manager, china_receiver",
      priority: "High",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-white text-2xl font-bold">Xitoy Filiali</h2>
              <p className="text-slate-400 text-sm">Bugungi umumiy ko'rinish</p>
            </div>
            <div className="flex gap-3">
              <button className="w-10 h-10 bg-[#1E293B] rounded-xl border border-slate-700 flex items-center justify-center">
                <Search className="w-5 h-5 text-slate-400" />
              </button>
              <button className="px-4 h-10 bg-gradient-to-r from-[#D91A2C] to-[#E6323F] text-white rounded-xl font-medium shadow-lg shadow-[#D91A2C]/20">
                + Yangi Quti
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-[#1E293B] to-[#1E293B]/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="text-slate-400 text-xs font-medium mb-2">Qadoqlangan</div>
              <div className="text-white text-3xl font-bold mb-1">1,482</div>
              <div className="text-[#00A86B] text-xs">+6.2%</div>
            </div>
            <div className="bg-gradient-to-br from-[#1E293B] to-[#1E293B]/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="text-slate-400 text-xs font-medium mb-2">Jo'natildi</div>
              <div className="text-white text-3xl font-bold mb-1">892</div>
              <div className="text-[#FFB300] text-xs">+1.4%</div>
            </div>
            <div className="bg-gradient-to-br from-[#1E293B] to-[#1E293B]/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="text-slate-400 text-xs font-medium mb-2">Tekshiruvda</div>
              <div className="text-white text-3xl font-bold mb-1">124</div>
              <div className="text-slate-400 text-xs">Pending</div>
            </div>
          </div>
          <div className="bg-[#1E293B]/50 rounded-2xl p-4 border border-slate-700/50 mb-6">
            <h3 className="text-white font-semibold mb-3">Route Status: China to Uzbekistan</h3>
            <div className="bg-[#0F172A] rounded-xl p-4 mb-3 border border-slate-700/30">
              <div className="text-center text-slate-400 text-sm">Map Visualization</div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#00A86B] font-medium">✓ All Routes Clear</span>
              <span className="text-slate-400">Last updated: 2 min ago</span>
            </div>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">Outgoing Shipments</h3>
            <div className="space-y-3">
              {[
                { id: 'TRUCK-8741-0891', status: 'Packing', color: '#FFB300' },
                { id: 'Container 6C-27-45', status: 'Pending', color: '#E8B923' },
                { id: 'TRUCK-9201-3312', status: 'In Transit', color: '#00A86B' }
              ].map((item, i) => (
                <div key={i} className="bg-[#1E293B] rounded-xl p-4 border border-slate-700/50 flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#0F172A] rounded-lg flex items-center justify-center border border-slate-700">
                    <Package className="w-6 h-6 text-[#D91A2C]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium mb-1">{item.id}</div>
                    <div className="text-slate-400 text-sm">Containers: {i + 5} boxes</div>
                  </div>
                  <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                    {item.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 3,
      title: "Qadoqlash Ekrani (Xitoy)",
      description: "Mahsulotlarni qutiga joylashtirish va QR yaratish",
      role: "china_packer",
      priority: "Critical",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#D91A2C] to-[#E6323F] rounded-xl flex items-center justify-center shadow-lg shadow-[#D91A2C]/20">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-white text-xl font-bold">Yangi Quti</h2>
                <p className="text-slate-400 text-sm">Mahsulotlar qo'shish</p>
              </div>
            </div>
            <button className="px-4 h-10 bg-[#1E293B] text-slate-300 rounded-xl border border-slate-700 font-medium">
              Bekor qilish
            </button>
          </div>

          <div className="bg-[#1E293B] rounded-2xl p-5 border border-slate-700/50 mb-6">
            <h3 className="text-white font-semibold mb-4">Qutiga solish uchun mahsulotlar</h3>
            <div className="space-y-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex items-center gap-4 p-3 bg-[#0F172A]/50 rounded-xl border border-slate-700/30">
                  <input type="checkbox" className="w-5 h-5 rounded border-2 border-slate-600 bg-[#1E293B]" checked={i <= 2} />
                  <div className="w-10 h-10 bg-[#1E293B] rounded-lg border border-slate-700" />
                  <div className="flex-1">
                    <div className="text-white font-medium mb-1">Product UUID-{1000 + i}</div>
                    <div className="text-slate-400 text-sm">Category: Electronics • Weight: 1.5kg</div>
                  </div>
                  <div className="text-slate-400 text-sm">x 1</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1E293B] rounded-2xl p-5 border border-slate-700/50 mb-6">
            <h3 className="text-white font-semibold mb-3">Quti ma'lumotlari</h3>
            <div className="space-y-4">
              <div>
                <label className="text-slate-300 text-sm font-medium mb-2 block">Quti raqami</label>
                <div className="h-12 bg-[#0F172A] border border-slate-700 rounded-xl px-4 flex items-center">
                  <span className="text-white">BOX-2025-001</span>
                </div>
              </div>
              <div>
                <label className="text-slate-300 text-sm font-medium mb-2 block">Izoh</label>
                <div className="h-20 bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-3">
                  <span className="text-slate-500 text-sm">Qo'shimcha izoh...</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 h-12 bg-[#1E293B] text-slate-300 rounded-xl border border-slate-700 font-semibold">
              Qoralama sifatida saqlash
            </button>
            <button className="flex-1 h-12 bg-gradient-to-r from-[#D91A2C] to-[#E6323F] text-white rounded-xl font-semibold shadow-lg shadow-[#D91A2C]/30">
              Qutini Yopish va QR Yaratish
            </button>
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: "QR Kod Ko'rish va Print",
      description: "Generatsiya qilingan QR kodni ko'rish",
      role: "china_packer",
      priority: "Critical",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] p-6 flex flex-col items-center justify-center">
          <div className="bg-[#1E293B] rounded-3xl p-8 border border-slate-700/50 shadow-2xl max-w-md w-full">
            <div className="text-center mb-6">
              <h2 className="text-white text-xl font-bold mb-2">QR Kod Tayyor</h2>
              <p className="text-slate-400 text-sm">Qutini chop etish uchun tayyor</p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl mb-6 flex items-center justify-center shadow-xl">
              <QrCode className="w-48 h-48 text-[#0F172A]" />
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-3 bg-[#0F172A]/50 rounded-xl">
                <span className="text-slate-300 text-sm">Quti ID:</span>
                <span className="text-white font-mono font-semibold">BOX-2025-001</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#0F172A]/50 rounded-xl">
                <span className="text-slate-300 text-sm">Mahsulotlar:</span>
                <span className="text-white font-semibold">8 ta</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#0F172A]/50 rounded-xl">
                <span className="text-slate-300 text-sm">Yaratildi:</span>
                <span className="text-white font-medium">25 Nov 2025, 14:30</span>
              </div>
            </div>

            <button className="w-full h-12 bg-gradient-to-r from-[#D91A2C] to-[#E6323F] text-white rounded-xl font-semibold shadow-lg shadow-[#D91A2C]/30 flex items-center justify-center gap-2">
              <Download className="w-5 h-5" />
              PDF Chop Etish
            </button>
          </div>
        </div>
      )
    },
    {
      id: 5,
      title: "Jo'natma Yaratish (Xitoy)",
      description: "Qutilarni tanlash va jo'natish",
      role: "china_manager",
      priority: "High",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white text-2xl font-bold">Yangi Jo'natma</h2>
            <button className="px-5 h-11 bg-gradient-to-r from-[#D91A2C] to-[#E6323F] text-white rounded-xl font-medium shadow-lg shadow-[#D91A2C]/20">
              + Jo'natma Yaratish
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-[#1E293B] to-[#1E293B]/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="text-slate-400 text-xs font-medium mb-2">Tayyor Qutila</div>
              <div className="text-white text-3xl font-bold">24</div>
            </div>
            <div className="bg-gradient-to-br from-[#1E293B] to-[#1E293B]/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="text-slate-400 text-xs font-medium mb-2">Tanlangan</div>
              <div className="text-white text-3xl font-bold">8</div>
            </div>
          </div>

          <div className="bg-[#1E293B] rounded-2xl p-5 border border-slate-700/50 mb-4">
            <h3 className="text-white font-semibold mb-4">Qutilarni tanlang</h3>
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-4 p-4 bg-[#0F172A]/50 rounded-xl border border-slate-700/30 hover:border-[#D91A2C]/50 transition-colors">
                  <input type="checkbox" className="w-5 h-5 rounded border-2 border-slate-600" checked={i <= 3} />
                  <div className="w-12 h-12 bg-[#1E293B] rounded-lg border border-slate-700 flex items-center justify-center">
                    <QrCode className="w-6 h-6 text-[#D91A2C]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium mb-1">BOX-2025-{String(i).padStart(3, '0')}</div>
                    <div className="text-slate-400 text-sm">12 mahsulot • 5.2 kg</div>
                  </div>
                  <button className="px-3 py-1 bg-[#1E293B] text-slate-300 rounded-lg text-sm border border-slate-700 hover:border-[#E8B923] hover:text-[#E8B923] transition-colors">
                    Ko'rish
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button className="w-full h-12 bg-gradient-to-r from-[#D91A2C] to-[#E6323F] text-white rounded-xl font-semibold shadow-lg shadow-[#D91A2C]/30">
            8 ta Qutini Jo'natish
          </button>
        </div>
      )
    },
    {
      id: 6,
      title: "Excel Import Ekrani",
      description: "AbuSaxiy dan Excel import",
      role: "uz_manager",
      priority: "Critical",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] p-6">
          <div className="mb-6">
            <h2 className="text-white text-2xl font-bold mb-2">Excel Import</h2>
            <p className="text-slate-400 text-sm">AbuSaxiy dan jo'natma ma'lumotlarini yuklang</p>
          </div>

          <div className="bg-[#1E293B] rounded-2xl p-8 border-2 border-dashed border-slate-700 mb-6 text-center hover:border-[#D91A2C]/50 transition-colors cursor-pointer">
            <div className="w-16 h-16 bg-[#D91A2C]/10 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Upload className="w-8 h-8 text-[#D91A2C]" />
            </div>
            <h3 className="text-white font-semibold mb-2">Excel faylni yuklang</h3>
            <p className="text-slate-400 text-sm mb-4">yoki faylni shu yerga sudrab olib keling</p>
            <button className="px-6 h-10 bg-[#1E293B] text-slate-300 rounded-xl border border-slate-700 font-medium hover:border-[#E8B923] hover:text-[#E8B923] transition-colors">
              Fayl tanlash
            </button>
          </div>

          <div className="bg-[#E8B923]/10 border border-[#E8B923]/30 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[#E8B923]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-[#E8B923] text-xl">ℹ</span>
              </div>
              <div>
                <h4 className="text-[#E8B923] font-semibold mb-1">Telegram Bot</h4>
                <p className="text-slate-300 text-sm mb-2">AbuSaxiy Excel fayllarini Telegram bot orqali olasiz</p>
                <button className="text-[#E8B923] text-sm underline">@AliBrandBot ga o'tish</button>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 p-4 bg-[#1E293B] rounded-xl border border-slate-700/50">
              <div className="w-10 h-10 bg-[#0F172A] rounded-lg flex items-center justify-center border border-slate-700">
                <span className="text-[#00A86B]">✓</span>
              </div>
              <div className="flex-1">
                <div className="text-white font-medium mb-1">shipment_25nov_001.xlsx</div>
                <div className="text-slate-400 text-sm">Yuklangan: 2 daqiqa oldin</div>
              </div>
              <button className="text-[#D91A2C] text-sm font-medium">O'chirish</button>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 h-12 bg-[#1E293B] text-slate-300 rounded-xl border border-slate-700 font-semibold">
              Bekor qilish
            </button>
            <button className="flex-1 h-12 bg-gradient-to-r from-[#D91A2C] to-[#E6323F] text-white rounded-xl font-semibold shadow-lg shadow-[#D91A2C]/30">
              Import qilish
            </button>
          </div>
        </div>
      )
    },
    {
      id: 7,
      title: "Jo'natmalar Ro'yxati",
      description: "Barcha jo'natmalar va statuslari",
      role: "china_manager, uz_manager",
      priority: "High",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white text-2xl font-bold">Jo'natmalar</h2>
            <div className="flex gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Qidirish..."
                  className="w-full h-10 pl-10 pr-4 bg-[#1E293B] border border-slate-700 rounded-xl text-white placeholder-slate-500"
                />
              </div>
              <button className="w-10 h-10 bg-[#1E293B] rounded-xl border border-slate-700 flex items-center justify-center">
                <Settings className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
          
          <div className="space-y-3">
            {[
              { id: 'SHIP-2025-001', boxes: 24, status: 'In Transit', color: '#FFB300' },
              { id: 'SHIP-2025-002', boxes: 18, status: 'Arrived', color: '#00A86B' },
              { id: 'SHIP-2025-003', boxes: 32, status: 'Packing', color: '#E8B923' },
              { id: 'SHIP-2025-004', boxes: 15, status: 'In Transit', color: '#FFB300' },
              { id: 'SHIP-2025-005', boxes: 21, status: 'Arrived', color: '#00A86B' }
            ].map((item, i) => (
              <div key={i} className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-4 hover:border-[#D91A2C]/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-white font-semibold mb-1">{item.id}</h3>
                    <p className="text-slate-400 text-sm">{item.boxes} ta quti • 125.5 kg</p>
                  </div>
                  <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                    {item.status}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-slate-400">
                    <span className="text-slate-500">Jo'natildi:</span> 22 Nov 2025
                  </div>
                  <div className="text-slate-400">
                    <span className="text-slate-500">Yetadi:</span> 28 Nov 2025
                  </div>
                  <button className="ml-auto text-[#E8B923] font-medium hover:underline">
                    Batafsil →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 8,
      title: "O'zbekiston Dashboard",
      description: "Kelgan qutillar, kutilayotgan jo'natmalar",
      role: "uz_manager, uz_receiver",
      priority: "High",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] p-6 overflow-y-auto">
          <div className="bg-gradient-to-r from-[#D91A2C]/20 to-[#E8B923]/20 rounded-2xl p-5 mb-6 border border-[#D91A2C]/30">
            <h2 className="text-white text-2xl font-bold mb-2">O'zbekiston Filiali</h2>
            <p className="text-slate-300 text-sm">Qabul qilish va tarqatish markazi</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-[#1E293B] to-[#1E293B]/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="text-slate-400 text-xs font-medium mb-2">Qabul qilindi</div>
              <div className="text-white text-3xl font-bold mb-1">342</div>
              <div className="text-[#00A86B] text-xs">Bu hafta</div>
            </div>
            <div className="bg-gradient-to-br from-[#1E293B] to-[#1E293B]/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="text-slate-400 text-xs font-medium mb-2">Kutilmoqda</div>
              <div className="text-white text-3xl font-bold mb-1">68</div>
              <div className="text-[#FFB300] text-xs">Yo'lda</div>
            </div>
          </div>

          <h3 className="text-white font-semibold mb-4">Oxirgi qabul qilinganlar</h3>
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-[#1E293B] rounded-xl p-4 border border-slate-700/50 flex items-center gap-4">
                <div className="w-12 h-12 bg-[#0F172A] rounded-xl flex items-center justify-center border border-slate-700">
                  <QrCode className="w-6 h-6 text-[#00A86B]" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium mb-1">BOX-2025-{String(i * 5).padStart(3, '0')}</div>
                  <div className="text-slate-400 text-sm">12 mahsulot • Tasdiqlangan</div>
                </div>
                <div className="text-slate-400 text-xs">
                  2h ago
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 9,
      title: "QR Scanner (O'zbekiston)",
      description: "Quti kelganda QR ni skanlash",
      role: "uz_receiver",
      priority: "Critical",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] p-6 flex flex-col">
          <div className="text-center mb-6">
            <h2 className="text-white text-2xl font-bold mb-2">QR Skaner</h2>
            <p className="text-slate-400 text-sm">Qutini skanerlash uchun kamerani yoqing</p>
          </div>

          <div className="flex-1 bg-[#1E293B]/30 rounded-3xl mb-6 relative overflow-hidden border-2 border-slate-700/50">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 border-4 border-[#D91A2C] rounded-2xl relative shadow-2xl shadow-[#D91A2C]/20">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-[#D91A2C] rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-[#D91A2C] rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-[#D91A2C] rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-[#D91A2C] rounded-br-xl" />
                <QrCode className="w-40 h-40 text-[#D91A2C]/20 absolute inset-0 m-auto" />
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#D91A2C]/50 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="bg-[#1E293B] rounded-2xl p-5 border border-slate-700/50 mb-4">
            <h3 className="text-white font-semibold mb-3 text-center">Yoki qo'lda kiriting</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="UUID yoki QR kod..."
                className="flex-1 h-12 px-4 bg-[#0F172A] border border-slate-700 rounded-xl text-white placeholder-slate-500"
              />
              <button className="px-6 h-12 bg-gradient-to-r from-[#D91A2C] to-[#E6323F] text-white rounded-xl font-semibold shadow-lg shadow-[#D91A2C]/30">
                Qidirish
              </button>
            </div>
          </div>

          <div className="text-center text-slate-400 text-sm">
            QR kodni kamera ko'rinishiga joylashtiring
          </div>
        </div>
      )
    },
    {
      id: 10,
      title: "Qabul va Tekshiruv Ekrani",
      description: "Mahsulotlarni tekshirish va tasdiqlash",
      role: "uz_quality",
      priority: "Critical",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] p-6">
          <div className="bg-[#D91A2C]/10 border-l-4 border-[#D91A2C] rounded-xl p-4 mb-6">
            <h3 className="text-[#D91A2C] font-semibold mb-2">BOX-2025-042</h3>
            <p className="text-slate-300 text-sm">8 mahsulot kutilmoqda • Tekshiruvdan o'tkazing</p>
          </div>

          <div className="space-y-3 mb-6">
            {[
              { name: 'Samsung Galaxy S24', qty: 2, verified: true },
              { name: 'Xiaomi Redmi Note 13', qty: 3, verified: true },
              { name: 'Apple AirPods Pro', qty: 2, verified: false },
              { name: 'Anker Power Bank', qty: 1, verified: false }
            ].map((item, i) => (
              <div key={i} className={`bg-[#1E293B] rounded-xl p-4 border ${item.verified ? 'border-[#00A86B]/30' : 'border-slate-700/50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-white font-medium mb-1">{item.name}</h4>
                    <p className="text-slate-400 text-sm">Miqdor: {item.qty} ta</p>
                  </div>
                  <div className="flex gap-2">
                    <button className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.verified ? 'bg-[#00A86B]/20 border-2 border-[#00A86B]' : 'bg-[#1E293B] border-2 border-slate-700'}`}>
                      <Check className={`w-5 h-5 ${item.verified ? 'text-[#00A86B]' : 'text-slate-600'}`} />
                    </button>
                    <button className="w-10 h-10 bg-[#1E293B] border-2 border-slate-700 rounded-xl flex items-center justify-center hover:border-[#DC143C] transition-colors">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="w-full h-12 bg-gradient-to-r from-[#00A86B] to-[#00A86B]/90 text-white rounded-xl font-semibold shadow-lg shadow-[#00A86B]/30">
            Barchasini Tasdiqlash
          </button>
        </div>
      )
    },
    {
      id: 11,
      title: "Nuqsonli Mahsulot Hisoboti",
      description: "Defect form va foto yuklash",
      role: "uz_quality",
      priority: "High",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] p-6">
          <div className="bg-[#DC143C]/10 border-l-4 border-[#DC143C] rounded-xl p-4 mb-6">
            <h3 className="text-[#DC143C] font-semibold">Muammoli Mahsulot</h3>
          </div>

          <div className="space-y-5 mb-6">
            <div>
              <label className="text-slate-300 text-sm font-medium mb-2 block">Mahsulot nomi</label>
              <div className="h-12 bg-[#1E293B] border border-slate-700 rounded-xl px-4 flex items-center">
                <span className="text-white">Samsung Galaxy S24</span>
              </div>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium mb-2 block">Muammo turi</label>
              <select className="w-full h-12 bg-[#1E293B] border border-slate-700 rounded-xl px-4 text-white">
                <option>Shikastlangan (Brak)</option>
                <option>Yetishmayapti</option>
                <option>Noto'g'ri mahsulot</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium mb-2 block">Tavsif</label>
              <textarea 
                className="w-full h-24 bg-[#1E293B] border border-slate-700 rounded-xl p-4 text-white resize-none"
                placeholder="Muammo haqida batafsil yozing..."
              />
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium mb-3 block">Foto yuklash</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="aspect-square bg-[#1E293B] rounded-xl border border-slate-700" />
                <button className="aspect-square bg-[#1E293B]/50 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center hover:border-[#E8B923] transition-colors">
                  <Plus className="w-8 h-8 text-slate-500" />
                </button>
                <div className="aspect-square bg-[#1E293B]/30 border-2 border-dashed border-slate-700/50 rounded-xl" />
              </div>
            </div>
          </div>

          <button className="w-full h-12 bg-gradient-to-r from-[#DC143C] to-[#DC143C]/90 text-white rounded-xl font-semibold shadow-lg shadow-[#DC143C]/30">
            Hisobotni Yuborish
          </button>
        </div>
      )
    },
    {
      id: 12,
      title: "Ombor / Inventory Dashboard",
      description: "Mavjud stok va joylashuv",
      role: "uz_manager",
      priority: "Medium",
      mockup: (
        <div className="w-full h-full bg-[#0F172A] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white text-2xl font-bold">Ombor</h2>
            <div className="flex gap-2">
              <button className="w-10 h-10 bg-[#1E293B] rounded-xl border border-slate-700 flex items-center justify-center">
                <Search className="w-5 h-5 text-slate-400" />
              </button>
              <button className="w-10 h-10 bg-[#1E293B] rounded-xl border border-slate-700 flex items-center justify-center">
                <Settings className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'A1', count: 245 },
              { label: 'A2', count: 180 },
              { label: 'B1', count: 320 },
              { label: 'B2', count: 150 }
            ].map((zone, i) => (
              <div key={i} className="bg-gradient-to-br from-[#1E293B] to-[#1E293B]/50 rounded-xl p-3 border border-slate-700/50">
                <div className="text-slate-400 text-xs mb-1">Zona {zone.label}</div>
                <div className="text-white text-2xl font-bold">{zone.count}</div>
              </div>
            ))}
          </div>

          <h3 className="text-white font-semibold mb-4">Oxirgi qo'shilganlar</h3>
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-4 p-4 bg-[#1E293B] rounded-xl border border-slate-700/50">
                <div className="w-12 h-12 bg-[#0F172A] rounded-lg border border-slate-700" />
                <div className="flex-1">
                  <div className="text-white font-medium mb-1">Product UUID-{1000 + i}</div>
                  <div className="text-slate-400 text-sm">Zona A{i % 2 + 1} • Shelf #{i + 10}</div>
                </div>
                <div className="text-right">
                  <div className="px-3 py-1 bg-[#00A86B]/20 text-[#00A86B] rounded-full text-sm font-medium">
                    Mavjud
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 13,
      title: "Marketplace Ulanishlar",
      description: "API integratsiyalari sozlash",
      role: "marketplace_manager",
      priority: "High",
      mockup: (
        <div className="w-full h-full bg-background p-4">
          <div className="h-10 bg-foreground/10 rounded-lg mb-4" />
          <div className="space-y-3 mb-4">
            {[
              { name: 'Uzum', color: 'purple' },
              { name: 'Yandex', color: 'red' },
              { name: 'Instagram', color: 'pink' },
              { name: 'Telegram', color: 'blue' }
            ].map((mp, i) => (
              <div key={i} className="bg-card border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 bg-${mp.color}-500/20 rounded`} />
                    <div className="h-3 bg-foreground/10 rounded w-20" />
                  </div>
                  <div className={`w-10 h-5 ${i < 2 ? 'bg-success/20' : 'bg-muted'} rounded-full`} />
                </div>
                <div className="flex gap-2 text-xs">
                  <div className="h-2 bg-foreground/5 rounded w-24" />
                  <div className="h-2 bg-foreground/5 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
          <div className="h-10 bg-primary rounded-lg" />
        </div>
      )
    },
    {
      id: 14,
      title: "Marketplace Orders Sync",
      description: "Buyurtmalar sinxronizatsiya",
      role: "marketplace_manager",
      priority: "High",
      mockup: (
        <div className="w-full h-full bg-background p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 bg-foreground/10 rounded-lg w-40" />
            <div className="h-10 bg-primary rounded-lg w-24" />
          </div>
          <div className="space-y-2">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-card border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-muted rounded" />
                    <div className="h-3 bg-foreground/10 rounded w-20" />
                  </div>
                  <div className={`h-5 rounded-full w-16 ${i % 2 === 0 ? 'bg-success/20' : 'bg-warning/20'}`} />
                </div>
                <div className="flex gap-3 text-xs">
                  <div className="h-2 bg-foreground/5 rounded w-24" />
                  <div className="h-2 bg-foreground/5 rounded w-16" />
                  <div className="h-2 bg-foreground/5 rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 15,
      title: "Investor Dashboard",
      description: "Shaxsiy moliyaviy hisobotlar",
      role: "investor",
      priority: "High",
      mockup: (
        <div className="w-full h-full bg-background p-4">
          <div className="h-12 bg-gradient-to-r from-success/20 to-success/30 rounded-lg mb-4 p-3">
            <div className="h-4 bg-foreground/10 rounded w-32 mb-1" />
            <div className="h-3 bg-success/50 rounded w-20" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-card border rounded-lg p-3">
              <div className="h-2 bg-foreground/10 rounded w-20 mb-2" />
              <div className="h-5 bg-primary/20 rounded w-24" />
            </div>
            <div className="bg-card border rounded-lg p-3">
              <div className="h-2 bg-foreground/10 rounded w-20 mb-2" />
              <div className="h-5 bg-success/20 rounded w-24" />
            </div>
          </div>
          <div className="h-32 bg-card border rounded-lg mb-4 p-3">
            <div className="h-3 bg-foreground/10 rounded w-24 mb-3" />
            <div className="h-full bg-gradient-to-t from-success/10 to-transparent" />
          </div>
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="flex justify-between p-2 bg-card border rounded">
                <div className="h-3 bg-foreground/10 rounded w-24" />
                <div className="h-3 bg-success/20 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 16,
      title: "Moliya Dashboard (Admin)",
      description: "Umumiy moliyaviy ko'rinish",
      role: "finance_manager, super_admin",
      priority: "High",
      mockup: (
        <div className="w-full h-full bg-background p-4">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="h-14 bg-card border rounded-lg p-2">
              <div className="h-2 bg-foreground/10 rounded w-12 mb-1" />
              <div className="h-4 bg-success/20 rounded w-16" />
            </div>
            <div className="h-14 bg-card border rounded-lg p-2">
              <div className="h-2 bg-foreground/10 rounded w-12 mb-1" />
              <div className="h-4 bg-destructive/20 rounded w-16" />
            </div>
            <div className="h-14 bg-card border rounded-lg p-2">
              <div className="h-2 bg-foreground/10 rounded w-12 mb-1" />
              <div className="h-4 bg-primary/20 rounded w-16" />
            </div>
          </div>
          <div className="h-36 bg-card border rounded-lg mb-4 p-3">
            <div className="h-3 bg-foreground/10 rounded w-28 mb-2" />
            <div className="h-full bg-gradient-to-r from-success/10 via-primary/10 to-accent/10" />
          </div>
          <div className="space-y-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center justify-between p-2 bg-card border rounded">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-muted rounded" />
                  <div className="h-3 bg-foreground/10 rounded w-20" />
                </div>
                <div className="h-3 bg-foreground/5 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 17,
      title: "Xarajatlar Ro'yxati",
      description: "Barcha xarajatlarni kuzatish",
      role: "finance_manager",
      priority: "Medium",
      mockup: (
        <div className="w-full h-full bg-background p-4">
          <div className="flex gap-2 mb-4">
            <div className="flex-1 h-10 bg-muted rounded-lg" />
            <div className="w-10 h-10 bg-primary rounded-lg" />
          </div>
          <div className="space-y-2">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-card border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="h-3 bg-foreground/10 rounded w-28 mb-1" />
                    <div className="h-2 bg-foreground/5 rounded w-20" />
                  </div>
                  <div className="h-4 bg-destructive/20 rounded w-16 text-right" />
                </div>
                <div className="flex gap-2 text-xs">
                  <div className="h-2 bg-foreground/5 rounded w-16" />
                  <div className="h-2 bg-foreground/5 rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 18,
      title: "Mijoz Portal - Login",
      description: "Mijozlar uchun alohida kirish",
      role: "customer",
      priority: "Medium",
      mockup: (
        <div className="w-full h-full bg-background flex items-center justify-center p-4">
          <div className="w-80 space-y-4">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full mx-auto mb-3" />
              <div className="h-5 bg-foreground/10 rounded w-40 mx-auto mb-2" />
              <div className="h-3 bg-foreground/5 rounded w-48 mx-auto" />
            </div>
            <div className="space-y-3">
              <div className="h-10 bg-muted rounded-lg" />
              <div className="h-10 bg-primary rounded-lg" />
              <div className="text-center">
                <div className="h-3 bg-foreground/5 rounded w-32 mx-auto" />
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 19,
      title: "Mijoz - Buyurtma Kuzatuv",
      description: "Real-time tracking",
      role: "customer",
      priority: "High",
      mockup: (
        <div className="w-full h-full bg-background p-4">
          <div className="h-12 bg-card border rounded-lg mb-4 p-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full" />
            <div>
              <div className="h-3 bg-foreground/10 rounded w-24 mb-1" />
              <div className="h-2 bg-foreground/5 rounded w-32" />
            </div>
          </div>
          <div className="space-y-4 mb-4">
            {[
              { status: 'complete', label: 'Xitoyda qadoqlandi' },
              { status: 'complete', label: 'Jo\'natildi' },
              { status: 'active', label: 'O\'zbekistonda' },
              { status: 'pending', label: 'Yetkazib berish' }
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${
                  step.status === 'complete' ? 'bg-success' :
                  step.status === 'active' ? 'bg-primary' : 'bg-muted'
                }`} />
                <div className="flex-1">
                  <div className={`h-3 rounded w-32 ${
                    step.status === 'pending' ? 'bg-foreground/5' : 'bg-foreground/10'
                  }`} />
                </div>
              </div>
            ))}
          </div>
          <div className="h-10 bg-muted rounded-lg" />
        </div>
      )
    },
    {
      id: 20,
      title: "Mijoz - Buyurtmalar Tarixi",
      description: "O'tgan buyurtmalar",
      role: "customer",
      priority: "Medium",
      mockup: (
        <div className="w-full h-full bg-background p-4">
          <div className="h-10 bg-foreground/10 rounded-lg mb-4" />
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="bg-card border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-12 h-12 bg-muted rounded" />
                  <div className="flex-1">
                    <div className="h-3 bg-foreground/10 rounded w-32 mb-1" />
                    <div className="h-2 bg-foreground/5 rounded w-24" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-2 bg-foreground/5 rounded w-20" />
                  <div className={`h-5 rounded-full w-20 ${i % 2 === 0 ? 'bg-success/20' : 'bg-primary/20'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 21,
      title: "Bildirishnomalar Markazi",
      description: "Real-time notifications",
      role: "Barcha rollar",
      priority: "Medium",
      mockup: (
        <div className="w-full h-full bg-background p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="h-10 bg-foreground/10 rounded-lg w-32" />
            <div className="h-8 bg-primary/20 rounded-lg w-20" />
          </div>
          <div className="space-y-2">
            {[1,2,3,4,5,6,7].map(i => (
              <div key={i} className={`p-3 rounded-lg border ${i <= 2 ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
                <div className="flex items-start gap-2">
                  <div className={`w-8 h-8 rounded-full ${i <= 2 ? 'bg-primary/20' : 'bg-muted'}`} />
                  <div className="flex-1">
                    <div className={`h-3 rounded w-40 mb-1 ${i <= 2 ? 'bg-foreground/10' : 'bg-foreground/5'}`} />
                    <div className="h-2 bg-foreground/5 rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 22,
      title: "Foydalanuvchi Sozlamalari",
      description: "Profil va til sozlamalari",
      role: "Barcha rollar",
      priority: "Low",
      mockup: (
        <div className="w-full h-full bg-background p-4">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-3" />
            <div className="h-4 bg-foreground/10 rounded w-32 mx-auto mb-1" />
            <div className="h-3 bg-foreground/5 rounded w-24 mx-auto" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="h-3 bg-foreground/10 rounded w-20 mb-2" />
              <div className="space-y-2">
                <div className="h-10 bg-muted rounded-lg" />
                <div className="h-10 bg-muted rounded-lg" />
              </div>
            </div>
            <div>
              <div className="h-3 bg-foreground/10 rounded w-16 mb-2" />
              <div className="flex gap-2">
                <div className="flex-1 h-10 bg-primary/20 rounded-lg" />
                <div className="flex-1 h-10 bg-muted rounded-lg" />
                <div className="flex-1 h-10 bg-muted rounded-lg" />
              </div>
            </div>
            <div className="pt-4">
              <div className="h-10 bg-primary rounded-lg mb-2" />
              <div className="h-10 bg-destructive/20 rounded-lg" />
            </div>
          </div>
        </div>
      )
    }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Critical": return "bg-destructive text-destructive-foreground";
      case "High": return "bg-warning text-warning-foreground";
      case "Medium": return "bg-primary text-primary-foreground";
      case "Low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const currentWireframe = wireframes[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : wireframes.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < wireframes.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">High-Fidelity Wireframes</h1>
                <p className="text-muted-foreground text-sm">22 ta professional PWA responsive ekranlar</p>
              </div>
            </div>
            
            {/* View Mode Switcher */}
            <div className="flex items-center gap-3">
              <div className="flex bg-muted rounded-lg p-1">
                <Button
                  variant={viewMode === "desktop" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("desktop")}
                  className="gap-2"
                >
                  <Monitor className="w-4 h-4" />
                  Desktop
                </Button>
                <Button
                  variant={viewMode === "mobile" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("mobile")}
                  className="gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  Mobile
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section className="container mx-auto px-6 py-8">
        {/* Progress and Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">
              {currentIndex + 1} / {wireframes.length}
            </Badge>
            <div className="text-sm text-muted-foreground">
              {currentWireframe.role}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevious}
              className="hover:bg-primary hover:text-primary-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              className="hover:bg-primary hover:text-primary-foreground"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Current Wireframe */}
        <div className="max-w-7xl mx-auto">
          <Card className="overflow-hidden bg-white border-2">
            {/* Wireframe Header */}
            <div className="p-6 border-b bg-muted/30">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {currentWireframe.id}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-1">{currentWireframe.title}</h2>
                    <p className="text-muted-foreground">{currentWireframe.description}</p>
                  </div>
                </div>
                <Badge className={getPriorityColor(currentWireframe.priority)}>
                  {currentWireframe.priority}
                </Badge>
              </div>
            </div>

            {/* Wireframe Display */}
            <div className="p-8 bg-muted/10">
              <div className={`mx-auto bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ${
                viewMode === "desktop" ? "w-full" : "max-w-md"
              }`}>
                <div className={`bg-background border-2 ${
                  viewMode === "desktop" ? "aspect-video" : "aspect-[9/16]"
                }`}>
                  <div className="w-full h-full overflow-auto">
                    {currentWireframe.mockup}
                  </div>
                </div>
              </div>
            </div>

            {/* Wireframe Footer */}
            <div className="p-4 border-t bg-muted/30">
              <div className="flex items-center justify-between text-sm">
                <div className="flex gap-6">
                  <div>
                    <span className="font-semibold text-muted-foreground">Rol: </span>
                    <span>{currentWireframe.role}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Muhimlik: </span>
                    <span>{currentWireframe.priority}</span>
                  </div>
                </div>
                <div className="text-muted-foreground">
                  PWA • Responsive • i18n Ready
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Thumbnail Navigation */}
        <div className="mt-8 max-w-7xl mx-auto">
          <h3 className="font-semibold mb-4 text-muted-foreground">Barcha ekranlar</h3>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-3">
            {wireframes.map((wireframe, index) => (
              <button
                key={wireframe.id}
                onClick={() => setCurrentIndex(index)}
                className={`aspect-square rounded-lg border-2 transition-all flex items-center justify-center font-bold text-sm ${
                  index === currentIndex
                    ? "border-primary bg-primary text-primary-foreground shadow-lg scale-110"
                    : "border-border bg-white hover:border-primary hover:scale-105"
                }`}
              >
                {wireframe.id}
              </button>
            ))}
          </div>
        </div>

        {/* Design System Note */}
        <Card className="mt-12 p-8 bg-white border-2">
          <h3 className="text-2xl font-bold mb-6">Design System & Implementation</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-lg">UI Framework</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Modern PWA Framework</li>
                <li>✓ UI Components</li>
                <li>✓ Modern UI Framework</li>
                <li>✓ Responsive Breakpoints</li>
                <li>✓ Dark Mode Support</li>
                <li>✓ Accessibility (WCAG 2.1)</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-accent" />
                </div>
                <h4 className="font-semibold text-lg">PWA Features</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Installable Home Screen</li>
                <li>✓ Offline Support</li>
                <li>✓ Push Notifications</li>
                <li>✓ Camera Access (QR scan)</li>
                <li>✓ Fast Loading</li>
                <li>✓ App-like Experience</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <h4 className="font-semibold text-lg">Internationalization</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>🇺🇿 O'zbek (default)</li>
                <li>🇷🇺 Русский</li>
                <li>🇬🇧 English</li>
                <li>✓ i18next Integration</li>
                <li>✓ Dynamic Language Switch</li>
                <li>✓ RTL Support Ready</li>
              </ul>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default Wireframes;