import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Box, History, Package, Plus, Search, Trash2, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProductStock {
    id: string;
    name: string;
    total_purchased: number;
    total_consumed: number;
    available_stock: number;
    unit_price?: number;
    expiration_date?: string | null;
    supplier_name?: string;
}



interface ConsumptionHistory {
    id: string;
    product_name: string;
    quantity: number;
    consumption_date: string;
    notes: string;
}

const Inventaire = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('stock');

    // Fetch stock data
    const { data: stockData, isLoading: isLoadingStock } = useQuery({
        queryKey: ['inventory-stock'],
        queryFn: async () => {
            // Get all products
            const { data: products, error: pError } = await supabase
                .from('products')
                .select('id, name');
            if (pError) throw pError;

            // Get purchased info per product (including latest price/expiry/supplier)
            const { data: purchases, error: purError } = await supabase
                .from('invoice_items')
                .select('product_id, quantity, unit_price, expiration_date, created_at, invoices(suppliers(name))')
                .order('created_at', { ascending: true });
            if (purError) throw purError;



            // Get total consumed per product
            const { data: consumptions, error: consError } = await (supabase as any)
                .from('product_consumptions')
                .select('product_id, quantity');
            if (consError) throw consError;

            const stockMap: Record<string, ProductStock> = {};
            products.forEach(p => {
                stockMap[p.id] = { id: p.id, name: p.name, total_purchased: 0, total_consumed: 0, available_stock: 0 };
            });

            (purchases as any[])?.forEach(pur => {
                if (pur.product_id && stockMap[pur.product_id]) {
                    stockMap[pur.product_id].total_purchased += Number(pur.quantity);
                    // Update latest info
                    stockMap[pur.product_id].unit_price = pur.unit_price;
                    stockMap[pur.product_id].expiration_date = pur.expiration_date;
                    stockMap[pur.product_id].supplier_name = pur.invoices?.suppliers?.name;
                }
            });



            (consumptions as any[])?.forEach(cons => {
                if (cons.product_id && stockMap[cons.product_id]) {
                    stockMap[cons.product_id].total_consumed += Number(cons.quantity);
                }
            });

            return Object.values(stockMap).map(s => ({
                ...s,
                available_stock: s.total_purchased - s.total_consumed
            })).sort((a, b) => a.name.localeCompare(b.name));
        }
    });

    // Fetch consumption history
    const { data: historyData, isLoading: isLoadingHistory } = useQuery({
        queryKey: ['inventory-history'],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('product_consumptions')
                .select(`
                    id,
                    quantity,
                    consumption_date,
                    notes,
                    products (name)
                `)
                .order('consumption_date', { ascending: false });

            if (error) throw error;

            return (data as any[])?.map(item => ({
                id: item.id,
                product_name: item.products?.name || 'Inconnu',
                quantity: item.quantity,
                consumption_date: item.consumption_date,
                notes: item.notes || ''
            }));
        }
    });

    const filteredStock = useMemo(() => {
        if (!stockData) return [];
        return stockData.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [stockData, searchTerm]);

    // Mutation for adding consumption
    const [isConsumptionDialogOpen, setIsConsumptionDialogOpen] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [consumptionQty, setConsumptionQty] = useState('');
    const [consumptionNotes, setConsumptionNotes] = useState('');

    const consumptionMutation = useMutation({
        mutationFn: async (vars: { productId: string, qty: number, notes: string }) => {
            const { error } = await (supabase as any)
                .from('product_consumptions')
                .insert({
                    product_id: vars.productId,
                    quantity: vars.qty,
                    notes: vars.notes,
                    created_by: user?.id
                });
            if (error) throw error;
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
            toast.success('Consommation enregistrée');
            setIsConsumptionDialogOpen(false);
            setSelectedProductId('');
            setConsumptionQty('');
            setConsumptionNotes('');
        },
        onError: (err) => {
            toast.error('Erreur lors de l’enregistrement');
            console.error(err);
        }
    });

    const handleConsume = () => {
        if (!selectedProductId || !consumptionQty) {
            toast.error('Champs manquants');
            return;
        }

        const qty = parseFloat(consumptionQty);
        const product = stockData?.find(p => p.id === selectedProductId);

        if (product && qty > product.available_stock) {
            if (!confirm(`Attention: Stock insuffisant (${product.available_stock} restants). Voulez-vous continuer ?`)) {
                return;
            }
        }

        consumptionMutation.mutate({
            productId: selectedProductId,
            qty,
            notes: consumptionNotes
        });
    };

    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col">
            <header className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                        <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Inventaire & Stock</h1>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Gestion des consommables</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Dialog open={isConsumptionDialogOpen} onOpenChange={setIsConsumptionDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-9 gap-2 shadow-sm font-semibold">
                                <Plus className="h-4 w-4" /> Consommer
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Enregistrer une consommation</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Produit</label>
                                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sélectionner un produit..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {stockData?.map(p => (
                                                <SelectItem key={p.id} value={p.id} disabled={p.available_stock <= 0}>
                                                    {p.name} ({p.available_stock} en stock)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Quantité consommée</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={consumptionQty}
                                        onChange={(e) => setConsumptionQty(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Notes (en option)</label>
                                    <Input
                                        placeholder="Ex: Utilisation cabinet..."
                                        value={consumptionNotes}
                                        onChange={(e) => setConsumptionNotes(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleConsume} disabled={consumptionMutation.isPending} className="w-full">
                                    Valider la consommation
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            <main className="flex-1 p-3 sm:p-4 md:p-6 w-full space-y-6">

                <Tabs defaultValue="stock" onValueChange={setActiveTab} className="w-full">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <TabsList className="bg-white border p-1 h-11 shrink-0">
                            <TabsTrigger value="stock" className="gap-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-white">
                                <Package className="h-4 w-4" /> Stock Actuel
                            </TabsTrigger>
                            <TabsTrigger value="history" className="gap-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-white">
                                <History className="h-4 w-4" /> Historique
                            </TabsTrigger>
                        </TabsList>

                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Rechercher un produit..."
                                className="pl-9 bg-white border-slate-200 h-11 shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <TabsContent value="stock" className="m-0">
                        <Card className="border-none shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-800 h-12">Désignation</TableHead>
                                        <TableHead className="font-bold text-slate-800 h-12 text-center">Fournisseur</TableHead>
                                        <TableHead className="font-bold text-slate-800 h-12 text-center">Prix Unitaire</TableHead>
                                        <TableHead className="font-bold text-slate-800 h-12 text-center">Date Péremp.</TableHead>
                                        <TableHead className="font-bold text-slate-800 h-12 text-right">Disponible</TableHead>
                                        <TableHead className="h-12 w-[120px]"></TableHead>
                                    </TableRow>


                                </TableHeader>
                                <TableBody>
                                    {isLoadingStock ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center text-slate-400 uppercase text-xs font-bold animate-pulse">Chargement du stock...</TableCell>
                                        </TableRow>
                                    ) : filteredStock.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center text-slate-400">Aucun produit trouvé</TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredStock.map((prod) => (
                                            <TableRow key={prod.id} className="group hover:bg-slate-50 transition-colors">
                                                <TableCell className="py-4">
                                                    <span className="font-bold text-slate-800 uppercase tracking-tight">{prod.name}</span>
                                                </TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <span className="text-xs font-bold text-slate-500 uppercase">{prod.supplier_name || 'Algerié'}</span>
                                                </TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <span className="font-semibold text-slate-600">{prod.unit_price?.toLocaleString() || '-'} <span className="text-[10px]">DZD</span></span>
                                                </TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <span className={`text-xs font-bold ${prod.expiration_date && new Date(prod.expiration_date) < new Date() ? 'text-rose-500' : 'text-slate-500'}`}>
                                                        {prod.expiration_date ? format(new Date(prod.expiration_date), 'dd/MM/yyyy') : '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-4 text-right">
                                                    <span className={`text-lg font-black tabular-nums ${prod.available_stock <= 0 ? 'text-rose-600' : prod.available_stock < 5 ? 'text-amber-500' : 'text-primary'}`}>
                                                        {prod.available_stock}
                                                    </span>
                                                </TableCell>

                                                <TableCell className="py-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-primary font-bold hover:bg-primary/5"
                                                        onClick={() => {
                                                            setSelectedProductId(prod.id);
                                                            setIsConsumptionDialogOpen(true);
                                                        }}
                                                    >
                                                        Consommer
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>

                    <TabsContent value="history" className="m-0">
                        <Card className="border-none shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-800 h-12">Date</TableHead>
                                        <TableHead className="font-bold text-slate-800 h-12">Produit</TableHead>
                                        <TableHead className="font-bold text-slate-800 h-12 text-center">Qté</TableHead>
                                        <TableHead className="font-bold text-slate-800 h-12">Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingHistory ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-slate-400 uppercase text-xs font-bold animate-pulse">Chargement de l'historique...</TableCell>
                                        </TableRow>
                                    ) : historyData?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-slate-400">Aucune consommation enregistrée</TableCell>
                                        </TableRow>
                                    ) : (
                                        historyData?.map((item) => (
                                            <TableRow key={item.id} className="group hover:bg-slate-50 transition-colors">
                                                <TableCell className="py-4 text-slate-500 font-medium">
                                                    {format(new Date(item.consumption_date), 'dd/MM/yyyy')}
                                                </TableCell>
                                                <TableCell className="py-4 font-bold text-slate-800 uppercase tracking-tight">
                                                    {item.product_name}
                                                </TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <Badge className="bg-rose-500 hover:bg-rose-500 font-bold">
                                                        -{item.quantity}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-2 italic text-slate-500 text-sm">
                                                    {item.notes}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

export default Inventaire;
