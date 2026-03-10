import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Trophy, TrendingUp, ShoppingCart, Percent } from 'lucide-react';

// SUNIY MOCK DATA (KELAJAKDA API ORQALI OLINADI)
const topStoresData = [
    { rank: 1, name: "ZoomSelling Demo", revenue: 56700000000, growth: 7.3, share: 15.0 },
    { rank: 2, name: "Terra Pro", revenue: 281805890, growth: -5.0, share: 0.5 },
    { rank: 3, name: "Oila Tanlovi", revenue: 274170350, growth: 15.3, share: 0.5 },
    { rank: 4, name: "In touch", revenue: 256387940, growth: 55.2, share: 0.5 },
    { rank: 5, name: "OPTOMOBILE", revenue: 244064000, growth: 86.0, share: 0.4 },
    { rank: 6, name: "MediaMag.Uz", revenue: 228680000, growth: -13.1, share: 0.4 },
    { rank: 7, name: "ArtPremium", revenue: 201890110, growth: -6.6, share: 0.4 },
];

const categoryData = [
    { name: 'Elektronika', value: 19.6, color: '#1f77b4' },
    { name: 'Kiyim', value: 10.6, color: '#ff7f0e' },
    { name: 'Go\'zallik', value: 10.2, color: '#e377c2' },
    { name: 'Maishiy texnika', value: 6.8, color: '#17becf' },
    { name: 'Poyabzallar', value: 6.3, color: '#d62728' },
    { name: 'Boshqalar', value: 5.7, color: '#9467bd' }
];

const trendData = Array.from({ length: 30 }).map((_, i) => ({
    day: `${i + 1}/02`,
    tushum: Math.floor(Math.random() * 50 + 10) * 1000000,
    buyurtma: Math.floor(Math.random() * 500 + 100)
}));

export default function CompetitorAnalysis() {
    const fmt = (v: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(v)) + " so'm";

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Tushum (so'm)</CardTitle>
                        <Trophy className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">56.7 mlrd</div>
                        <p className="text-xs text-emerald-500 font-medium">↑ 7.3%</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Do'konlar</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">37,528</div>
                        <p className="text-xs text-emerald-500 font-medium">↑ 1.1%</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Satuvlar bilan</CardTitle>
                        <Percent className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">43%</div>
                        <p className="text-xs text-muted-foreground font-medium">0%</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Kartochkalar</CardTitle>
                        <TrendingUp className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1.2 mlrd</div>
                        <p className="text-xs text-emerald-500 font-medium">↑ 0.8%</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-12">
                {/* Kategoriyalar Diagrammasi */}
                <Card className="col-span-12 lg:col-span-5 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Kategoriya va Qatlamlar</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        innerRadius={80}
                                        outerRadius={110}
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Top Magazinlar Jadvali */}
                <Card className="col-span-12 lg:col-span-7 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Top-magazinlar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border overflow-hidden">
                            <div className="max-h-[300px] overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-[#1f305f] text-white sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2">O'rin</th>
                                            <th className="px-4 py-2">Magazin Nomi</th>
                                            <th className="px-4 py-2 text-right">Tushum (so'm)</th>
                                            <th className="px-4 py-2 text-right">O'sish %</th>
                                            <th className="px-4 py-2 text-right">Bozor ulushi %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {topStoresData.map((store) => (
                                            <tr key={store.rank} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                <td className="px-4 py-2">{store.rank}</td>
                                                <td className="px-4 py-2 font-medium">{store.name}</td>
                                                <td className="px-4 py-2 text-right whitespace-nowrap">{fmt(store.revenue)}</td>
                                                <td className={`px-4 py-2 text-right font-medium ${store.growth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {store.growth > 0 ? '+' : ''}{store.growth}%
                                                </td>
                                                <td className="px-4 py-2 text-right">{store.share}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Trend Grafiklari */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Tushum (so'nggi 30 kun) va Buyurtmalar</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} />
                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000000}M`} fontSize={12} />
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} fontSize={12} />
                                <Tooltip
                                    formatter={(value: any, name: string) => name === 'Tushum' ? fmt(value) : value}
                                />
                                <Bar yAxisId="left" dataKey="tushum" name="Tushum" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="buyurtma" name="Buyurtmalar" stroke="#ef4444" strokeWidth={3} dot={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
