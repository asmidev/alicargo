import { useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, RadialBarChart, RadialBar
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, Activity } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'comparison' | 'trend' | 'area' | 'donut' | 'horizontal_bar' | 'progress' | 'stats' | 'gauge';
  title: string;
  data: any[];
  xKey?: string;
  yKey?: string;
  compareKey?: string;
  change?: number;
  summary?: string;
  // For stats type
  value?: number | string;
  label?: string;
  icon?: string;
  color?: string;
}

interface AliAIChartRendererProps {
  chartData: ChartData;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(142, 76%, 36%)', // green
  'hsl(38, 92%, 50%)', // amber
  'hsl(280, 65%, 60%)', // purple
  'hsl(199, 89%, 48%)', // cyan
  'hsl(340, 82%, 52%)', // pink
  'hsl(25, 95%, 53%)', // orange
];

const GRADIENT_IDS = ['primary-gradient', 'secondary-gradient', 'success-gradient'];

export function AliAIChartRenderer({ chartData }: AliAIChartRendererProps) {
  const { type, title, data, xKey = 'name', yKey = 'value', compareKey, change, summary, value, label, icon, color } = chartData || {};

  const TrendIcon = useMemo(() => {
    if (change === undefined) return null;
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }, [change]);

  const ChartTypeIcon = useMemo(() => {
    switch (type) {
      case 'bar':
      case 'horizontal_bar':
        return <BarChart3 className="h-4 w-4 text-muted-foreground" />;
      case 'pie':
      case 'donut':
        return <PieChartIcon className="h-4 w-4 text-muted-foreground" />;
      case 'line':
      case 'area':
      case 'trend':
        return <LineChartIcon className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  }, [type]);

  // Early return if data is invalid — placed after all hooks
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <Card className="my-3 overflow-hidden border-2 border-muted/50">
        <CardHeader className="py-3 px-4 bg-muted/30">
          <CardTitle className="text-sm font-medium">{title || 'Grafik'}</CardTitle>
        </CardHeader>
        <CardContent className="py-6 px-4 text-center text-muted-foreground text-sm">
          Ma'lumot mavjud emas
        </CardContent>
      </Card>
    );
  }

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="primary-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="secondary-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }} 
              />
              <Bar dataKey={yKey} fill="url(#primary-gradient)" radius={[6, 6, 0, 0]} />
              {compareKey && <Bar dataKey={compareKey} fill="url(#secondary-gradient)" radius={[6, 6, 0, 0]} />}
              {compareKey && <Legend />}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'horizontal_bar':
        return (
          <ResponsiveContainer width="100%" height={Math.max(180, data.length * 40)}>
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
              <YAxis dataKey={xKey} type="category" tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} width={55} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
              <Bar dataKey={yKey} fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
              <Line 
                type="monotone" 
                dataKey={yKey} 
                stroke="hsl(var(--primary))" 
                strokeWidth={2.5}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              {compareKey && (
                <Line 
                  type="monotone" 
                  dataKey={compareKey} 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: 'hsl(var(--secondary))' }}
                />
              )}
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey={yKey} 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                fill="url(#area-gradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={85}
                paddingAngle={2}
                dataKey={yKey}
                nameKey={xKey}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
                dataKey={yKey}
                nameKey={xKey}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" formatter={(value) => <span className="text-xs">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'gauge':
        // Simple gauge using radial bar
        const gaugeValue = typeof data[0]?.[yKey] === 'number' ? data[0][yKey] : 0;
        const gaugeData = [{ name: 'value', value: gaugeValue, fill: gaugeValue >= 70 ? 'hsl(142, 76%, 36%)' : gaugeValue >= 40 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 84%, 60%)' }];
        return (
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <RadialBarChart 
                cx="50%" 
                cy="50%" 
                innerRadius="60%" 
                outerRadius="100%" 
                barSize={12} 
                data={gaugeData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar 
                  background={{ fill: 'hsl(var(--muted))' }}
                  dataKey="value" 
                  cornerRadius={6}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <span className="text-3xl font-bold">{gaugeValue}%</span>
                {data[0]?.[xKey] && <p className="text-xs text-muted-foreground mt-1">{data[0][xKey]}</p>}
              </div>
            </div>
          </div>
        );

      case 'progress':
        return (
          <div className="space-y-4 py-2">
            {data.map((item, idx) => {
              const progressValue = Math.min(100, Math.max(0, item[yKey] || 0));
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item[xKey]}</span>
                    <span className="text-muted-foreground">{progressValue}%</span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
                </div>
              );
            })}
          </div>
        );

      case 'stats':
        return (
          <div className="grid grid-cols-2 gap-3 py-2">
            {data.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{item[yKey]}</p>
                <p className="text-xs text-muted-foreground mt-1">{item[xKey]}</p>
                {item.change !== undefined && (
                  <span className={`text-xs ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {item.change >= 0 ? '↑' : '↓'} {Math.abs(item.change)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        );

      case 'comparison':
        return (
          <div className="space-y-3">
            {data.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="font-medium text-sm">{item[xKey]}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{item.previous}</span>
                  <span className="text-lg font-bold">{item[yKey]}</span>
                  {item.change !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${item.change >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {item.change >= 0 ? '+' : ''}{item.change}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case 'trend':
        return (
          <div className="space-y-2">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={change && change >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={change && change >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey={xKey} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey={yKey} 
                  stroke={change && change >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} 
                  strokeWidth={2}
                  fill="url(#trend-gradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="my-3 overflow-hidden border-2 border-muted/50">
      <CardHeader className="py-3 px-4 bg-muted/30">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            {ChartTypeIcon}
            <span>{title}</span>
          </div>
          {TrendIcon && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-background">
              {TrendIcon}
              <span className={`text-xs font-semibold ${change && change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {change && change >= 0 ? '+' : ''}{change}%
              </span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-3 px-4">
        {renderChart()}
        {summary && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">{summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
