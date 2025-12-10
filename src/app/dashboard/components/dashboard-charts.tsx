"use client"

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface DashboardChartsProps {
    revenueHistory: { date: string; value: number }[]
    chatChannels: { name: string; value: number; color: string }[]
    totalChats: number
}

export function DashboardCharts({ revenueHistory, chatChannels, totalChats }: DashboardChartsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-7">
            <div className="col-span-4 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark text-card-foreground shadow-sm">
                <div className="p-6 flex flex-col space-y-1.5 ">
                    <h3 className="font-semibold leading-none tracking-tight">Ingresos por Día</h3>
                    <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Últimos 30 días</p>
                </div>
                <div className="p-6 pt-0 pl-2">
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Ingresos"]}
                                />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="col-span-3 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark text-card-foreground shadow-sm">
                <div className="p-6 flex flex-col space-y-1.5">
                    <h3 className="font-semibold leading-none tracking-tight">Volumen de Conversaciones</h3>
                </div>
                <div className="p-6 pt-0 flex flex-col items-center justify-center">
                    <div className="h-[250px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chatChannels}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={100}
                                    paddingAngle={0}
                                    dataKey="value"
                                    strokeWidth={0}
                                >
                                    {chatChannels.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-text-light-primary dark:text-text-dark-primary">{totalChats}</span>
                            <span className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Total</span>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-4">
                        {chatChannels.map((channel) => (
                            <div key={channel.name} className="flex items-center gap-2">
                                <span className="size-3 rounded-full" style={{ backgroundColor: channel.color }}></span>
                                <span className="text-sm text-text-light-secondary dark:text-text-dark-secondary whitespace-nowrap">
                                    {channel.name} ({channel.value > 0 ? Math.round((channel.value / totalChats) * 100) : 0}%)
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
